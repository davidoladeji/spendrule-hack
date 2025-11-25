import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, JWTPayload } from '@/lib/auth';
import { getUserWithRoles } from '@/lib/auth';

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload & {
    permissions: string[];
  };
}

export async function authenticateRequest(
  request: NextRequest
): Promise<{ user: AuthenticatedRequest['user']; error: NextResponse | null }> {
  const { cache, CacheKeys } = await import('../cache');
  
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      user: undefined,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);

  if (!payload) {
    return {
      user: undefined,
      error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }),
    };
  }

  // Check cache for permissions
  const cacheKey = CacheKeys.userPermissions(payload.userId);
  const cachedPermissions = cache.get<string[]>(cacheKey);

  let permissions: string[];
  if (cachedPermissions) {
    permissions = cachedPermissions;
  } else {
    const userWithRoles = await getUserWithRoles(payload.userId);

    if (!userWithRoles || !userWithRoles.isActive) {
      return {
        user: undefined,
        error: NextResponse.json({ error: 'User not found or inactive' }, { status: 401 }),
      };
    }

    // Collect all permissions from user's roles
    const permissionsSet = new Set<string>();
    for (const userRole of userWithRoles.userRoles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        permissionsSet.add(rolePermission.permission.permissionName);
      }
    }

    permissions = Array.from(permissionsSet);
    // Cache permissions for 5 minutes
    cache.set(cacheKey, permissions, 5 * 60 * 1000);
  }

  const user = {
    ...payload,
    permissions,
  };

  return { user, error: null };
}

export function requirePermission(permission: string) {
  return async (request: AuthenticatedRequest) => {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.permissions.includes(permission)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    request.user = user;
    return null;
  };
}

export function requireAnyPermission(permissions: string[]) {
  return async (request: AuthenticatedRequest) => {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hasPermission = permissions.some((perm) => user.permissions.includes(perm));

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    request.user = user;
    return null;
  };
}

export function requireRole(roleName: string) {
  return async (request: AuthenticatedRequest) => {
    const { user, error } = await authenticateRequest(request);

    if (error || !user) {
      return error || NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.roles.includes(roleName)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient role' }, { status: 403 });
    }

    request.user = user;
    return null;
  };
}

/**
 * Check if a user has the Super Admin role
 */
export function isSuperAdmin(user: AuthenticatedRequest['user']): boolean {
  if (!user || !user.roles) {
    return false;
  }
  return user.roles.includes('Super Admin');
}

