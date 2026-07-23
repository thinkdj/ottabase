// ============================================================
// @ottabase/rbac - Utilities
// ============================================================

import { User } from '@ottabase/ottaorm/models';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import type { RBACContext, RBACCheckOptions, PermissionCheckResult } from './types';

/**
 * Create RBAC context from user with multi-tenant support
 * Optimized with optional caching support
 */
export async function createRBACContext(
    user: User | null,
    cache?: any,
    options?: { organizationId?: string; tenantId?: string },
): Promise<RBACContext> {
    if (!user) {
        return {
            user: null,
            roles: [],
            permissions: [],
            isAuthenticated: false,
            organizationId: options?.organizationId,
            tenantId: options?.tenantId,
        };
    }

    const userId = user.get('id') as string;
    const organizationId = options?.organizationId;
    const tenantId = options?.tenantId;

    // Try to get full context from cache first (tenant-aware)
    if (cache) {
        try {
            const cached = await cache.getUserContext(userId, organizationId);
            if (cached) {
                return { ...cached, user, organizationId, tenantId }; // Re-attach user and tenant info
            }
        } catch (error) {
            // Ignore cache errors, fallback to DB
        }
    }

    // Get roles and permissions with cache support (tenant-aware)
    const roles = await user.roles({ cache, organizationId });
    const permissions = await user.getPermissions({ cache, organizationId });

    const context: RBACContext = {
        user,
        roles: roles.map((r) => r.get('name') as string),
        permissions,
        isAuthenticated: true,
        organizationId,
        tenantId,
    };

    // Cache the context (tenant-aware)
    if (cache) {
        try {
            await cache.setUserContext(
                userId,
                {
                    user: null, // Don't cache the user object itself
                    roles: context.roles,
                    permissions: context.permissions,
                    isAuthenticated: true,
                    organizationId,
                    tenantId,
                },
                organizationId,
            );
        } catch (error) {
            // Ignore cache errors
        }
    }

    return context;
}

/**
 * Check if context has permission
 */
export function hasPermission(
    context: RBACContext,
    permission: string | string[],
    options: RBACCheckOptions = {},
): PermissionCheckResult {
    if (!context.isAuthenticated) {
        return {
            allowed: false,
            reason: 'User not authenticated',
        };
    }

    const permissions = Array.isArray(permission) ? permission : [permission];
    const missingPermissions: string[] = [];

    for (const perm of permissions) {
        const hasIt = hasGrantedPermission(context.permissions, perm);

        if (options.requireAll && !hasIt) {
            missingPermissions.push(perm);
        } else if (!options.requireAll && hasIt) {
            return { allowed: true };
        }
    }

    if (options.requireAll) {
        return {
            allowed: missingPermissions.length === 0,
            reason: missingPermissions.length > 0 ? 'Missing required permissions' : undefined,
            missingPermissions: missingPermissions.length > 0 ? missingPermissions : undefined,
        };
    }

    return {
        allowed: false,
        reason: 'No matching permissions found',
        missingPermissions: permissions,
    };
}

/**
 * Check if context has role
 */
export function hasRole(
    context: RBACContext,
    role: string | string[],
    options: RBACCheckOptions = {},
): PermissionCheckResult {
    if (!context.isAuthenticated) {
        return {
            allowed: false,
            reason: 'User not authenticated',
        };
    }

    const roles = Array.isArray(role) ? role : [role];
    const missingRoles: string[] = [];

    for (const r of roles) {
        const hasIt = context.roles.includes(r);

        if (options.requireAll && !hasIt) {
            missingRoles.push(r);
        } else if (!options.requireAll && hasIt) {
            return { allowed: true };
        }
    }

    if (options.requireAll) {
        return {
            allowed: missingRoles.length === 0,
            reason: missingRoles.length > 0 ? 'Missing required roles' : undefined,
            missingRoles: missingRoles.length > 0 ? missingRoles : undefined,
        };
    }

    return {
        allowed: false,
        reason: 'No matching roles found',
        missingRoles: roles,
    };
}

/**
 * Check if the context holds any admin capability — PERMISSION-based, never role-NAME-based.
 * True when the caller has `platform:admin` or `org:admin` (or the '*:*' superadmin wildcard).
 * A role merely named 'owner'/'admin' with no such permission is NOT an admin.
 *
 * NOTE: RBACContext is scope-blind. For the platform-vs-org boundary on the server, use
 * assertAdmin / isPlatformAdmin from admin-guard.ts (which read system-scoped grants).
 */
export function isAdmin(context: RBACContext): boolean {
    return (
        hasGrantedPermission(context.permissions, 'platform:admin') ||
        hasGrantedPermission(context.permissions, 'org:admin')
    );
}

/**
 * Get allowed actions for a resource
 */
export function getAllowedActions(context: RBACContext, resource: string): string[] {
    const actions = new Set<string>();

    for (const perm of context.permissions) {
        const [permResource, permAction] = perm.split(':');

        if (permResource === '*' || permResource === resource) {
            if (permAction === '*') {
                // Grant common CRUD actions
                actions.add('create');
                actions.add('read');
                actions.add('update');
                actions.add('delete');
                actions.add('manage');
            } else {
                actions.add(permAction);
            }
        }
    }

    return Array.from(actions);
}

/**
 * Format permission string
 */
export function formatPermission(resource: string, action: string): string {
    return `${resource}:${action}`;
}

/**
 * Parse permission string
 */
export function parsePermission(permission: string): { resource: string; action: string } | null {
    const parts = permission.split(':');
    if (parts.length !== 2) {
        return null;
    }
    return {
        resource: parts[0],
        action: parts[1],
    };
}
