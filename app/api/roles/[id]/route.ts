import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';

const updateRoleSchema = z.object({
  roleName: z.string().min(1).optional(),
  roleDescription: z.string().optional(),
  permissions: z.array(z.string()).optional(),
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

    if (!user.permissions.includes('roles:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const role = await prisma.role.findUnique({
      where: { roleId: params.id },
      include: {
        userRoles: {
          select: {
            userId: true,
          },
        },
        rolePermissions: {
          include: {
            permission: {
              select: {
                permissionId: true,
                permissionName: true,
                resource: true,
                action: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...role,
      userCount: role.userRoles.length,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    });
  } catch (error) {
    console.error('Get role error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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

    if (!user.permissions.includes('roles:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const role = await prisma.role.findUnique({
      where: { roleId: params.id },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Prevent updating system roles
    if (role.isSystemRole) {
      return NextResponse.json(
        { error: 'Cannot update system roles' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = updateRoleSchema.parse(body);

    // Check if role name is being changed and if it already exists
    if (data.roleName && data.roleName !== role.roleName) {
      const existingRole = await prisma.role.findUnique({
        where: { roleName: data.roleName },
      });

      if (existingRole) {
        return NextResponse.json(
          { error: 'Role name already exists' },
          { status: 400 }
        );
      }
    }

    // Update role basic info
    const updateData: any = {};
    if (data.roleName) updateData.roleName = data.roleName;
    if (data.roleDescription !== undefined) updateData.roleDescription = data.roleDescription;

    await prisma.role.update({
      where: { roleId: params.id },
      data: updateData,
    });

    // Update permissions if provided
    if (data.permissions !== undefined) {
      // Remove all existing permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId: params.id },
      });

      // Add new permissions
      if (data.permissions.length > 0) {
        const permissions = await prisma.permission.findMany({
          where: {
            permissionName: {
              in: data.permissions,
            },
          },
        });

        await prisma.rolePermission.createMany({
          data: permissions.map((perm) => ({
            roleId: params.id,
            permissionId: perm.permissionId,
          })),
        });
      }
    }

    // Fetch updated role
    const updatedRole = await prisma.role.findUnique({
      where: { roleId: params.id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return NextResponse.json(updatedRole);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update role error:', error);
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

    if (!user.permissions.includes('roles:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const role = await prisma.role.findUnique({
      where: { roleId: params.id },
      include: {
        userRoles: true,
      },
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Prevent deleting system roles
    if (role.isSystemRole) {
      return NextResponse.json(
        { error: 'Cannot delete system roles' },
        { status: 400 }
      );
    }

    // Check if role is assigned to any users
    if (role.userRoles.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete role that is assigned to users' },
        { status: 400 }
      );
    }

    await prisma.role.delete({
      where: { roleId: params.id },
    });

    return NextResponse.json({ message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Delete role error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

