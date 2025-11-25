import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest, isSuperAdmin } from '@/lib/middleware/auth';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Super Admin bypass or check for admin:audit permission
    if (!isSuperAdmin(user) && !user.permissions.includes('admin:audit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const tableName = searchParams.get('tableName');
    const recordId = searchParams.get('recordId');
    const action = searchParams.get('action');
    const changedBy = searchParams.get('changedBy');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};

    if (tableName) {
      where.tableName = tableName;
    }

    if (recordId) {
      where.recordId = recordId;
    }

    if (action) {
      where.action = action;
    }

    if (changedBy) {
      where.changedBy = changedBy;
    }

    if (startDate || endDate) {
      where.changedDate = {};
      if (startDate) {
        where.changedDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.changedDate.lte = new Date(endDate);
      }
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { changedDate: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

