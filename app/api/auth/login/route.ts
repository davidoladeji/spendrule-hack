import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, generateAccessToken, generateRefreshToken, storeRefreshToken, getUserWithRoles } from '@/lib/auth';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate input
    let validatedData;
    try {
      validatedData = loginSchema.parse(body);
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        const errorMessages = validationError.errors.map((err) => {
          if (err.path[0] === 'email') {
            return 'Please enter a valid email address';
          }
          if (err.path[0] === 'password') {
            return 'Password must be at least 8 characters long';
          }
          return `${err.path.join('.')}: ${err.message}`;
        });
        return NextResponse.json(
          { error: errorMessages[0] || 'Invalid request data', details: validationError.errors },
          { status: 400 }
        );
      }
      throw validationError;
    }

    const { email, password } = validatedData;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
        organization: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email address' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Your account has been deactivated. Please contact your administrator.' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Incorrect password. Please try again.' },
        { status: 401 }
      );
    }

    // Update last login
    await prisma.user.update({
      where: { userId: user.userId },
      data: { lastLogin: new Date() },
    });

    // Get user with full role and permission details
    const userWithRoles = await getUserWithRoles(user.userId);

    if (!userWithRoles) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const roles = userWithRoles.userRoles.map((ur) => ur.role.roleName);

    // Collect all permissions from user's roles
    const permissionsSet = new Set<string>();
    for (const userRole of userWithRoles.userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissionsSet.add(rolePermission.permission.permissionName);
      }
    }
    const permissions = Array.from(permissionsSet);

    const tokenPayload = {
      userId: user.userId,
      email: user.email,
      organizationId: user.organizationId,
      roles,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await storeRefreshToken(user.userId, refreshToken);

    return NextResponse.json({
      accessToken,
      refreshToken,
      user: {
        userId: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        organizationId: user.organizationId,
        roles,
        permissions,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    
    // Handle known errors
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => {
        if (err.path[0] === 'email') {
          return 'Please enter a valid email address';
        }
        if (err.path[0] === 'password') {
          return 'Password must be at least 8 characters long';
        }
        return `${err.path.join('.')}: ${err.message}`;
      });
      return NextResponse.json(
        { error: errorMessages[0] || 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    // Generic error
    return NextResponse.json(
      { error: 'Unable to sign in. Please try again later.' },
      { status: 500 }
    );
  }
}

