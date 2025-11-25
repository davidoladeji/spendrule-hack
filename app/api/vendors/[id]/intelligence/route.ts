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

    if (!user.permissions.includes('reports:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get vendor invoices and exceptions
    const invoices = await prisma.invoice.findMany({
      where: { vendorPartyId: params.id },
      include: {
        invoiceValidations: {
          include: {
            validationExceptions: true,
          },
        },
      },
    });

    // Calculate metrics
    const totalInvoices = invoices.length;
    const totalExceptions = invoices.reduce(
      (sum, inv) =>
        sum +
        inv.invoiceValidations.reduce(
          (s, v) => s + v.validationExceptions.length,
          0
        ),
      0
    );
    const errorRate = totalInvoices > 0 ? (totalExceptions / totalInvoices) * 100 : 0;

    // Calculate on-time percentage (simplified - would check against payment dates)
    const onTimeInvoices = invoices.filter(
      (inv) => inv.currentStatus === 'Approved' || inv.currentStatus === 'Paid'
    ).length;
    const onTimePercentage = totalInvoices > 0 ? (onTimeInvoices / totalInvoices) * 100 : 0;

    // Calculate average variance
    const allVariances = invoices.flatMap((inv) =>
      inv.invoiceValidations.flatMap((v) =>
        v.validationExceptions
          .map((e) => Number(e.varianceAmount || 0))
          .filter((v) => v !== 0)
      )
    );
    const avgVariance =
      allVariances.length > 0
        ? allVariances.reduce((sum, v) => sum + v, 0) / allVariances.length
        : 0;

    // Pattern detection - find recurring exception types
    const exceptionTypes = invoices.flatMap((inv) =>
      inv.invoiceValidations.flatMap((v) =>
        v.validationExceptions.map((e) => e.exceptionType)
      )
    );

    const patternCounts: Record<string, number> = {};
    exceptionTypes.forEach((type) => {
      patternCounts[type] = (patternCounts[type] || 0) + 1;
    });

    const recurringPatterns = Object.entries(patternCounts)
      .filter(([_, count]) => count >= 3)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Calculate risk score (0-1, higher is riskier)
    const riskScore = Math.min(
      1,
      (errorRate / 100) * 0.4 + (1 - onTimePercentage / 100) * 0.3 + Math.min(avgVariance / 10000, 1) * 0.3
    );

    // Get total impact
    const totalImpact = allVariances.reduce((sum, v) => sum + Math.abs(v), 0);

    return NextResponse.json({
      vendorId: params.id,
      metrics: {
        totalInvoices,
        totalExceptions,
        errorRate: errorRate.toFixed(2),
        onTimePercentage: onTimePercentage.toFixed(2),
        avgVariance: avgVariance.toFixed(2),
        totalImpact,
      },
      riskScore: riskScore.toFixed(2),
      riskLevel: riskScore > 0.7 ? 'High' : riskScore > 0.4 ? 'Medium' : 'Low',
      recurringPatterns,
      scorecard: {
        errorRate: errorRate < 5 ? 'Excellent' : errorRate < 15 ? 'Good' : errorRate < 30 ? 'Fair' : 'Poor',
        onTimePerformance: onTimePercentage > 95 ? 'Excellent' : onTimePercentage > 85 ? 'Good' : onTimePercentage > 70 ? 'Fair' : 'Poor',
        varianceControl: avgVariance < 100 ? 'Excellent' : avgVariance < 500 ? 'Good' : avgVariance < 1000 ? 'Fair' : 'Poor',
      },
    });
  } catch (error) {
    console.error('Get vendor intelligence error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

