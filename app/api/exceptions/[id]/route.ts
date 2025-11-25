import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';

const resolveExceptionSchema = z.object({
  resolved: z.boolean(),
  resolutionNotes: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('exceptions:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.log('Fetching exception with ID:', params.id);

    const exception = await prisma.validationException.findUnique({
      where: { exceptionId: params.id },
      include: {
        validation: {
          include: {
            invoice: {
              include: {
                vendorParty: true,
                contract: {
                  include: {
                    documentExtractions: {
                      where: {
                        contractId: { not: null },
                      },
                      take: 1,
                    },
                  },
                },
                sourceDocument: true,
              },
            },
            invoiceApprovalRequests: {
              include: {
                approvalLevel: true,
              },
              orderBy: { createdDate: 'desc' },
            },
          },
        },
        contractExtraction: {
          include: {
            document: true,
          },
        },
        invoiceExtraction: {
          include: {
            document: true,
          },
        },
      },
    });

    if (!exception) {
      console.log('Exception not found for ID:', params.id);
      // Check if any exceptions exist to help debug
      const exceptionCount = await prisma.validationException.count();
      console.log('Total exceptions in database:', exceptionCount);
      if (exceptionCount > 0) {
        const firstException = await prisma.validationException.findFirst({
          select: { exceptionId: true },
        });
        console.log('Example exception ID:', firstException?.exceptionId);
      }
      return NextResponse.json({ 
        error: 'Exception not found',
        exceptionId: params.id,
        totalExceptions: exceptionCount,
      }, { status: 404 });
    }

    // Calculate due date (detection date + SLA days, default 7)
    const SLA_DAYS = 7;
    const detectionDate = exception.validation.validationDate;
    const dueDate = new Date(detectionDate);
    dueDate.setDate(dueDate.getDate() + SLA_DAYS);

    // Get vendor intelligence
    const vendorId = exception.validation.invoice.vendorParty?.partyId;
    let vendorIntelligence = null;

    if (vendorId) {
      // Count exceptions for this vendor
      const vendorExceptions = await prisma.validationException.findMany({
        where: {
          validation: {
            invoice: {
              vendorPartyId: vendorId,
            },
          },
          resolved: false,
        },
        include: {
          validation: true,
        },
      });

      const totalImpact = vendorExceptions.reduce(
        (sum, e) => sum + (e.varianceAmount ? Number(e.varianceAmount) : 0),
        0
      );

      const exceptionCount = vendorExceptions.length;
      const riskScore = Math.min(100, (exceptionCount * 10) + (totalImpact > 100000 ? 30 : 0));

      vendorIntelligence = {
        exceptionCount,
        totalImpact,
        riskScore,
        recommendation: riskScore > 70 ? 'High Risk - Review contract terms' : riskScore > 40 ? 'Medium Risk - Monitor closely' : 'Low Risk',
      };
    }

    // Get all validations for this invoice to show validation details
    const allValidations = await prisma.invoiceValidation.findMany({
      where: {
        invoiceId: exception.validation.invoiceId,
      },
      include: {
        validationExceptions: {
          select: {
            exceptionId: true,
            exceptionType: true,
            severity: true,
            resolved: true,
          },
        },
      },
      orderBy: { validationDate: 'desc' },
    });

    // Build audit trail from validation and approval records
    interface AuditTrailEntry {
      date: Date | string;
      user: string;
      action: string;
    }
    
    const auditTrail: AuditTrailEntry[] = [];
    
    // Add validation entries
    allValidations.forEach((val) => {
      auditTrail.push({
        date: val.validationDate,
        user: 'System',
        action: `Validation performed - Status: ${val.overallStatus}`,
      });
    });

    // Add approval request entries
    exception.validation.invoiceApprovalRequests?.forEach((req) => {
      auditTrail.push({
        date: req.createdDate,
        user: req.createdBy || 'System',
        action: `Approval request created - Level ${req.currentLevel}, Status: ${req.currentStatus}`,
      });
      if (req.decidedDate) {
        auditTrail.push({
          date: req.decidedDate,
          user: req.decidedBy || 'Unknown',
          action: `Decision: ${req.decision || 'N/A'}`,
        });
      }
    });

    // Sort audit trail by date
    auditTrail.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
      ...exception,
      dueDate: dueDate.toISOString(),
      vendorIntelligence,
      allValidations: allValidations.map((v) => ({
        validationId: v.validationId,
        validationDate: v.validationDate,
        overallStatus: v.overallStatus,
        exceptions: v.validationExceptions,
        rulesAppliedCount: v.rulesAppliedCount,
      })),
      auditTrail,
    });
  } catch (error) {
    console.error('Get exception error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('exceptions:resolve')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = resolveExceptionSchema.parse(body);

    const exception = await prisma.validationException.update({
      where: { exceptionId: params.id },
      data: {
        ...data,
        resolvedBy: user.userId,
        resolvedDate: data.resolved ? new Date() : null,
      },
    });

    return NextResponse.json(exception);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Update exception error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

