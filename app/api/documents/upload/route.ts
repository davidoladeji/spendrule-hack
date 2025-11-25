import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { saveFile, generateFileHash, generateUniqueFilename } from '@/lib/storage';
import { IncomingForm } from 'formidable';
import { readFileSync } from 'fs';

// Background processing function
async function processDocumentPipeline(documentId: string, userId: string, filename: string) {
  try {
    // Step 1: OCR
    await prisma.documentMetadata.update({
      where: { documentId },
      data: { processingStatus: 'ocr' },
    });

    const { extractTextFromPDF } = await import('@/lib/ocr');
    const document = await prisma.documentMetadata.findUnique({
      where: { documentId },
    });

    if (!document || !document.documentUrl) {
      throw new Error('Document not found');
    }

    const { join } = await import('path');
    // Files are saved to public/uploads, so the path is relative to public
    const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'public', 'uploads');
    const filepath = join(UPLOAD_DIR, filename);
    
    let ocrResult;
    try {
      ocrResult = await extractTextFromPDF(filepath);
    } catch (ocrError) {
      const errorMessage = ocrError instanceof Error ? ocrError.message : 'OCR failed';
      await prisma.documentMetadata.update({
        where: { documentId },
        data: { 
          processingStatus: 'error',
          processingError: `OCR failed: ${errorMessage}`,
        },
      });
      throw new Error(`OCR failed: ${errorMessage}`);
    }

    await prisma.documentMetadata.update({
      where: { documentId },
      data: { 
        ocrCompleted: true,
        totalPages: ocrResult.totalPages,
      },
    });

    // Step 2: Document Type Detection and Validation
    await prisma.documentMetadata.update({
      where: { documentId },
      data: { processingStatus: 'type_validation' },
    });

    const { detectDocumentType } = await import('@/lib/ai-extraction');
    let typeDetectionResult;
    try {
      typeDetectionResult = await detectDocumentType(ocrResult.text);
    } catch (detectionError) {
      const errorMessage = detectionError instanceof Error ? detectionError.message : 'Type detection failed';
      await prisma.documentMetadata.update({
        where: { documentId },
        data: { 
          processingStatus: 'error',
          processingError: `Document type detection failed: ${errorMessage}`,
        },
      });
      throw new Error(`Document type detection failed: ${errorMessage}`);
    }

    // Validate detected type against user-selected type
    const detectedType = typeDetectionResult.type;
    const selectedType = document.documentType;
    let errorMessage: string | null = null;

    if (detectedType === 'other') {
      errorMessage = 'The uploaded document does not appear to be a contract or invoice. Please upload a valid contract or invoice document.';
    } else if (detectedType !== selectedType) {
      errorMessage = `The uploaded document appears to be a ${detectedType}, but you selected ${selectedType}. Please verify and try again.`;
    }

    if (errorMessage) {
      await prisma.documentMetadata.update({
        where: { documentId },
        data: { 
          processingStatus: 'error',
          processingError: errorMessage,
        },
      });
      throw new Error(errorMessage);
    }

    // Step 3: AI Extraction
    await prisma.documentMetadata.update({
      where: { documentId },
      data: { processingStatus: 'extraction' },
    });

    const { extractContractData, extractInvoiceData, storeExtractionResults } = await import('@/lib/ai-extraction');
    let extractionResult;
    try {
      if (document.documentType === 'contract') {
        extractionResult = await extractContractData(ocrResult.text, documentId, ocrResult.totalPages);
      } else if (document.documentType === 'invoice') {
        extractionResult = await extractInvoiceData(ocrResult.text, documentId, ocrResult.totalPages);
      } else {
        throw new Error(`Unsupported document type: ${document.documentType}`);
      }
    } catch (extractionError) {
      const errorMessage = extractionError instanceof Error ? extractionError.message : 'Extraction failed';
      await prisma.documentMetadata.update({
        where: { documentId },
        data: { 
          processingStatus: 'error',
          processingError: `Extraction failed: ${errorMessage}`,
        },
      });
      throw new Error(`Extraction failed: ${errorMessage}`);
    }

    if (!extractionResult.success || !extractionResult.data) {
      const errorMessage = extractionResult.errors?.join(', ') || 'Extraction failed or returned no data';
      await prisma.documentMetadata.update({
        where: { documentId },
        data: { 
          processingStatus: 'error',
          processingError: errorMessage,
        },
      });
      throw new Error(errorMessage);
    }

    // Step 4: Store extraction results with provenance
    try {
      await storeExtractionResults(documentId, extractionResult, ocrResult.totalPages);
    } catch (storeError) {
      console.error('Error storing extraction results:', storeError);
      // Non-fatal - continue with normalization
    }

    await prisma.documentMetadata.update({
      where: { documentId },
      data: { extractionCompleted: true },
    });

    // Step 5: Normalize data (create database entities)
    await prisma.documentMetadata.update({
      where: { documentId },
      data: { processingStatus: 'normalization' },
    });

    const { normalizeContractData, normalizeInvoiceData } = await import('@/lib/data-normalization');
    let entityId: string;
    
    try {
      if (document.documentType === 'contract' && extractionResult.data) {
        entityId = await normalizeContractData(extractionResult.data, documentId, userId);
        
        // Link extraction records to contract
        await prisma.documentExtractionData.updateMany({
          where: { documentId },
          data: { contractId: entityId },
        });
        
        // Mark contract normalization as completed
        await prisma.documentMetadata.update({
          where: { documentId },
          data: { 
            validationCompleted: true, // For contracts, normalization completion = validation completion
          },
        });
      } else if (document.documentType === 'invoice' && extractionResult.data) {
        entityId = await normalizeInvoiceData(extractionResult.data, documentId, userId);
        
        // Link extraction records to invoice
        await prisma.documentExtractionData.updateMany({
          where: { documentId },
          data: { invoiceId: entityId },
        });

        // Step 5: Run validation engine for invoices
        await prisma.documentMetadata.update({
          where: { documentId },
          data: { processingStatus: 'validation' },
        });

        try {
          // Use runInvoiceValidation which handles the full validation flow
          // including exceptions and approval requests
          const { runInvoiceValidation } = await import('@/lib/validation-orchestration');
          await runInvoiceValidation(entityId, userId);
          
          await prisma.documentMetadata.update({
            where: { documentId },
            data: { validationCompleted: true },
          });
        } catch (validationError) {
          console.error('Validation error (non-fatal):', validationError);
          // Update status but don't fail the pipeline - validation can be retried later
          await prisma.documentMetadata.update({
            where: { documentId },
            data: { 
              processingStatus: 'validation_error',
              processingError: validationError instanceof Error ? validationError.message : 'Validation failed',
            },
          });
          // Don't throw - allow pipeline to continue
        }
      } else {
        throw new Error(`Cannot normalize: document type is ${document.documentType} but no extraction data available`);
      }
    } catch (normalizeError) {
      const errorMessage = normalizeError instanceof Error ? normalizeError.message : 'Normalization failed';
      await prisma.documentMetadata.update({
        where: { documentId },
        data: { 
          processingStatus: 'error',
          processingError: `Normalization failed: ${errorMessage}`,
        },
      });
      throw new Error(`Normalization failed: ${errorMessage}`);
    }

    // Mark as completed
    await prisma.documentMetadata.update({
      where: { documentId },
      data: { processingStatus: 'completed' },
    });
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);
    // Update document with error status
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    try {
      await prisma.documentMetadata.update({
        where: { documentId },
        data: { 
          extractionCompleted: false,
          processingStatus: 'error',
          processingError: errorMessage,
        },
      });
    } catch (updateError) {
      console.error('Failed to update document error status:', updateError);
    }
    // Don't re-throw - error is logged and status is updated
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('documents:upload')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = formData.get('documentType') as string | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided or invalid file' }, { status: 400 });
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 50MB limit' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension) && !allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, DOC, and DOCX files are allowed' },
        { status: 400 }
      );
    }

    if (!documentType || !['contract', 'invoice'].includes(documentType)) {
      return NextResponse.json(
        { error: 'Invalid document type. Must be "contract" or "invoice"' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileHash = generateFileHash(buffer);
    const filename = generateUniqueFilename(file.name);
    const filepath = await saveFile(buffer, filename);

    // Get file metadata
    const mimeType = file.type;
    const fileSizeBytes = BigInt(buffer.length);

    // Create document metadata record
    let document;
    try {
      document = await prisma.documentMetadata.create({
        data: {
          documentType,
          documentName: file.name,
          documentUrl: `/uploads/${filename}`,
          fileHash,
          fileSizeBytes,
          mimeType,
          uploadedBy: user.userId,
          processingStatus: 'uploaded',
        },
      });
    } catch (dbError: any) {
      // If processingStatus field doesn't exist, try without it
      if (dbError?.code === 'P2009' || dbError?.message?.includes('processingStatus')) {
        document = await prisma.documentMetadata.create({
          data: {
            documentType,
            documentName: file.name,
            documentUrl: `/uploads/${filename}`,
            fileHash,
            fileSizeBytes,
            mimeType,
            uploadedBy: user.userId,
          },
        });
      } else {
        throw dbError;
      }
    }

    // Auto-trigger processing pipeline in background (don't wait for it)
    // This will: OCR → Extraction → Normalization
    processDocumentPipeline(document.documentId, user.userId, filename).catch((error) => {
      console.error('Error processing document pipeline:', error);
      // Don't fail the upload if processing fails - user can retry later
    });

    // Ensure all values are properly serialized
    const responseData = {
      documentId: String(document.documentId),
      documentName: String(document.documentName || ''),
      documentType: String(document.documentType || ''),
      message: 'File uploaded successfully. Processing started.',
    };

    return NextResponse.json(responseData, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

