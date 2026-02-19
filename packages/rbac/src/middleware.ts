// ============================================================
// @ottabase/rbac - Middleware
// ============================================================

import { User } from '@ottabase/ottaorm/models';
import { RBACError, type RBACCheckOptions } from './types';
import { createRBACContext, hasPermission, hasRole } from './utils';
import { getRBACCache, type RBACCache } from './cache';

/**
 * RBAC Middleware for Next.js API routes
 *
 * @example
 * ```typescript
 * import { withRBAC } from '@ottabase/rbac/middleware';
 *
 * export const GET = withRBAC(
 *   async (request, context) => {
 *     // Your handler code
 *     return Response.json({ success: true });
 *   },
 *   { permissions: ['users:read'] }
 * );
 * ```
 */
export function withRBAC<T extends (...args: any[]) => Promise<Response>>(
    handler: T,
    config: {
        permissions?: string | string[];
        roles?: string | string[];
        requireAll?: boolean;
        getUserFromRequest?: (request: Request) => Promise<User | null>;
        cache?: RBACCache | boolean; // Pass cache instance or true to use global cache
    },
): T {
    return (async (...args: any[]) => {
        const request = args[0] as Request;

        try {
            // Get user from request (custom getter or default)
            const user = config.getUserFromRequest
                ? await config.getUserFromRequest(request)
                : await getUserFromRequest(request);

            // Get cache instance
            const cache = config.cache === true ? getRBACCache() : config.cache || undefined;

            // Create RBAC context with cache support
            const rbacContext = await createRBACContext(user, cache);

            // Check if user is authenticated
            if (!rbacContext.isAuthenticated) {
                return new Response(
                    JSON.stringify({
                        error: 'Unauthorized',
                        message: 'Authentication required',
                    }),
                    {
                        status: 401,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            // Check permissions
            if (config.permissions) {
                const result = hasPermission(rbacContext, config.permissions, {
                    requireAll: config.requireAll,
                });

                if (!result.allowed) {
                    return new Response(
                        JSON.stringify({
                            error: 'Forbidden',
                            message: result.reason || 'Insufficient permissions',
                            missingPermissions: result.missingPermissions,
                        }),
                        {
                            status: 403,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
            }

            // Check roles
            if (config.roles) {
                const result = hasRole(rbacContext, config.roles, {
                    requireAll: config.requireAll,
                });

                if (!result.allowed) {
                    return new Response(
                        JSON.stringify({
                            error: 'Forbidden',
                            message: result.reason || 'Insufficient roles',
                            missingRoles: result.missingRoles,
                        }),
                        {
                            status: 403,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
            }

            // Call the handler
            return await handler(...args);
        } catch (error) {
            if (error instanceof RBACError) {
                return new Response(
                    JSON.stringify({
                        error: error.code,
                        message: error.message,
                        details: error.details,
                    }),
                    {
                        status: error.code === 'UNAUTHORIZED' ? 401 : 403,
                        headers: { 'Content-Type': 'application/json' },
                    },
                );
            }

            // Re-throw other errors
            throw error;
        }
    }) as T;
}

/**
 * Default user getter from request
 * Extracts user from session or JWT
 */
async function getUserFromRequest(request: Request): Promise<User | null> {
    // Try to get user ID from header (custom auth)
    const userId = request.headers.get('x-user-id');
    if (userId) {
        return User.find(userId);
    }

    // Try to get from auth session (Auth.js)
    // This is a simplified example - in real usage, you'd use the auth session
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        // Decode JWT and get user ID
        // This is simplified - you'd use your JWT library here
        // For now, return null
    }

    return null;
}

/**
 * Require permission decorator
 */
export function requirePermission(permission: string | string[], options: RBACCheckOptions = {}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            // Assuming first arg is context with user
            const context = args[0];
            const rbacContext = await createRBACContext(context.user);

            const result = hasPermission(rbacContext, permission, options);
            if (!result.allowed) {
                throw new RBACError(
                    result.reason || 'Insufficient permissions',
                    'FORBIDDEN',
                    result.missingPermissions,
                );
            }

            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}

/**
 * Require role decorator
 */
export function requireRole(role: string | string[], options: RBACCheckOptions = {}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            // Assuming first arg is context with user
            const context = args[0];
            const rbacContext = await createRBACContext(context.user);

            const result = hasRole(rbacContext, role, options);
            if (!result.allowed) {
                throw new RBACError(result.reason || 'Insufficient roles', 'FORBIDDEN', result.missingRoles);
            }

            return originalMethod.apply(this, args);
        };

        return descriptor;
    };
}

/**
 * Check permission in async function
 */
export async function checkPermission(
    user: User | null,
    permission: string | string[],
    options: RBACCheckOptions = {},
): Promise<void> {
    const context = await createRBACContext(user);
    const result = hasPermission(context, permission, options);

    if (!result.allowed) {
        throw new RBACError(result.reason || 'Insufficient permissions', 'FORBIDDEN', result.missingPermissions);
    }
}

/**
 * Check role in async function
 */
export async function checkRole(
    user: User | null,
    role: string | string[],
    options: RBACCheckOptions = {},
): Promise<void> {
    const context = await createRBACContext(user);
    const result = hasRole(context, role, options);

    if (!result.allowed) {
        throw new RBACError(result.reason || 'Insufficient roles', 'FORBIDDEN', result.missingRoles);
    }
}
