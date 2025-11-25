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

    const extractionData = await prisma.documentExtractionData.findMany({
      where: { documentId: params.id },
      orderBy: [
        { sourcePageNumber: 'asc' },
        { fieldName: 'asc' },
      ],
    });

    return NextResponse.json({
      extractionData,
      count: extractionData.length,
    });
  } catch (error) {
    console.error('Error fetching extraction data:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

