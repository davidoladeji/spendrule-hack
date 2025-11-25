import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';

const createPartySchema = z.object({
  partyType: z.string(),
  legalName: z.string(),
  tradingName: z.string().optional(),
  partyNumber: z.string().optional(),
  taxId: z.string().optional(),
  dunsNumber: z.string().optional(),
  npiNumber: z.string().optional(),
  cageCode: z.string().optional(),
  primaryContactEmail: z.string().email().optional(),
  primaryContactPhone: z.string().optional(),
  partyStatus: z.string().default('Active'),
});

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('parties:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const partyType = searchParams.get('partyType');
    const search = searchParams.get('search');

    const where: any = {};

    if (partyType) {
      where.partyType = partyType;
    }

    if (search) {
      where.OR = [
        { legalName: { contains: search, mode: 'insensitive' } },
        { tradingName: { contains: search, mode: 'insensitive' } },
        { partyNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [parties, total] = await Promise.all([
      prisma.party.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdDate: 'desc' },
      }),
      prisma.party.count({ where }),
    ]);

    return NextResponse.json({
      parties,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get parties error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('parties:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = createPartySchema.parse(body);

    const party = await prisma.party.create({
      data: {
        ...data,
        createdBy: user.userId,
      },
    });

    return NextResponse.json(party, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create party error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

