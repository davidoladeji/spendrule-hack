import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest } from '@/lib/middleware/auth';
import { z } from 'zod';

const updatePermissionSchema = z.object({
  permissionName: z.string().min(1).optional(),
  resource: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  description: z.string().optional(),
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

    if (!user.permissions.includes('permissions:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const permission = await prisma.permission.findUnique({
      where: { permissionId: params.id },
      include: {
        rolePermissions: {
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

    if (!permission) {
      return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...permission,
      roles: permission.rolePermissions.map((rp) => rp.role),
      roleCount: permission.rolePermissions.length,
    });
  } catch (error) {
    console.error('Get permission error:', error);
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

    if (!user.permissions.includes('permissions:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const permission = await prisma.permission.findUnique({
      where: { permissionId: params.id },
    });

    if (!permission) {
      return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
    }

    const body = await request.json();
    const data = updatePermissionSchema.parse(body);

    // Check if permission name is being changed and if it already exists
    if (data.permissionName && data.permissionName !== permission.permissionName) {
      const existingPermission = await prisma.permission.findUnique({
        where: { permissionName: data.permissionName },
      });

      if (existingPermission) {
        return NextResponse.json(
          { error: 'Permission name already exists' },
          { status: 400 }
        );
      }
    }

    // Update permission
    const updateData: any = {};
    if (data.permissionName) updateData.permissionName = data.permissionName;
    if (data.resource) updateData.resource = data.resource;
    if (data.action) updateData.action = data.action;
    if (data.description !== undefined) updateData.description = data.description;

    const updatedPermission = await prisma.permission.update({
      where: { permissionId: params.id },
      data: updateData,
    });

    return NextResponse.json(updatedPermission);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update permission error:', error);
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

    if (!user.permissions.includes('permissions:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const permission = await prisma.permission.findUnique({
      where: { permissionId: params.id },
      include: {
        rolePermissions: true,
      },
    });

    if (!permission) {
      return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
    }

    // Check if permission is assigned to any roles
    if (permission.rolePermissions.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete permission that is assigned to roles' },
        { status: 400 }
      );
    }

    await prisma.permission.delete({
      where: { permissionId: params.id },
    });

    return NextResponse.json({ message: 'Permission deleted successfully' });
  } catch (error) {
    console.error('Delete permission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

