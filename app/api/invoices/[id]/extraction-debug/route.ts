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

    if (!user.permissions.includes('invoices:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get invoice with all related data
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceId: params.id },
      include: {
        vendorParty: true,
        customerParty: true,
        sourceDocument: {
          include: {
            documentExtractions: {
              orderBy: [
                { sourcePageNumber: 'asc' },
                { fieldName: 'asc' },
              ],
            },
          },
        },
        invoiceLineItems: {
          orderBy: { lineNumber: 'asc' },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get extraction data from document
    const extractionData = invoice.sourceDocument?.documentExtractions || [];

    // Format for debugging
    const debugInfo = {
      invoice: {
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        grossAmount: invoice.grossAmount ? Number(invoice.grossAmount) : null,
        netServiceAmount: invoice.netServiceAmount ? Number(invoice.netServiceAmount) : null,
        taxAmount: invoice.taxAmount ? Number(invoice.taxAmount) : null,
        currency: invoice.currency,
        vendorParty: invoice.vendorParty ? {
          partyId: invoice.vendorParty.partyId,
          legalName: invoice.vendorParty.legalName,
          tradingName: invoice.vendorParty.tradingName,
        } : null,
        customerParty: invoice.customerParty ? {
          partyId: invoice.customerParty.partyId,
          legalName: invoice.customerParty.legalName,
        } : null,
      },
      sourceDocument: invoice.sourceDocument ? {
        documentId: invoice.sourceDocument.documentId,
        documentName: invoice.sourceDocument.documentName,
        documentUrl: invoice.sourceDocument.documentUrl,
        ocrCompleted: invoice.sourceDocument.ocrCompleted,
        extractionCompleted: invoice.sourceDocument.extractionCompleted,
        processingStatus: invoice.sourceDocument.processingStatus,
        processingError: invoice.sourceDocument.processingError,
      } : null,
      extractionData: extractionData.map(ext => ({
        fieldName: ext.fieldName,
        extractedValue: ext.extractedValue,
        normalizedValue: ext.normalizedValue,
        confidenceScore: ext.confidenceScore ? Number(ext.confidenceScore) : null,
        sourcePageNumber: ext.sourcePageNumber,
        textSnippet: ext.textSnippet,
        requiresHumanReview: ext.requiresHumanReview,
      })),
      lineItems: invoice.invoiceLineItems.map(item => ({
        lineNumber: item.lineNumber,
        description: item.description,
        quantity: item.invoiceQuantity ? Number(item.invoiceQuantity) : null,
        unitPrice: item.invoiceUnitPrice ? Number(item.invoiceUnitPrice) : null,
        extendedAmount: item.extendedAmount ? Number(item.extendedAmount) : null,
      })),
    };

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error) {
    console.error('Extraction debug error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

