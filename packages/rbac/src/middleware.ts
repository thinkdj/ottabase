// ============================================================
// @ottabase/rbac - Middleware
// ============================================================

import type { User } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { RBACError, type RBACCheckOptions } from './types';
import { createRBACContext, evaluatePermission, evaluateRole, hasPermission, hasRole } from './utils';
import { getRBACCache, type RBACCache } from './cache';

/**
 * RBAC middleware for Request → Response handlers.
 *
 * Both resolvers are REQUIRED and must be server-trusted: resolve the user from a verified session
 * (never a client header) and the organization from the session or a membership-verified request
 * value. Grants are org-scoped, so a missing organization evaluates to no roles/permissions (403).
 *
 * @example
 * ```typescript
 * import { getSession } from '@ottabase/auth/backend';
 * import { User } from '@ottabase/ottaorm/models';
 * import { withRBAC } from '@ottabase/rbac/middleware';
 *
 * export const handler = withRBAC(
 *     async (request: Request) => Response.json({ success: true }),
 *     {
 *         permissions: ['users:read'],
 *         getUserFromRequest: async (request) => {
 *             const session = await getSession(request, env);
 *             return session ? User.find(session.user.id) : null;
 *         },
 *         getOrganizationId: async (request) => (await getSession(request, env))?.user.organizationId ?? null,
 *     },
 * );
 * ```
 */
export function withRBAC<T extends (...args: any[]) => Promise<Response>>(
    handler: T,
    config: {
        permissions?: string | string[];
        roles?: string | string[];
        requireAll?: boolean;
        getUserFromRequest: (request: Request) => Promise<User | null>;
        getOrganizationId: (request: Request) => Promise<string | null | undefined> | string | null | undefined;
        cache?: RBACCache | boolean; // Pass cache instance or true to use global cache
    },
): T {
    return (async (...args: any[]) => {
        const request = args[0] as Request;

        // No trusted user resolver means no way to authenticate — never fall back to a header.
        if (typeof config.getUserFromRequest !== 'function') {
            return errorResponse('Authentication required', 401, { code: 'UNAUTHORIZED' });
        }

        try {
            const user = await config.getUserFromRequest(request);
            const organizationId = (await config.getOrganizationId?.(request)) ?? undefined;
            const cache = config.cache === true ? getRBACCache() : config.cache || undefined;

            const rbacContext = await createRBACContext(user, cache, { organizationId });

            if (!rbacContext.isAuthenticated) {
                return errorResponse('Authentication required', 401, { code: 'UNAUTHORIZED' });
            }

            if (config.permissions) {
                if (!hasPermission(rbacContext, config.permissions, { requireAll: config.requireAll }))
                    return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
            }

            if (config.roles) {
                if (!hasRole(rbacContext, config.roles, { requireAll: config.requireAll }))
                    return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
            }

            return await handler(...args);
        } catch (error) {
            if (error instanceof RBACError) {
                return error.code === 'UNAUTHORIZED'
                    ? errorResponse('Authentication required', 401, { code: 'UNAUTHORIZED' })
                    : errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
            }

            // Re-throw other errors
            throw error;
        }
    }) as T;
}

/**
 * Require permission decorator. The first argument must carry `user` and (unless passed in
 * `options.organizationId`) the `organizationId` to evaluate grants in.
 */
export function requirePermission(permission: string | string[], options: RBACCheckOptions = {}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const context = args[0];
            await checkPermission(context.user, permission, {
                ...options,
                organizationId: options.organizationId ?? context.organizationId,
            });
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}

/**
 * Require role decorator. Org resolution as in `requirePermission`.
 */
export function requireRole(role: string | string[], options: RBACCheckOptions = {}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const context = args[0];
            await checkRole(context.user, role, {
                ...options,
                organizationId: options.organizationId ?? context.organizationId,
            });
            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}

/**
 * Check permission in async function. Evaluated in `options.organizationId`; without one the user
 * holds no permissions and this throws FORBIDDEN.
 */
export async function checkPermission(
    user: User | null,
    permission: string | string[],
    options: RBACCheckOptions = {},
): Promise<void> {
    const context = await createRBACContext(user, undefined, { organizationId: options.organizationId });
    const result = evaluatePermission(context, permission, options);

    if (!result.allowed) {
        throw new RBACError(result.reason || 'Insufficient permissions', 'FORBIDDEN', result.missingPermissions);
    }
}

/**
 * Check role in async function. Evaluated in `options.organizationId` (see checkPermission).
 */
export async function checkRole(
    user: User | null,
    role: string | string[],
    options: RBACCheckOptions = {},
): Promise<void> {
    const context = await createRBACContext(user, undefined, { organizationId: options.organizationId });
    const result = evaluateRole(context, role, options);

    if (!result.allowed) {
        throw new RBACError(result.reason || 'Insufficient roles', 'FORBIDDEN', result.missingRoles);
    }
}
