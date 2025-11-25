import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';

const approveRequestSchema = z.object({
  decision: z.enum(['Approve', 'Reject', 'Dispute', 'Escalate']),
  approvedAmount: z.number().optional(),
  rejectionReason: z.string().optional(),
  comments: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const data = approveRequestSchema.parse(body);

    const approval = await prisma.invoiceApprovalRequest.findUnique({
      where: { approvalId: params.id },
    });

    if (!approval) {
      return NextResponse.json({ error: 'Approval request not found' }, { status: 404 });
    }

    // Check if user has permission to approve
    const canApprove = user.permissions.includes('approvals:approve') ||
      user.permissions.includes('approvals:reject') ||
      user.permissions.includes('approvals:escalate');

    if (!canApprove) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update approval request
    const updatedApproval = await prisma.invoiceApprovalRequest.update({
      where: { approvalId: params.id },
      data: {
        decision: data.decision,
        decidedBy: user.userId,
        decidedDate: new Date(),
        approvedAmount: data.approvedAmount,
        rejectionReason: data.rejectionReason,
        comments: data.comments,
        currentStatus: data.decision === 'Approve' ? 'Approved' : data.decision === 'Reject' ? 'Rejected' : 'Pending',
      },
    });

    // Create history entry
    await prisma.invoiceApprovalHistory.create({
      data: {
        approvalId: params.id,
        statusFrom: approval.currentStatus,
        statusTo: updatedApproval.currentStatus,
        changedBy: user.userId,
        amountChange: data.approvedAmount ? data.approvedAmount - (approval.approvedAmount?.toNumber() || 0) : null,
        comment: data.comments,
      },
    });

    return NextResponse.json(updatedApproval);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update approval error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

