import { prisma } from './db';
import { Decimal } from '@prisma/client/runtime/library';

export async function createApprovalRequest(
  invoiceId: string,
  validationId: string,
  userId: string
): Promise<string> {
  // Get invoice and validation
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceId },
    include: {
      invoiceValidations: {
        where: { validationId },
        include: {
          validationExceptions: true,
        },
      },
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const validation = invoice.invoiceValidations[0];
  if (!validation) {
    throw new Error('Validation not found');
  }

  // Calculate total exception amount
  const totalExceptionAmount = validation.validationExceptions.reduce(
    (sum, exc) => sum.plus(exc.varianceAmount || new Decimal(0)),
    new Decimal(0)
  );

  // Determine approval level based on amount
  const approvalLevel = await prisma.approvalLevel.findFirst({
    where: {
      isActive: true,
      minAmount: { lte: totalExceptionAmount },
      OR: [
        { maxAmount: { gte: totalExceptionAmount } },
        { maxAmount: null },
      ],
    },
    orderBy: { approvalSequence: 'desc' },
  });

  if (!approvalLevel) {
    throw new Error('No approval level found for this amount');
  }

  // Calculate required by date (escalation days from now)
  const requiredByDate = new Date();
  requiredByDate.setDate(requiredByDate.getDate() + approvalLevel.escalationDays);

  // Create approval request
  const approvalRequest = await prisma.invoiceApprovalRequest.create({
    data: {
      invoiceId,
      validationId,
      currentLevel: approvalLevel.levelId,
      currentStatus: 'Pending',
      requiredByDate,
      assignedToRole: approvalLevel.requiresRole,
      createdBy: userId,
    },
  });

  // Create initial history entry
  await prisma.invoiceApprovalHistory.create({
    data: {
      approvalId: approvalRequest.approvalId,
      statusFrom: null,
      statusTo: 'Pending',
      changedBy: userId,
      comment: `Approval request created for ${totalExceptionAmount.toString()} in exceptions`,
    },
  });

  return approvalRequest.approvalId;
}

export async function autoCreateApprovalRequests(
  validationId: string,
  userId: string
): Promise<void> {
  const validation = await prisma.invoiceValidation.findUnique({
    where: { validationId },
    include: {
      invoice: true,
      validationExceptions: {
        where: {
          resolved: false,
          severity: { in: ['High', 'Medium'] },
        },
      },
    },
  });

  if (!validation) {
    return;
  }

  // Only create approval request if there are unresolved exceptions
  if (validation.validationExceptions.length > 0) {
    await createApprovalRequest(validation.invoiceId, validationId, userId);
  }
}

export async function escalateApprovalRequest(
  approvalId: string,
  userId: string
): Promise<void> {
  const approval = await prisma.invoiceApprovalRequest.findUnique({
    where: { approvalId },
    include: {
      approvalLevel: true,
      invoice: true,
    },
  });

  if (!approval) {
    throw new Error('Approval request not found');
  }

  // Find next approval level
  const nextLevel = await prisma.approvalLevel.findFirst({
    where: {
      isActive: true,
      approvalSequence: { gt: approval.approvalLevel.approvalSequence },
    },
    orderBy: { approvalSequence: 'asc' },
  });

  if (!nextLevel) {
    // Already at highest level, mark as requiring manual intervention
    await prisma.invoiceApprovalRequest.update({
      where: { approvalId },
      data: {
        currentStatus: 'Escalated',
        escalationCount: approval.escalationCount + 1,
      },
    });

    await prisma.invoiceApprovalHistory.create({
      data: {
        approvalId,
        statusFrom: approval.currentStatus,
        statusTo: 'Escalated',
        changedBy: userId,
        comment: 'Escalated to highest level - requires manual intervention',
      },
    });
    return;
  }

  // Update to next level
  const newRequiredByDate = new Date();
  newRequiredByDate.setDate(newRequiredByDate.getDate() + nextLevel.escalationDays);

  await prisma.invoiceApprovalRequest.update({
    where: { approvalId },
    data: {
      currentLevel: nextLevel.levelId,
      currentStatus: 'Pending',
      requiredByDate: newRequiredByDate,
      assignedToRole: nextLevel.requiresRole,
      escalationCount: approval.escalationCount + 1,
    },
  });

  await prisma.invoiceApprovalHistory.create({
    data: {
      approvalId,
      statusFrom: approval.currentStatus,
      statusTo: 'Pending',
      changedBy: userId,
      comment: `Escalated to ${nextLevel.levelName}`,
    },
  });
}

export async function checkAndEscalateOverdueApprovals(): Promise<void> {
  const now = new Date();
  const overdueApprovals = await prisma.invoiceApprovalRequest.findMany({
    where: {
      currentStatus: 'Pending',
      requiredByDate: { lt: now },
    },
    include: {
      approvalLevel: true,
    },
  });

  for (const approval of overdueApprovals) {
    // Auto-escalate if overdue
    await escalateApprovalRequest(approval.approvalId, 'system');
  }
}

