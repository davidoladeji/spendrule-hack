import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest, isSuperAdmin } from '@/lib/middleware/auth';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  isActive: z.boolean().optional(),
  roleIds: z.array(z.string().uuid()).optional(),
  organizationId: z.string().uuid().optional(),
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

    // Super Admin bypass or check for admin:users permission
    if (!isSuperAdmin(user) && !user.permissions.includes('admin:users')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userData = await prisma.user.findUnique({
      where: { userId: params.id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        organization: true,
      },
    });

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Collect all permissions from user's roles
    const permissionsSet = new Set<string>();
    for (const userRole of userData.userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissionsSet.add(rolePermission.permission.permissionName);
      }
    }

    return NextResponse.json({
      ...userData,
      roles: userData.userRoles.map((ur) => ur.role),
      permissions: Array.from(permissionsSet),
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const data = updateUserSchema.parse(body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { userId: params.id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if email is being changed and if it's already taken
    if (data.email && data.email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailTaken) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        );
      }
    }

    // Update user fields
    const updateData: any = {};
    if (data.email !== undefined) updateData.email = data.email;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.organizationId !== undefined) updateData.organizationId = data.organizationId;

    // Update user fields if any are provided
    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { userId: params.id },
        data: updateData,
      });
    }

    // Update roles if provided
    if (data.roleIds) {
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
        organization: true,
      },
    });

    if (!userWithRoles) {
      return NextResponse.json(
        { error: 'User not found after update' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      userId: userWithRoles.userId,
      email: userWithRoles.email,
      firstName: userWithRoles.firstName,
      lastName: userWithRoles.lastName,
      isActive: userWithRoles.isActive,
      lastLogin: userWithRoles.lastLogin,
      createdAt: userWithRoles.createdAt,
      organizationId: userWithRoles.organizationId,
      organization: userWithRoles.organization ? {
        organizationId: userWithRoles.organization.organizationId,
        name: userWithRoles.organization.name,
      } : null,
      roles: userWithRoles.userRoles.map((ur) => ur.role) || [],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update user error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
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

    // Super Admin bypass or check for admin:users permission
    if (!isSuperAdmin(user) && !user.permissions.includes('admin:users')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { userId: params.id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent deleting yourself
    if (existingUser.userId === user.userId) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Soft delete: set isActive to false
    const deactivatedUser = await prisma.user.update({
      where: { userId: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({
      message: 'User deactivated successfully',
      user: deactivatedUser,
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

