import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';

const triggerValidationSchema = z.object({
  invoiceId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('validations:trigger')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { invoiceId } = triggerValidationSchema.parse(body);

    // Import and run validation orchestration
    const { runInvoiceValidation } = await import('@/lib/validation-orchestration');
    const validationId = await runInvoiceValidation(invoiceId, user.userId);

    const validation = await prisma.invoiceValidation.findUnique({
      where: { validationId },
      include: {
        validationExceptions: true,
      },
    });

    return NextResponse.json(validation, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Trigger validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('validations:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const invoiceId = searchParams.get('invoiceId');

    const where: any = {};

    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    const [validations, total] = await Promise.all([
      prisma.invoiceValidation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { validationDate: 'desc' },
        include: {
          invoice: {
            include: {
              vendorParty: true,
            },
          },
          validationExceptions: true,
        },
      }),
      prisma.invoiceValidation.count({ where }),
    ]);

    return NextResponse.json({
      validations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get validations error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

