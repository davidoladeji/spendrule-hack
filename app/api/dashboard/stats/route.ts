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

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Today's prevented overpayments (exceptions created today with variance)
    const todayExceptions = await prisma.validationException.findMany({
      where: {
        resolved: false,
        varianceAmount: { not: null },
        validation: {
          validationDate: { gte: today },
        },
      },
      include: {
        validation: true,
      },
    });

    const todaysPreventedOverpayments = todayExceptions.reduce(
      (sum, e) => sum + (e.varianceAmount ? Number(e.varianceAmount) : 0),
      0
    );

    // Month-to-date prevented
    const monthExceptions = await prisma.validationException.findMany({
      where: {
        resolved: false,
        varianceAmount: { not: null },
        validation: {
          validationDate: { gte: startOfMonth },
        },
      },
    });

    const monthToDatePrevented = monthExceptions.reduce(
      (sum, e) => sum + (e.varianceAmount ? Number(e.varianceAmount) : 0),
      0
    );

    // YTD Realized Savings (from all validations with potential savings)
    const ytdValidations = await prisma.invoiceValidation.findMany({
      where: {
        validationDate: { gte: startOfYear },
        potentialSavings: { not: null },
      },
    });

    const ytdRealizedSavings = ytdValidations.reduce(
      (sum, v) => sum + (v.potentialSavings ? Number(v.potentialSavings) : 0),
      0
    );

    const ytdSavingsGoal = 6000000; // Configurable goal
    const ytdSavingsProgress = ytdSavingsGoal > 0 ? Math.round((ytdRealizedSavings / ytdSavingsGoal) * 100) : 0;

    // MoM change
    const lastMonthValidations = await prisma.invoiceValidation.findMany({
      where: {
        validationDate: { gte: lastMonth, lt: startOfMonth },
        potentialSavings: { not: null },
      },
    });

    const lastMonthSavings = lastMonthValidations.reduce(
      (sum, v) => sum + (v.potentialSavings ? Number(v.potentialSavings) : 0),
      0
    );

    const thisMonthSavings = ytdValidations
      .filter((v) => v.validationDate >= startOfMonth)
      .reduce((sum, v) => sum + (v.potentialSavings ? Number(v.potentialSavings) : 0), 0);

    const ytdSavingsMoMChange =
      lastMonthSavings > 0 ? Math.round(((thisMonthSavings - lastMonthSavings) / lastMonthSavings) * 100) : 0;

    // Spend monitored
    const allInvoices = await prisma.invoice.findMany({
      where: {
        createdDate: { gte: startOfYear },
      },
    });

    const totalSpend = allInvoices.reduce((sum, inv) => sum + Number(inv.grossAmount), 0);
    const monitoredInvoices = allInvoices.filter((inv) => inv.contractId !== null);
    const spendMonitored = monitoredInvoices.reduce((sum, inv) => sum + Number(inv.grossAmount), 0);
    const spendMonitoredPercent = totalSpend > 0 ? (spendMonitored / totalSpend) * 100 : 0;

    // Auto-approval rate
    const allValidations = await prisma.invoiceValidation.findMany({
      where: {
        validationDate: { gte: startOfMonth },
      },
    });

    const autoApproved = allValidations.filter((v) => v.autoApproved === true).length;
    const autoApprovalRate = allValidations.length > 0 ? (autoApproved / allValidations.length) * 100 : 0;

    // Auto-approval trend (compare to last month)
    const lastMonthValidationsForTrend = await prisma.invoiceValidation.findMany({
      where: {
        validationDate: { gte: lastMonth, lt: startOfMonth },
      },
    });

    const lastMonthAutoApproved = lastMonthValidationsForTrend.filter((v) => v.autoApproved === true).length;
    const lastMonthAutoApprovalRate =
      lastMonthValidationsForTrend.length > 0 ? (lastMonthAutoApproved / lastMonthValidationsForTrend.length) * 100 : 0;
    const autoApprovalTrend = autoApprovalRate >= lastMonthAutoApprovalRate ? 'up' : 'down';

    // Open exceptions over $10k
    const openExceptionsOver10k = await prisma.validationException.count({
      where: {
        resolved: false,
        varianceAmount: { gte: new Decimal(10000) },
      },
    });

    // Previous period exceptions over $10k (last month)
    const previousExceptionsOver10k = await prisma.validationException.count({
      where: {
        resolved: false,
        varianceAmount: { gte: new Decimal(10000) },
        validation: {
          validationDate: { gte: lastMonth, lt: startOfMonth },
        },
      },
    });

    // Savings waterfall by exception type
    const allExceptions = await prisma.validationException.findMany({
      where: {
        resolved: false,
        varianceAmount: { not: null },
        validation: {
          validationDate: { gte: startOfYear },
        },
      },
    });

    const priceVariance = allExceptions
      .filter((e) => e.exceptionType === 'Price Variance' || e.exceptionCategory === 'Pricing Validation')
      .reduce((sum, e) => sum + (e.varianceAmount ? Number(e.varianceAmount) : 0), 0);
    const quantity = allExceptions
      .filter((e) => e.exceptionType === 'Invalid Quantity' || e.exceptionCategory === 'Quantity Validation')
      .reduce((sum, e) => sum + (e.varianceAmount ? Number(e.varianceAmount) : 0), 0);
    const wrongItem = allExceptions
      .filter((e) => e.exceptionType === 'Item Not Matched' || e.exceptionType === 'Wrong Item')
      .reduce((sum, e) => sum + (e.varianceAmount ? Number(e.varianceAmount) : 0), 0);
    const duplicate = allExceptions
      .filter((e) => e.exceptionType === 'Duplicate' || e.exceptionCategory === 'Duplicate')
      .reduce((sum, e) => sum + (e.varianceAmount ? Number(e.varianceAmount) : 0), 0);
    const other = allExceptions
      .filter(
        (e) =>
          !['Price Variance', 'Invalid Quantity', 'Item Not Matched', 'Wrong Item', 'Duplicate'].includes(
            e.exceptionType
          ) && e.exceptionCategory !== 'Pricing Validation' && e.exceptionCategory !== 'Quantity Validation'
      )
      .reduce((sum, e) => sum + (e.varianceAmount ? Number(e.varianceAmount) : 0), 0);

    const savingsWaterfall = {
      priceVariance,
      quantity,
      wrongItem,
      duplicate,
      other,
      total: priceVariance + quantity + wrongItem + duplicate + other,
    };

    // Contract expirations
    const contracts = await prisma.contract.findMany({
      where: {
        contractStatus: 'Active',
      },
      include: {
        invoices: {
          where: {
            createdDate: { gte: startOfYear },
          },
        },
      },
    });

    const days90 = new Date();
    days90.setDate(days90.getDate() + 90);
    const days180 = new Date();
    days180.setDate(days180.getDate() + 180);

    const days0to90 = contracts.filter((c) => {
      const expDate = new Date(c.expirationDate);
      return expDate >= now && expDate <= days90;
    });

    const days91to180 = contracts.filter((c) => {
      const expDate = new Date(c.expirationDate);
      return expDate > days90 && expDate <= days180;
    });

    const daysOver180 = contracts.filter((c) => {
      const expDate = new Date(c.expirationDate);
      return expDate > days180;
    });

    const contractExpirations = {
      days0to90: {
        count: days0to90.length,
        totalSpend: days0to90.reduce(
          (sum, c) => sum + c.invoices.reduce((s, i) => s + Number(i.grossAmount), 0),
          0
        ),
      },
      days91to180: {
        count: days91to180.length,
        totalSpend: days91to180.reduce(
          (sum, c) => sum + c.invoices.reduce((s, i) => s + Number(i.grossAmount), 0),
          0
        ),
      },
      daysOver180: {
        count: daysOver180.length,
        totalSpend: daysOver180.reduce(
          (sum, c) => sum + c.invoices.reduce((s, i) => s + Number(i.grossAmount), 0),
          0
        ),
      },
    };

    // Critical exceptions count (High severity, unresolved)
    const criticalExceptionsCount = await prisma.validationException.count({
      where: {
        resolved: false,
        severity: 'High',
      },
    });

    // Active contracts count
    const activeContractsCount = await prisma.contract.count({
      where: {
        contractStatus: 'Active',
      },
    });

    // Compliance rate: (invoices without exceptions / total validated) * 100
    const validatedInvoices = await prisma.invoiceValidation.findMany({
      where: {
        validationDate: { gte: startOfMonth },
      },
      include: {
        validationExceptions: true,
      },
    });

    const invoicesWithoutExceptions = validatedInvoices.filter(
      (v) => !v.validationExceptions || v.validationExceptions.length === 0
    ).length;
    const totalValidated = validatedInvoices.length;
    const complianceRate = totalValidated > 0 ? (invoicesWithoutExceptions / totalValidated) * 100 : 0;

    // Compare to last month for trend
    const lastMonthValidated = await prisma.invoiceValidation.findMany({
      where: {
        validationDate: { gte: lastMonth, lt: startOfMonth },
      },
      include: {
        validationExceptions: true,
      },
    });

    const lastMonthWithoutExceptions = lastMonthValidated.filter(
      (v) => !v.validationExceptions || v.validationExceptions.length === 0
    ).length;
    const lastMonthTotal = lastMonthValidated.length;
    const lastMonthComplianceRate = lastMonthTotal > 0 ? (lastMonthWithoutExceptions / lastMonthTotal) * 100 : 0;
    const complianceTrend = complianceRate >= lastMonthComplianceRate ? 'up' : 'down';

    // Calculate compliance sparkline data (last 7 days)
    const complianceSparklineData: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayValidations = await prisma.invoiceValidation.findMany({
        where: {
          validationDate: { gte: dayStart, lt: dayEnd },
        },
        include: {
          validationExceptions: true,
        },
      });

      const dayWithoutExceptions = dayValidations.filter(
        (v) => !v.validationExceptions || v.validationExceptions.length === 0
      ).length;
      const dayTotal = dayValidations.length;
      const dayComplianceRate = dayTotal > 0 ? (dayWithoutExceptions / dayTotal) * 100 : 0;
      complianceSparklineData.push(Math.round(dayComplianceRate * 10) / 10);
    }

    return NextResponse.json({
      todaysPreventedOverpayments,
      monthToDatePrevented,
      ytdRealizedSavings,
      ytdSavingsGoal,
      ytdSavingsProgress,
      ytdSavingsMoMChange,
      spendMonitored,
      totalSpend,
      spendMonitoredPercent,
      autoApprovalRate,
      autoApprovalTrend,
      openExceptionsOver10k,
      previousExceptionsOver10k,
      savingsWaterfall,
      contractExpirations,
      criticalExceptionsCount,
      complianceRate,
      complianceTrend,
      activeContractsCount,
      complianceSparklineData,
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

