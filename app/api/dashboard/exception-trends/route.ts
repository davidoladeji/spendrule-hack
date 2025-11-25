import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('dashboard:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get last 90 days of exception data
    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const exceptions = await prisma.validationException.findMany({
      where: {
        validation: {
          validationDate: { gte: ninetyDaysAgo },
        },
      },
      include: {
        validation: {
          select: {
            validationDate: true,
          },
        },
      },
    });

    // Group by date and severity
    const dailyCounts: Record<string, { high: number; medium: number; low: number }> = {};

    exceptions.forEach((exception) => {
      const date = new Date(exception.validation.validationDate);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

      if (!dailyCounts[dateKey]) {
        dailyCounts[dateKey] = { high: 0, medium: 0, low: 0 };
      }

      if (exception.severity === 'High') {
        dailyCounts[dateKey].high++;
      } else if (exception.severity === 'Medium') {
        dailyCounts[dateKey].medium++;
      } else {
        dailyCounts[dateKey].low++;
      }
    });

    // Convert to array and format for chart
    const trends = Object.entries(dailyCounts)
      .map(([date, counts]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: date,
        high: counts.high,
        medium: counts.medium,
        low: counts.low,
      }))
      .sort((a, b) => a.fullDate.localeCompare(b.fullDate));

    return NextResponse.json({ trends });
  } catch (error) {
    console.error('Get exception trends error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

