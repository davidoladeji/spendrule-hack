import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';

const createContractSchema = z.object({
  parentContractId: z.string().uuid().optional(),
  relationshipType: z.string().optional(),
  contractNumber: z.string(),
  contractTitle: z.string(),
  contractType: z.string(),
  effectiveDate: z.string().transform((str) => new Date(str)),
  expirationDate: z.string().transform((str) => new Date(str)),
  autoRenewalEnabled: z.boolean().optional(),
  renewalPeriod: z.string().optional(),
  noticePeriodDays: z.number().optional(),
  totalContractValue: z.number().optional(),
  annualValue: z.number().optional(),
  currency: z.string().length(3),
  contractStatus: z.string().default('Draft'),
  version: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('contracts:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {};

    if (status) {
      where.contractStatus = status;
    }

    if (search) {
      where.OR = [
        { contractNumber: { contains: search, mode: 'insensitive' } },
        { contractTitle: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [contracts, total] = await Promise.all([
      prisma.contract.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdDate: 'desc' },
        include: {
          contractParties: {
            include: {
              party: true,
            },
          },
          billableItems: {
            take: 5,
            select: {
              itemName: true,
              itemCategory: true,
            },
          },
        },
      }),
      prisma.contract.count({ where }),
    ]);

    return NextResponse.json({
      contracts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get contracts error:', error);
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

    if (!user.permissions.includes('contracts:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = createContractSchema.parse(body);

    const contract = await prisma.contract.create({
      data: {
        ...data,
        createdBy: user.userId,
      },
    });

    return NextResponse.json(contract, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create contract error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

