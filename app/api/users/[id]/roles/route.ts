import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest, isSuperAdmin } from '@/lib/middleware/auth';
import { z } from 'zod';

const assignRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Super Admin bypass or check for admin:users permission
    if (!isSuperAdmin(user) && !user.permissions.includes('admin:users')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = assignRolesSchema.parse(body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { userId: params.id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify all role IDs exist
    const roles = await prisma.role.findMany({
      where: { roleId: { in: data.roleIds } },
    });

    if (roles.length !== data.roleIds.length) {
      return NextResponse.json(
        { error: 'One or more role IDs are invalid' },
        { status: 400 }
      );
    }

    // Delete existing roles
    await prisma.userRole.deleteMany({
      where: { userId: params.id },
    });

    // Add new roles
    for (const roleId of data.roleIds) {
      await prisma.userRole.create({
        data: {
          userId: params.id,
          roleId,
        },
      });
    }

    // Fetch updated user with roles
    const userWithRoles = await prisma.user.findUnique({
      where: { userId: params.id },
      include: {
        userRoles: {
          include: {
            role: {
              select: {
                roleId: true,
                roleName: true,
                roleDescription: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      message: 'Roles assigned successfully',
      user: {
        ...userWithRoles,
        roles: userWithRoles?.userRoles.map((ur) => ur.role) || [],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Assign roles error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

