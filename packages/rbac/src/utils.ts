// ============================================================
// @ottabase/rbac - Utilities
// ============================================================

import { User } from '@ottabase/ottaorm/models';
import type { RBACContext, RBACCheckOptions, PermissionCheckResult } from './types';

/**
 * Create RBAC context from user
 */
export async function createRBACContext(user: User | null): Promise<RBACContext> {
    if (!user) {
        return {
            user: null,
            roles: [],
            permissions: [],
            isAuthenticated: false,
        };
    }

    const roles = await user.roles();
    const permissions = await user.getPermissions();

    return {
        user,
        roles: roles.map((r) => r.get('name') as string),
        permissions,
        isAuthenticated: true,
    };
}

/**
 * Check if context has permission
 */
export function hasPermission(
    context: RBACContext,
    permission: string | string[],
    options: RBACCheckOptions = {}
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
        const hasIt = checkPermissionMatch(context.permissions, perm);

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
    options: RBACCheckOptions = {}
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
 * Check permission with wildcard support
 * Supports patterns like:
 * - users:read (exact match)
 * - users:* (all actions on users)
 * - *:read (read on all resources)
 * - *:* (all permissions)
 */
function checkPermissionMatch(userPermissions: string[], requiredPermission: string): boolean {
    // Check exact match first
    if (userPermissions.includes(requiredPermission)) {
        return true;
    }

    const [reqResource, reqAction] = requiredPermission.split(':');

    for (const perm of userPermissions) {
        const [permResource, permAction] = perm.split(':');

        // *:* grants everything
        if (permResource === '*' && permAction === '*') {
            return true;
        }

        // Check with wildcards
        const resourceMatches = permResource === '*' || permResource === reqResource;
        const actionMatches = permAction === '*' || permAction === reqAction;

        if (resourceMatches && actionMatches) {
            return true;
        }
    }

    return false;
}

/**
 * Check if user is admin
 */
export function isAdmin(context: RBACContext): boolean {
    return context.roles.includes('admin') || context.permissions.includes('*:*');
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
