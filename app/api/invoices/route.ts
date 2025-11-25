import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('invoices:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const status = searchParams.get('status');
    const vendorId = searchParams.get('vendorId');
    const contractId = searchParams.get('contractId');

    const where: any = {};

    if (status) {
      where.currentStatus = status;
    }

    if (vendorId) {
      where.vendorPartyId = vendorId;
    }

    if (contractId) {
      where.contractId = contractId;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdDate: 'desc' },
        include: {
          vendorParty: {
            select: {
              partyId: true,
              legalName: true,
            },
          },
          customerParty: true,
          contract: true,
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

const createInvoiceSchema = z.object({
  invoiceNumber: z.string().optional(),
  vendorPartyId: z.string().uuid(),
  customerPartyId: z.string().uuid(),
  contractId: z.string().uuid().optional(),
  sourceDocumentId: z.string().uuid().optional(),
  poNumber: z.string().optional(),
  externalVoucherId: z.string().optional(),
  apUnit: z.string().optional(),
  invoiceDate: z.string().transform((str) => new Date(str)),
  paymentDate: z.string().transform((str) => new Date(str)).optional(),
  servicePeriodStart: z.string().transform((str) => new Date(str)).optional(),
  servicePeriodEnd: z.string().transform((str) => new Date(str)).optional(),
  netServiceAmount: z.number(),
  taxAmount: z.number().optional(),
  shippingHandling: z.number().optional(),
  fuelSurcharge: z.number().optional(),
  miscellaneousCharges: z.number().optional(),
  grossAmount: z.number(),
  currency: z.string().length(3),
  billingAggregationLevel: z.string().optional(),
  currentStatus: z.string().default('Pending'),
  lineItems: z
    .array(
      z.object({
        lineNumber: z.number(),
        description: z.string(),
        invoiceQuantity: z.number().optional(),
        invoiceUom: z.string().optional(),
        invoiceUnitPrice: z.number().optional(),
        extendedAmount: z.number(),
        servicePeriodStart: z.string().transform((str) => new Date(str)).optional(),
        servicePeriodEnd: z.string().transform((str) => new Date(str)).optional(),
        serviceCategoryId: z.number().optional(),
        glAccount: z.string().optional(),
        department: z.string().optional(),
        project: z.string().optional(),
        costCenter: z.string().optional(),
      })
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('invoices:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = createInvoiceSchema.parse(body);

    const { lineItems, ...invoiceData } = data;

    const invoice = await prisma.invoice.create({
      data: {
        ...invoiceData,
        netServiceAmount: new Decimal(invoiceData.netServiceAmount),
        taxAmount: invoiceData.taxAmount ? new Decimal(invoiceData.taxAmount) : null,
        shippingHandling: invoiceData.shippingHandling ? new Decimal(invoiceData.shippingHandling) : null,
        fuelSurcharge: invoiceData.fuelSurcharge ? new Decimal(invoiceData.fuelSurcharge) : null,
        miscellaneousCharges: invoiceData.miscellaneousCharges
          ? new Decimal(invoiceData.miscellaneousCharges)
          : null,
        grossAmount: new Decimal(invoiceData.grossAmount),
        createdBy: user.userId,
      },
    });

    // Create line items if provided
    if (lineItems && lineItems.length > 0) {
      await prisma.invoiceLineItem.createMany({
        data: lineItems.map((line) => ({
          invoiceId: invoice.invoiceId,
          lineNumber: line.lineNumber,
          description: line.description,
          invoiceQuantity: line.invoiceQuantity ? new Decimal(line.invoiceQuantity) : null,
          invoiceUom: line.invoiceUom,
          invoiceUnitPrice: line.invoiceUnitPrice ? new Decimal(line.invoiceUnitPrice) : null,
          extendedAmount: new Decimal(line.extendedAmount),
          servicePeriodStart: line.servicePeriodStart,
          servicePeriodEnd: line.servicePeriodEnd,
          serviceCategoryId: line.serviceCategoryId,
          glAccount: line.glAccount,
          department: line.department,
          project: line.project,
          costCenter: line.costCenter,
        })),
      });
    }

    const invoiceWithLineItems = await prisma.invoice.findUnique({
      where: { invoiceId: invoice.invoiceId },
      include: {
        vendorParty: true,
        customerParty: true,
        contract: true,
        invoiceLineItems: true,
      },
    });

    return NextResponse.json(invoiceWithLineItems, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }

    console.error('Create invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

