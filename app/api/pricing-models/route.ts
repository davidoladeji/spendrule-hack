import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

const createPricingModelSchema = z.object({
  modelName: z.string(),
  modelType: z.string(),
  version: z.string().default('1.0'),
  calculationMethod: z.string().optional(),
  calculationFormula: z.record(z.any()).optional(),
  baseRate: z.number().optional(),
  currency: z.string().length(3),
  prorationMethod: z.string().optional(),
  partialMonthCalculation: z.string().optional(),
  isActive: z.boolean().default(true),
  tiers: z
    .array(
      z.object({
        tierSequence: z.number(),
        tierName: z.string().optional(),
        minValue: z.number(),
        maxValue: z.number().optional(),
        rate: z.number(),
        rateType: z.string().optional(),
        isCumulative: z.boolean().optional(),
        appliesToOverageOnly: z.boolean().optional(),
      })
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('pricing-models:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const search = searchParams.get('search');
    const isActive = searchParams.get('isActive');

    const where: any = {};

    if (search) {
      where.modelName = { contains: search, mode: 'insensitive' };
    }

    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const [models, total] = await Promise.all([
      prisma.pricingModel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdDate: 'desc' },
        include: {
          pricingTiers: {
            orderBy: { tierSequence: 'asc' },
          },
        },
      }),
      prisma.pricingModel.count({ where }),
    ]);

    return NextResponse.json({
      models,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get pricing models error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('pricing-models:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = createPricingModelSchema.parse(body);

    const { tiers, ...modelData } = data;

    const model = await prisma.pricingModel.create({
      data: {
        ...modelData,
        baseRate: modelData.baseRate ? new Decimal(modelData.baseRate) : null,
        calculationFormula: modelData.calculationFormula || {},
      },
    });

    // Create pricing tiers if provided
    if (tiers && tiers.length > 0) {
      await prisma.pricingTier.createMany({
        data: tiers.map((tier) => ({
          modelId: model.modelId,
          tierSequence: tier.tierSequence,
          tierName: tier.tierName,
          minValue: new Decimal(tier.minValue),
          maxValue: tier.maxValue ? new Decimal(tier.maxValue) : null,
          rate: new Decimal(tier.rate),
          rateType: tier.rateType,
          isCumulative: tier.isCumulative,
          appliesToOverageOnly: tier.appliesToOverageOnly,
        })),
      });
    }

    const modelWithTiers = await prisma.pricingModel.findUnique({
      where: { modelId: model.modelId },
      include: {
        pricingTiers: {
          orderBy: { tierSequence: 'asc' },
        },
      },
    });

    return NextResponse.json(modelWithTiers, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }

    console.error('Create pricing model error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

