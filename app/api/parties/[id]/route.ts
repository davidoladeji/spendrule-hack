import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';

const updatePartySchema = z.object({
  legalName: z.string().optional(),
  tradingName: z.string().optional(),
  partyNumber: z.string().optional(),
  taxId: z.string().optional(),
  dunsNumber: z.string().optional(),
  npiNumber: z.string().optional(),
  cageCode: z.string().optional(),
  primaryContactEmail: z.string().email().optional(),
  primaryContactPhone: z.string().optional(),
  partyStatus: z.string().optional(),
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

    if (!user.permissions.includes('parties:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const party = await prisma.party.findUnique({
      where: { partyId: params.id },
      include: {
        contractParties: {
          include: {
            contract: true,
          },
        },
        invoicesAsVendor: {
          take: 10,
          orderBy: { createdDate: 'desc' },
        },
        invoicesAsCustomer: {
          take: 10,
          orderBy: { createdDate: 'desc' },
        },
      },
    });

    if (!party) {
      return NextResponse.json({ error: 'Party not found' }, { status: 404 });
    }

    return NextResponse.json(party);
  } catch (error) {
    console.error('Get party error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Get party error details:', {
      partyId: params.id,
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
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

    if (!user.permissions.includes('parties:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = updatePartySchema.parse(body);

    const party = await prisma.party.update({
      where: { partyId: params.id },
      data: {
        ...data,
        updatedBy: user.userId,
        updatedDate: new Date(),
      },
    });

    return NextResponse.json(party);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update party error:', error);
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

    if (!user.permissions.includes('parties:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.party.delete({
      where: { partyId: params.id },
    });

    return NextResponse.json({ message: 'Party deleted successfully' });
  } catch (error) {
    console.error('Delete party error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

