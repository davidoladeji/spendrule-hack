import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { extractInvoiceData, storeExtractionResults } from '@/lib/ai-extraction';
import { extractTextFromPDF } from '@/lib/ocr';
import { normalizeInvoiceData } from '@/lib/data-normalization';
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

    if (!user.permissions.includes('invoices:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get invoice and its source document
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceId: params.id },
      include: {
        sourceDocument: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (!invoice.sourceDocument) {
      return NextResponse.json(
        { error: 'Invoice has no source document' },
        { status: 400 }
      );
    }

    if (!invoice.sourceDocument.documentUrl) {
      return NextResponse.json(
        { error: 'Source document file not found' },
        { status: 404 }
      );
    }

    // Re-run OCR
    const filepath = join(process.cwd(), 'public', invoice.sourceDocument.documentUrl);
    const ocrResult = await extractTextFromPDF(filepath);

    // Re-run AI extraction
    const extractionResult = await extractInvoiceData(
      ocrResult.text,
      invoice.sourceDocument.documentId,
      ocrResult.totalPages
    );

    if (!extractionResult.success) {
      return NextResponse.json(
        {
          error: 'Extraction failed',
          details: extractionResult.errors,
        },
        { status: 400 }
      );
    }

    // Store extraction results
    await storeExtractionResults(
      invoice.sourceDocument.documentId,
      extractionResult,
      ocrResult.totalPages
    );

    // Update document status
    await prisma.documentMetadata.update({
      where: { documentId: invoice.sourceDocument.documentId },
      data: {
        extractionCompleted: true,
        processingStatus: 'extraction',
      },
    });

    // Re-normalize invoice data (this will update the invoice with new extracted values)
    try {
      await normalizeInvoiceData(
        extractionResult.data,
        invoice.sourceDocument.documentId,
        user.userId
      );
    } catch (normalizeError) {
      console.error('Normalization error (non-fatal):', normalizeError);
      // Continue even if normalization fails - extraction data is still stored
    }

    return NextResponse.json({
      message: 'Invoice re-extracted successfully',
      extractionResult: {
        success: extractionResult.success,
        confidence: extractionResult.confidence,
        errors: extractionResult.errors,
      },
    });
  } catch (error) {
    console.error('Re-extraction error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

