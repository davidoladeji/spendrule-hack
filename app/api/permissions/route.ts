import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';

const createPermissionSchema = z.object({
  permissionName: z.string().min(1),
  resource: z.string().min(1),
  action: z.string().min(1),
  description: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes('permissions:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const permissions = await prisma.permission.findMany({
      include: {
        rolePermissions: {
          include: {
            role: {
              select: {
                roleId: true,
                roleName: true,
                roleDescription: true,
                isSystemRole: true,
              },
            },
          },
        },
      },
      orderBy: [
        { resource: 'asc' },
        { action: 'asc' },
      ],
    });

    const permissionsWithCounts = permissions.map((perm) => ({
      permissionId: perm.permissionId,
      permissionName: perm.permissionName,
      resource: perm.resource,
      action: perm.action,
      description: perm.description,
      roleCount: perm.rolePermissions.length,
      roles: perm.rolePermissions.map(rp => rp.role),
    }));

    // Group by resource
    const groupedByResource = permissionsWithCounts.reduce((acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push(perm);
      return acc;
    }, {} as Record<string, typeof permissionsWithCounts>);

    return NextResponse.json({
      permissions: permissionsWithCounts,
      groupedByResource,
    });
  } catch (error) {
    console.error('Get permissions error:', error);
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

    if (!user.permissions.includes('permissions:create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = createPermissionSchema.parse(body);

    // Check if permission name already exists
    const existingPermission = await prisma.permission.findUnique({
      where: { permissionName: data.permissionName },
    });

    if (existingPermission) {
      return NextResponse.json(
        { error: 'Permission name already exists' },
        { status: 400 }
      );
    }

    // Create permission
    const permission = await prisma.permission.create({
      data: {
        permissionName: data.permissionName,
        resource: data.resource,
        action: data.action,
        description: data.description,
      },
    });

    return NextResponse.json(permission, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create permission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

