import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { Decimal } from '@prisma/client/runtime/library';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('dashboard:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get top exceptions ordered by: severity (High > Medium > Low), due date, impact
    const exceptions = await prisma.validationException.findMany({
      where: {
        resolved: false,
      },
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
      },
      orderBy: [
        {
          severity: 'desc', // High, Medium, Low
        },
        {
          varianceAmount: 'desc', // Highest impact first
        },
      ],
      take: 20, // Top 20 priority items
    });

    // Calculate due dates (detection date + SLA days, default 7 days)
    const SLA_DAYS = 7;
    const now = new Date();

    const priorityQueue = exceptions.map((exception) => {
      const detectionDate = exception.validation.validationDate;
      const dueDate = new Date(detectionDate);
      dueDate.setDate(dueDate.getDate() + SLA_DAYS);
      
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isUrgent = daysUntilDue <= 2;

      // Determine priority based on severity
      const priorityMap: Record<string, 'high' | 'medium' | 'low'> = {
        High: 'high',
        Medium: 'medium',
        Low: 'low',
      };

      return {
        exceptionId: exception.exceptionId,
        priority: priorityMap[exception.severity] || 'low',
        type: exception.exceptionType,
        vendor: {
          partyId: exception.validation.invoice.vendorParty?.partyId,
          name: exception.validation.invoice.vendorParty?.legalName || 'Unknown Vendor',
        },
        issue: exception.message,
        impact: exception.varianceAmount ? Number(exception.varianceAmount) : 0,
        dueDate: dueDate.toISOString(),
        daysUntilDue,
        isUrgent,
        severity: exception.severity,
        invoiceId: exception.validation.invoice.invoiceId,
        invoiceNumber: exception.validation.invoice.invoiceNumber,
      };
    });

    return NextResponse.json({ queue: priorityQueue });
  } catch (error) {
    console.error('Get priority queue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

