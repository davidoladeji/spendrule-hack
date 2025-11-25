import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';

export async function GET(
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

    // Calculate progress based on processing status
    let progress = 0;
    let stage = 'uploaded';

    if (document.processingStatus === 'uploaded') {
      progress = 10;
      stage = 'Uploaded';
    } else if (document.processingStatus === 'ocr') {
      progress = 30;
      stage = 'Running OCR';
    } else if (document.processingStatus === 'type_validation') {
      progress = 40;
      stage = 'Validating document type';
    } else if (document.processingStatus === 'extraction') {
      progress = 50;
      stage = 'Extracting data';
    } else if (document.processingStatus === 'normalization') {
      progress = 70;
      stage = 'Normalizing data';
    } else if (document.processingStatus === 'validation') {
      progress = 90;
      stage = 'Running validation';
    } else if (document.processingStatus === 'completed') {
      progress = 100;
      stage = 'Complete';
    } else if (document.processingStatus === 'error' || document.processingStatus === 'validation_error') {
      progress = document.processingStatus === 'validation_error' ? 95 : 0;
      stage = document.processingStatus === 'validation_error' ? 'Validation Error' : 'Error';
    } else {
      // Fallback: calculate based on completion flags
      if (document.ocrCompleted && !document.extractionCompleted) {
        progress = 30;
        stage = 'OCR Complete';
      } else if (document.extractionCompleted && !document.validationCompleted) {
        progress = 60;
        stage = 'Extraction Complete';
      } else if (document.validationCompleted) {
        progress = 100;
        stage = 'Complete';
      } else {
        progress = 10;
        stage = 'Uploaded';
      }
    }

    return NextResponse.json({
      status: document.processingStatus === 'completed' ? 'completed' : document.processingStatus === 'error' ? 'error' : 'processing',
      progress,
      stage,
      ocrCompleted: document.ocrCompleted || false,
      extractionCompleted: document.extractionCompleted || false,
      validationCompleted: document.validationCompleted || false,
      processingStatus: document.processingStatus || 'uploaded',
      error: document.processingError || null,
    });
  } catch (error) {
    console.error('Error fetching document status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

