import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';

const updateContractSchema = z.object({
  parentContractId: z.string().uuid().optional().nullable(),
  relationshipType: z.string().optional(),
  contractNumber: z.string().optional(),
  contractTitle: z.string().optional(),
  contractType: z.string().optional(),
  effectiveDate: z.string().transform((str) => new Date(str)).optional(),
  expirationDate: z.string().transform((str) => new Date(str)).optional(),
  autoRenewalEnabled: z.boolean().optional(),
  renewalPeriod: z.string().optional().nullable(),
  noticePeriodDays: z.number().optional().nullable(),
  totalContractValue: z.number().optional().nullable(),
  annualValue: z.number().optional().nullable(),
  currency: z.string().length(3).optional(),
  contractStatus: z.string().optional(),
  version: z.string().optional().nullable(),
  validationConfig: z.any().optional(),
  externalIds: z.any().optional(),
  legalTerms: z.any().optional(),
  serviceRequirements: z.any().optional(),
  amendmentsJson: z.any().optional(),
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

    if (!user.permissions.includes('contracts:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const contract = await prisma.contract.findUnique({
      where: { contractId: params.id },
      include: {
        parentContract: true,
        childContracts: true,
        contractParties: {
          include: {
            party: true,
          },
        },
        contractLocations: {
          include: {
            location: true,
          },
        },
        billableItems: {
          include: {
            pricingModel: {
              include: {
                pricingTiers: true,
              },
            },
            serviceCategory: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    return NextResponse.json(contract);
  } catch (error) {
    console.error('Get contract error:', error);
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

    if (!user.permissions.includes('contracts:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = updateContractSchema.parse(body);

    // Check if contract exists
    const existingContract = await prisma.contract.findUnique({
      where: { contractId: params.id },
    });

    if (!existingContract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    const contract = await prisma.contract.update({
      where: { contractId: params.id },
      data: {
        ...data,
        updatedBy: user.userId,
        updatedDate: new Date(),
      },
      include: {
        contractParties: {
          include: {
            party: true,
          },
        },
        billableItems: {
          take: 5,
          select: {
            itemName: true,
            itemCategory: true,
          },
        },
      },
    });

    return NextResponse.json(contract);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update contract error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('contracts:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if contract exists
    const existingContract = await prisma.contract.findUnique({
      where: { contractId: params.id },
      include: {
        invoices: {
          take: 1,
        },
        childContracts: {
          take: 1,
        },
      },
    });

    if (!existingContract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
    }

    // Prevent deletion if contract has invoices or child contracts
    if (existingContract.invoices.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete contract with associated invoices' },
        { status: 400 }
      );
    }

    if (existingContract.childContracts.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete contract with child contracts. Please delete or reassign child contracts first.' },
        { status: 400 }
      );
    }

    await prisma.contract.delete({
      where: { contractId: params.id },
    });

    return NextResponse.json({ message: 'Contract deleted successfully' });
  } catch (error) {
    console.error('Delete contract error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

