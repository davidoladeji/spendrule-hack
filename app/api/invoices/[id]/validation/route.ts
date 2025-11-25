import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { validateInvoice, validateInvoiceDeterministic } from '@/lib/validation-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('invoices:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const validation = await prisma.invoiceValidation.findFirst({
      where: { invoiceId: params.id },
      include: {
        validationExceptions: {
          include: {
            contractExtraction: true,
            invoiceExtraction: true,
          },
        },
      },
      orderBy: { validationDate: 'desc' },
    });

    if (!validation) {
      return NextResponse.json({ error: 'Validation not found' }, { status: 404 });
    }

    return NextResponse.json(validation);
  } catch (error) {
    console.error('Error fetching validation:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('invoices:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const useDeterministic = body.useDeterministic || false;

    let validationId: string;
    if (useDeterministic) {
      validationId = await validateInvoiceDeterministic(params.id);
    } else {
      // Try to get validation payload from request body
      const validationPayload = body.validationPayload;
      const validationRequest = body.validationRequest;
      validationId = await validateInvoice(params.id, validationPayload, validationRequest);
    }

    return NextResponse.json({
      validationId,
      message: 'Validation completed successfully',
    });
  } catch (error) {
    console.error('Error running validation:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

