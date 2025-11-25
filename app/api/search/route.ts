import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const searchTerm = query.toLowerCase();

    // Search contracts
    const contracts = await prisma.contract.findMany({
      where: {
        OR: [
          { contractNumber: { contains: query, mode: 'insensitive' } },
          { contractTitle: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: {
        contractId: true,
        contractNumber: true,
        contractTitle: true,
        contractStatus: true,
      },
    });

    // Search invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: {
        invoiceId: true,
        invoiceNumber: true,
        grossAmount: true,
        currency: true,
        vendorParty: {
          select: {
            legalName: true,
          },
        },
      },
    });

    // Search exceptions
    const exceptions = await prisma.validationException.findMany({
      where: {
        OR: [
          { exceptionType: { contains: query, mode: 'insensitive' } },
          { message: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: {
        exceptionId: true,
        exceptionType: true,
        severity: true,
        message: true,
        validation: {
          select: {
            invoice: {
              select: {
                invoiceNumber: true,
                vendorParty: {
                  select: {
                    legalName: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Search parties/vendors
    const parties = await prisma.party.findMany({
      where: {
        OR: [
          { legalName: { contains: query, mode: 'insensitive' } },
          { tradingName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: {
        partyId: true,
        legalName: true,
        tradingName: true,
        partyType: true,
      },
    });

    // Format results
    const results = {
      contracts: contracts.map((c) => ({
        id: c.contractId,
        type: 'contract',
        title: c.contractNumber,
        subtitle: c.contractTitle || '',
        status: c.contractStatus,
        url: `/contracts/${c.contractId}`,
      })),
      invoices: invoices.map((i) => ({
        id: i.invoiceId,
        type: 'invoice',
        title: i.invoiceNumber,
        subtitle: i.vendorParty?.legalName || '',
        amount: `${i.currency} ${i.grossAmount.toLocaleString()}`,
        url: `/invoices/${i.invoiceId}`,
      })),
      exceptions: exceptions.map((e) => ({
        id: e.exceptionId,
        type: 'exception',
        title: e.exceptionType,
        subtitle: e.validation.invoice.invoiceNumber || '',
        severity: e.severity,
        url: `/exceptions/${e.exceptionId}`,
      })),
      parties: parties.map((p) => ({
        id: p.partyId,
        type: 'party',
        title: p.legalName,
        subtitle: p.tradingName || p.partyType,
        url: `/parties/${p.partyId}`,
      })),
    };

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

