import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authenticateRequest, isSuperAdmin } from '@/lib/middleware/auth';
import { hashPassword } from '@/lib/auth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  organizationId: z.string().uuid(),
  roleIds: z.array(z.string().uuid()).min(1),
  isActive: z.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Super Admin bypass or check for admin:users permission
    if (!isSuperAdmin(user) && !user.permissions.includes('admin:users')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;
    const search = searchParams.get('search');
    const isActive = searchParams.get('isActive');
    const organizationId = searchParams.get('organizationId');

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (organizationId) {
      where.organizationId = organizationId;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
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
          organization: {
            select: {
              organizationId: true,
              name: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Get active/inactive counts
    const [activeCount, inactiveCount] = await Promise.all([
      prisma.user.count({ where: { ...where, isActive: true } }),
      prisma.user.count({ where: { ...where, isActive: false } }),
    ]);

    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        roles: u.userRoles.map((ur) => ur.role),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts: {
        total,
        active: activeCount,
        inactive: inactiveCount,
      },
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
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

    // Super Admin bypass or check for admin:users permission
    if (!isSuperAdmin(user) && !user.permissions.includes('admin:users')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const data = createUserSchema.parse(body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create user
    const newUser = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        organizationId: data.organizationId,
        isActive: data.isActive,
      },
    });

    // Assign roles
    for (const roleId of data.roleIds) {
      await prisma.userRole.create({
        data: {
          userId: newUser.userId,
          roleId,
        },
      });
    }

    // Fetch user with roles for response
    const userWithRoles = await prisma.user.findUnique({
      where: { userId: newUser.userId },
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
        organization: {
          select: {
            organizationId: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        ...userWithRoles,
        roles: userWithRoles?.userRoles.map((ur) => ur.role) || [],
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Create user error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: (error as Error).message },
      { status: 500 }
    );
  }
}

