import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('exceptions:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const severity = searchParams.get('severity');
    const resolved = searchParams.get('resolved');
    const invoiceId = searchParams.get('invoiceId');

    const where: any = {};

    if (severity) {
      where.severity = severity;
    }

    if (resolved !== null) {
      where.resolved = resolved === 'true';
    }

    if (invoiceId) {
      where.validation = {
        invoiceId,
      };
    }

    const [exceptions, total] = await Promise.all([
      prisma.validationException.findMany({
        where,
        skip,
        take: limit,
        orderBy: { severity: 'desc' },
        include: {
          validation: {
            include: {
              invoice: {
                include: {
                  vendorParty: {
                    select: {
                      partyId: true,
                      legalName: true,
                    },
                  },
                },
              },
            },
          },
          contractExtraction: true,
          invoiceExtraction: true,
        },
      }),
      prisma.validationException.count({ where }),
    ]);

    return NextResponse.json({
      exceptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get exceptions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

