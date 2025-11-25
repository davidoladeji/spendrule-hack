import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';

const createRoleSchema = z.object({
  roleName: z.string().min(1),
  roleDescription: z.string().optional(),
  isSystemRole: z.boolean().default(false),
  permissions: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('roles:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const roles = await prisma.role.findMany({
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
      orderBy: { createdAt: 'desc' },
    });

    const rolesWithCounts = roles.map((role) => ({
      roleId: role.roleId,
      roleName: role.roleName,
      roleDescription: role.roleDescription,
      isSystemRole: role.isSystemRole,
      createdAt: role.createdAt,
      userCount: role.userRoles.length,
      permissionCount: role.rolePermissions.length,
      permissions: role.rolePermissions.map((rp) => rp.permission),
    }));

    return NextResponse.json({ roles: rolesWithCounts });
  } catch (error) {
    console.error('Get roles error:', error);
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

    if (!user.permissions.includes('roles:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = createRoleSchema.parse(body);

    // Check if role name already exists
    const existingRole = await prisma.role.findUnique({
      where: { roleName: data.roleName },
    });

    if (existingRole) {
      return NextResponse.json(
        { error: 'Role name already exists' },
        { status: 400 }
      );
    }

    // Create role
    const role = await prisma.role.create({
      data: {
        roleName: data.roleName,
        roleDescription: data.roleDescription,
        isSystemRole: data.isSystemRole,
      },
    });

    // Assign permissions if provided
    if (data.permissions && data.permissions.length > 0) {
      const permissions = await prisma.permission.findMany({
        where: {
          permissionName: {
            in: data.permissions,
          },
        },
      });

      await prisma.rolePermission.createMany({
        data: permissions.map((perm) => ({
          roleId: role.roleId,
          permissionId: perm.permissionId,
        })),
        skipDuplicates: true,
      });
    }

    // Fetch created role with permissions
    const roleWithPermissions = await prisma.role.findUnique({
      where: { roleId: role.roleId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return NextResponse.json(roleWithPermissions, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create role error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

