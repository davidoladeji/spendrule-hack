import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { normalizeContractData, normalizeInvoiceData } from '@/lib/data-normalization';

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

    if (!document.extractionCompleted) {
      return NextResponse.json(
        { error: 'Extraction must be completed before normalization' },
        { status: 400 }
      );
    }

    // Get extraction data
    const extractions = await prisma.documentExtractionData.findMany({
      where: {
        documentId: params.id,
        entityType: 'extracted_field',
      },
    });

    // Reconstruct the extracted JSON object
    const extractedData: any = {};
    for (const extraction of extractions) {
      try {
        const value = JSON.parse(extraction.extractedValue || 'null');
        extractedData[extraction.fieldName] = value;
      } catch {
        extractedData[extraction.fieldName] = extraction.extractedValue;
      }
    }

    let resultId: string;

    if (document.documentType === 'contract') {
      resultId = await normalizeContractData(extractedData, params.id, user.userId);
    } else if (document.documentType === 'invoice') {
      resultId = await normalizeInvoiceData(extractedData, params.id, user.userId);
    } else {
      return NextResponse.json(
        { error: 'Unsupported document type for normalization' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Data normalized successfully',
      [document.documentType === 'contract' ? 'contractId' : 'invoiceId']: resultId,
    });
  } catch (error) {
    console.error('Normalization error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

