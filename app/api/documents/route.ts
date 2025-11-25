import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('documents:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const documentType = searchParams.get('documentType');
    const search = searchParams.get('search');

    const where: any = {};

    if (documentType) {
      where.documentType = documentType;
    }

    if (search) {
      where.documentName = { contains: search, mode: 'insensitive' };
    }

    const [documents, total] = await Promise.all([
      prisma.documentMetadata.findMany({
        where,
        skip,
        take: limit,
        orderBy: { uploadedDate: 'desc' },
      }),
      prisma.documentMetadata.count({ where }),
    ]);

    return NextResponse.json({
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get documents error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

