import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, generateAccessToken, generateRefreshToken, validateRefreshToken, revokeRefreshToken, getUserWithRoles } from '@/lib/auth';
import { z } from 'zod';

const refreshSchema = z.object({
  refreshToken: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = refreshSchema.parse(body);

    const payload = verifyRefreshToken(refreshToken);

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid refresh token' },
        { status: 401 }
      );
    }

    const isValid = await validateRefreshToken(refreshToken, payload.userId);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Refresh token expired or invalid' },
        { status: 401 }
      );
    }

    // Revoke old token
    await revokeRefreshToken(refreshToken, payload.userId);

    // Get updated user roles
    const userWithRoles = await getUserWithRoles(payload.userId);

    if (!userWithRoles || !userWithRoles.isActive) {
      return NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 401 }
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
      userId: payload.userId,
      email: payload.email,
      organizationId: payload.organizationId,
      roles,
    };

    const newAccessToken = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    await storeRefreshToken(payload.userId, newRefreshToken);

    return NextResponse.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        userId: payload.userId,
        email: payload.email,
        organizationId: payload.organizationId,
        roles,
        permissions,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Refresh token error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Refresh token error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const { storeRefreshToken } = await import('@/lib/auth');
  return storeRefreshToken(userId, token);
}

