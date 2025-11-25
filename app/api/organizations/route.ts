import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest, isSuperAdmin } from '@/lib/middleware/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Super Admin can see all organizations, others see only their own
    const where = isSuperAdmin(user) ? {} : { organizationId: user.organizationId };

    const organizations = await prisma.organization.findMany({
      where,
      select: {
        organizationId: true,
        name: true,
        type: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ organizations });
  } catch (error) {
    console.error('Get organizations error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

