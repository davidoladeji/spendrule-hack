import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { extractContractData, extractInvoiceData, storeExtractionResults } from '@/lib/ai-extraction';
import { extractTextFromPDF } from '@/lib/ocr';
import { join } from 'path';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('documents:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const document = await prisma.documentMetadata.findUnique({
      where: { documentId: params.id },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!document.ocrCompleted) {
      return NextResponse.json(
        { error: 'OCR must be completed before extraction' },
        { status: 400 }
      );
    }

    if (!document.documentUrl) {
      return NextResponse.json(
        { error: 'Document file not found' },
        { status: 404 }
      );
    }

    // Get OCR text - documentUrl is like /uploads/filename, files are in public/uploads
    const filepath = join(process.cwd(), 'public', document.documentUrl);
    const ocrResult = await extractTextFromPDF(filepath);

    // Perform AI extraction based on document type
    let extractionResult;
    if (document.documentType === 'contract') {
      extractionResult = await extractContractData(ocrResult.text, params.id, ocrResult.totalPages);
    } else if (document.documentType === 'invoice') {
      extractionResult = await extractInvoiceData(ocrResult.text, params.id, ocrResult.totalPages);
    } else {
      return NextResponse.json(
        { error: 'Unsupported document type for extraction' },
        { status: 400 }
      );
    }

    // Even if extraction partially failed, store what we have
    if (!extractionResult.success && extractionResult.data) {
      // Partial extraction - still store the data
      await storeExtractionResults(params.id, extractionResult, ocrResult.totalPages);
      await prisma.documentMetadata.update({
        where: { documentId: params.id },
        data: {
          extractionCompleted: true, // Mark as completed even if partial
        },
      });

      return NextResponse.json({
        message: 'Extraction completed with errors',
        data: extractionResult.data,
        confidence: extractionResult.confidence,
        errors: extractionResult.errors,
        warning: 'Some fields may be missing. Please review and correct.',
      });
    }

    if (!extractionResult.success) {
      return NextResponse.json(
        { error: 'Extraction failed', details: extractionResult.errors },
        { status: 500 }
      );
    }

    // Store extraction results with provenance
    await storeExtractionResults(params.id, extractionResult, ocrResult.totalPages);

    // Update document metadata
    await prisma.documentMetadata.update({
      where: { documentId: params.id },
      data: {
        extractionCompleted: true,
      },
    });

    // Normalize data (create database entities from extraction)
    if (extractionResult.success && extractionResult.data) {
      const { normalizeContractData, normalizeInvoiceData } = await import('@/lib/data-normalization');
      try {
        let entityId: string;
        if (document.documentType === 'contract') {
          entityId = await normalizeContractData(extractionResult.data, params.id, user.userId);
          // Link extraction records to contract
          await prisma.documentExtractionData.updateMany({
            where: { documentId: params.id },
            data: { contractId: entityId },
          });
        } else if (document.documentType === 'invoice') {
          entityId = await normalizeInvoiceData(extractionResult.data, params.id, user.userId);
          // Link extraction records to invoice
          await prisma.documentExtractionData.updateMany({
            where: { documentId: params.id },
            data: { invoiceId: entityId },
          });
        }
      } catch (normalizeError) {
        console.error('Error normalizing data:', normalizeError);
        // Don't fail the extraction if normalization fails - data is still extracted
      }
    }

    return NextResponse.json({
      message: 'Extraction completed successfully',
      data: extractionResult.data,
      confidence: extractionResult.confidence,
    });
  } catch (error) {
    console.error('AI extraction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

