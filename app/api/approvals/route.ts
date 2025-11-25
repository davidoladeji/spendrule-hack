import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { createApprovalRequest } from '@/lib/approval-workflow';
import { z } from 'zod';

const createApprovalSchema = z.object({
  invoiceId: z.string(),
  validationId: z.string(),
});

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const status = searchParams.get('status');
    const assignedToUser = searchParams.get('assignedToUser');

    const where: any = {};

    if (status) {
      where.currentStatus = status;
    }

    if (assignedToUser) {
      where.assignedToUser = assignedToUser;
    } else {
      // Show approvals assigned to current user or their role
      where.OR = [
        { assignedToUser: user.userId },
        { assignedToRole: { in: user.roles } },
      ];
    }

    const [approvals, total] = await Promise.all([
      prisma.invoiceApprovalRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdDate: 'desc' },
        include: {
          invoice: {
            include: {
              vendorParty: true,
            },
          },
          validation: {
            include: {
              validationExceptions: true,
            },
          },
          approvalLevel: true,
        },
      }),
      prisma.invoiceApprovalRequest.count({ where }),
    ]);

    return NextResponse.json({
      approvals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get approvals error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('approvals:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = createApprovalSchema.parse(body);

    const approvalId = await createApprovalRequest(
      data.invoiceId,
      data.validationId,
      user.userId
    );

    const approval = await prisma.invoiceApprovalRequest.findUnique({
      where: { approvalId },
      include: {
        invoice: {
          include: {
            vendorParty: true,
          },
        },
        approvalLevel: true,
      },
    });

    return NextResponse.json(approval, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create approval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
