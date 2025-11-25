'use client';

import { getStoredTokens } from './auth-client';

/**
 * Check if the current user has a specific permission
 */
export function hasPermission(permission: string): boolean {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.user.permissions) {
    return false;
  }
  return tokens.user.permissions.includes(permission);
}

/**
 * Check if the current user has any of the specified permissions
 */
export function hasAnyPermission(permissions: string[]): boolean {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.user.permissions) {
    return false;
  }
  return permissions.some((perm) => tokens.user.permissions?.includes(perm));
}

/**
 * Check if the current user has all of the specified permissions
 */
export function hasAllPermissions(permissions: string[]): boolean {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.user.permissions) {
    return false;
  }
  return permissions.every((perm) => tokens.user.permissions?.includes(perm));
}

/**
 * Check if the current user has a specific role
 */
export function hasRole(roleName: string): boolean {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.user.roles) {
    return false;
  }
  return tokens.user.roles.includes(roleName);
}

/**
 * Check if the current user has any of the specified roles
 */
export function hasAnyRole(roleNames: string[]): boolean {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.user.roles) {
    return false;
  }
  return roleNames.some((role) => tokens.user.roles.includes(role));
}

/**
 * Check if the current user can access a route based on permission requirements
 * Maps routes to required permissions
 */
export function canAccessRoute(route: string): boolean {
  const routePermissions: Record<string, string | string[]> = {
    '/dashboard': 'dashboard:view',
    '/invoices': 'invoices:read',
    '/contracts': 'contracts:read',
    '/parties': 'parties:read',
    '/locations': 'locations:read',
    '/exceptions': 'exceptions:view',
    '/approvals': ['approvals:approve', 'approvals:reject', 'approvals:escalate'],
    '/documents': 'documents:view',
    '/service-catalog': 'service-catalog:read',
    '/pricing-models': 'pricing-models:read',
    '/audit-logs': 'admin:audit',
    '/roles': 'roles:view',
    '/permissions': 'permissions:view',
    '/users': 'admin:users',
  };

  const requiredPermission = routePermissions[route];
  if (!requiredPermission) {
    // If route not in map, allow access (default to permissive)
    return true;
  }

  if (Array.isArray(requiredPermission)) {
    return hasAnyPermission(requiredPermission);
  }

  return hasPermission(requiredPermission);
}

/**
 * Get all permissions for the current user
 */
export function getUserPermissions(): string[] {
  const tokens = getStoredTokens();
  return tokens?.user.permissions || [];
}

/**
 * Get all roles for the current user
 */
export function getUserRoles(): string[] {
  const tokens = getStoredTokens();
  return tokens?.user.roles || [];
}

