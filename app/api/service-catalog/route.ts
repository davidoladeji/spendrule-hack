import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

const createServiceItemSchema = z.object({
  contractId: z.string().uuid(),
  pricingModelId: z.string().uuid().optional(),
  itemName: z.string(),
  itemDescription: z.string().optional(),
  itemCategory: z.string().optional(),
  serviceCategoryId: z.number().optional(),
  listPrice: z.number(),
  contractPrice: z.number().optional(),
  priceFloor: z.number().optional(),
  priceCeiling: z.number().optional(),
  allowedVarianceType: z.string().optional(),
  allowedVarianceValue: z.number().optional(),
  primaryUom: z.string(),
  allowedUoms: z.array(z.string()).optional(),
  uomConversionRules: z.record(z.any()).optional(),
  currency: z.string().length(3),
  billingFrequency: z.string().optional(),
  rateType: z.string().optional(),
  sku: z.string().optional(),
  catalogNumber: z.string().optional(),
  glAccount: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('service-catalog:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const contractId = searchParams.get('contractId');
    const search = searchParams.get('search');

    const where: any = {};

    if (contractId) {
      where.contractId = contractId;
    }

    if (search) {
      where.OR = [
        { itemName: { contains: search, mode: 'insensitive' } },
        { itemDescription: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { catalogNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.billableItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdDate: 'desc' },
        include: {
          contract: {
            select: {
              contractNumber: true,
              contractTitle: true,
            },
          },
          pricingModel: true,
          serviceCategory: true,
        },
      }),
      prisma.billableItem.count({ where }),
    ]);

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get service catalog error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('service-catalog:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = createServiceItemSchema.parse(body);

    const item = await prisma.billableItem.create({
      data: {
        ...data,
        listPrice: new Decimal(data.listPrice),
        contractPrice: data.contractPrice ? new Decimal(data.contractPrice) : null,
        priceFloor: data.priceFloor ? new Decimal(data.priceFloor) : null,
        priceCeiling: data.priceCeiling ? new Decimal(data.priceCeiling) : null,
        allowedVarianceValue: data.allowedVarianceValue ? new Decimal(data.allowedVarianceValue) : null,
        allowedUoms: data.allowedUoms || [],
        uomConversionRules: data.uomConversionRules || {},
      },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }

    console.error('Create service item error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

