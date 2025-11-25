import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';
import { Decimal } from '@prisma/client/runtime/library';

const updateInvoiceSchema = z.object({
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().transform((str) => new Date(str)).optional(),
  dueDate: z.string().transform((str) => new Date(str)).optional().nullable(),
  vendorPartyId: z.string().uuid().optional(),
  customerPartyId: z.string().uuid().optional().nullable(),
  contractId: z.string().uuid().optional().nullable(),
  netServiceAmount: z.number().optional(),
  taxAmount: z.number().optional().nullable(),
  shippingHandling: z.number().optional().nullable(),
  fuelSurcharge: z.number().optional().nullable(),
  miscellaneousCharges: z.number().optional().nullable(),
  grossAmount: z.number().optional(),
  currency: z.string().length(3).optional(),
  currentStatus: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('invoices:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceId: params.id },
      include: {
        vendorParty: true,
        customerParty: true,
        contract: {
          include: {
            billableItems: true,
          },
        },
        sourceDocument: {
          select: {
            documentId: true,
            documentUrl: true,
            documentName: true,
            mimeType: true,
            totalPages: true,
          },
        },
        invoiceLineItems: {
          include: {
            billableItem: true,
            serviceCategory: true,
          },
        },
        invoiceValidations: {
          include: {
            validationExceptions: {
              include: {
                contractExtraction: true,
                invoiceExtraction: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Serialize the invoice to ensure Decimal types are converted to numbers
    const serializedInvoice = JSON.parse(JSON.stringify(invoice, (_key, value) => {
      if (typeof value === 'object' && value !== null && value.constructor.name === 'Decimal') {
        return Number(value);
      }
      return value;
    }));

    return NextResponse.json(serializedInvoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    const body = await request.json();
    const data = updateInvoiceSchema.parse(body);

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { invoiceId: params.id },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {
      updatedBy: user.userId,
      updatedDate: new Date(),
    };

    if (data.invoiceNumber !== undefined) updateData.invoiceNumber = data.invoiceNumber;
    if (data.invoiceDate !== undefined) updateData.invoiceDate = data.invoiceDate;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.vendorPartyId !== undefined) updateData.vendorPartyId = data.vendorPartyId;
    if (data.customerPartyId !== undefined) updateData.customerPartyId = data.customerPartyId;
    if (data.contractId !== undefined) updateData.contractId = data.contractId;
    if (data.netServiceAmount !== undefined) updateData.netServiceAmount = new Decimal(data.netServiceAmount);
    if (data.taxAmount !== undefined) updateData.taxAmount = data.taxAmount !== null ? new Decimal(data.taxAmount) : null;
    if (data.shippingHandling !== undefined) updateData.shippingHandling = data.shippingHandling !== null ? new Decimal(data.shippingHandling) : null;
    if (data.fuelSurcharge !== undefined) updateData.fuelSurcharge = data.fuelSurcharge !== null ? new Decimal(data.fuelSurcharge) : null;
    if (data.miscellaneousCharges !== undefined) updateData.miscellaneousCharges = data.miscellaneousCharges !== null ? new Decimal(data.miscellaneousCharges) : null;
    if (data.grossAmount !== undefined) updateData.grossAmount = new Decimal(data.grossAmount);
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.currentStatus !== undefined) updateData.currentStatus = data.currentStatus;

    const updatedInvoice = await prisma.invoice.update({
      where: { invoiceId: params.id },
      data: updateData,
      include: {
        vendorParty: true,
        customerParty: true,
        contract: true,
        invoiceLineItems: true,
      },
    });

    return NextResponse.json(updatedInvoice);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Update invoice error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('invoices:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceId: params.id },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Delete invoice and all related records in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete related records first
      await tx.validationException.deleteMany({
        where: {
          validationId: {
            in: (await tx.invoiceValidation.findMany({
              where: { invoiceId: params.id },
              select: { validationId: true },
            })).map(v => v.validationId),
          },
        },
      });

      await tx.invoiceValidation.deleteMany({
        where: { invoiceId: params.id },
      });

      await tx.invoiceApprovalRequest.deleteMany({
        where: { invoiceId: params.id },
      });

      await tx.invoiceLineItem.deleteMany({
        where: { invoiceId: params.id },
      });

      await tx.documentExtractionData.deleteMany({
        where: { invoiceId: params.id },
      });

      // Finally delete the invoice
      await tx.invoice.delete({
        where: { invoiceId: params.id },
      });
    });

    return NextResponse.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

