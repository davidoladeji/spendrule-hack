import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { extractTextWithCoordinates } from '@/lib/ocr';
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

    if (!document.documentUrl) {
      return NextResponse.json(
        { error: 'Document file not found' },
        { status: 404 }
      );
    }

    // Extract filepath from URL - documentUrl is like /uploads/filename, files are in public/uploads
    const filepath = join(process.cwd(), 'public', document.documentUrl);

    // Perform OCR extraction
    const ocrResult = await extractTextWithCoordinates(filepath);

    // Update document metadata
    await prisma.documentMetadata.update({
      where: { documentId: params.id },
      data: {
        ocrCompleted: true,
        totalPages: ocrResult.totalPages,
      },
    });

    // Store OCR results in extraction data (simplified - in production, store more detailed data)
    for (const page of ocrResult.pages) {
      await prisma.documentExtractionData.create({
        data: {
          documentId: params.id,
          entityType: 'ocr_text',
          fieldName: `page_${page.pageNumber}`,
          extractedValue: page.text,
          sourcePageNumber: page.pageNumber,
          extractionMethod: 'pdf-parse',
          boundingBoxCoordinates: page.boundingBoxes ? JSON.parse(JSON.stringify(page.boundingBoxes)) : null,
        },
      });
    }

    return NextResponse.json({
      message: 'OCR extraction completed',
      totalPages: ocrResult.totalPages,
      pagesExtracted: ocrResult.pages.length,
    });
  } catch (error) {
    console.error('OCR extraction error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

