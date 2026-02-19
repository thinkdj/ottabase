// ============================================================
// @ottabase/audit - Middleware
// ============================================================

import { User } from '@ottabase/ottaorm/models';
import type { AuditMiddlewareOptions } from './types';
import { extractRequestContext, logAudit, logFailure } from './utils';

/**
 * Audit middleware for Next.js API routes
 * Automatically logs API requests and responses
 *
 * @example
 * ```typescript
 * import { withAudit } from '@ottabase/audit/middleware';
 *
 * export const POST = withAudit(
 *   async (request) => {
 *     // Your handler code
 *     return Response.json({ success: true });
 *   },
 *   {
 *     resourceType: 'user',
 *     action: 'create',
 *     getResourceId: async (req) => {
 *       const body = await req.json();
 *       return body.id;
 *     }
 *   }
 * );
 * ```
 */
export function withAudit<T extends (...args: any[]) => Promise<Response>>(
    handler: T,
    options: AuditMiddlewareOptions,
): T {
    return (async (...args: any[]) => {
        const request = args[0] as Request;
        const params = args[1];

        let userId: string | undefined;
        let userEmail: string | undefined;
        let resourceId: string | undefined;
        let requestBody: any;

        try {
            // Get user from request (if available)
            const userIdHeader = request.headers.get('x-user-id');
            if (userIdHeader) {
                userId = userIdHeader;
                const user = await User.find(userId);
                if (user) {
                    userEmail = user.get('email') as string;
                }
            }

            // Get resource ID
            if (options.getResourceId) {
                resourceId = await options.getResourceId(request, params);
            } else if (params?.id) {
                resourceId = params.id;
            }

            // Get request body if needed
            if (options.includeRequestBody && request.method !== 'GET' && request.method !== 'DELETE') {
                const clonedRequest = request.clone();
                try {
                    requestBody = await clonedRequest.json();
                } catch {
                    // Not JSON or already consumed
                }
            }

            // Call the handler
            const response = await handler(...args);

            // Log successful action
            const context = extractRequestContext(request, userId, userEmail);

            let changes: Record<string, any> | undefined;
            if (options.getChanges) {
                changes = await options.getChanges(request, params);
            } else if (requestBody) {
                changes = { request: requestBody };
            }

            // Determine action from method if not specified
            const action =
                options.action ||
                {
                    POST: 'create',
                    GET: 'read',
                    PUT: 'update',
                    PATCH: 'update',
                    DELETE: 'delete',
                }[request.method] ||
                'custom';

            await logAudit({
                userId,
                userEmail,
                action,
                resourceType: options.resourceType,
                resourceId,
                changes,
                metadata: {
                    url: context.url,
                    method: context.method,
                    statusCode: response.status,
                },
                ipAddress: context.ipAddress,
                userAgent: context.userAgent,
                status: response.ok ? 'success' : 'failure',
            });

            return response;
        } catch (error) {
            // Log failed action
            const context = extractRequestContext(request, userId, userEmail);

            const action =
                options.action ||
                {
                    POST: 'create',
                    GET: 'read',
                    PUT: 'update',
                    PATCH: 'update',
                    DELETE: 'delete',
                }[request.method] ||
                'custom';

            await logFailure(action, options.resourceType, error as Error, context, resourceId);

            // Re-throw the error
            throw error;
        }
    }) as T;
}

/**
 * Create audit middleware with default options
 */
export function createAuditMiddleware(defaultOptions: Partial<AuditMiddlewareOptions> = {}) {
    return function <T extends (...args: any[]) => Promise<Response>>(handler: T, options: AuditMiddlewareOptions): T {
        return withAudit(handler, {
            ...defaultOptions,
            ...options,
        });
    };
}

/**
 * Audit decorator for class methods
 */
export function Audit(options: AuditMiddlewareOptions) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            // Assuming first arg contains context with user and request info
            const context = args[0];

            try {
                const result = await originalMethod.apply(this, args);

                // Log successful action
                await logAudit({
                    userId: context.user?.id,
                    userEmail: context.user?.email,
                    action: options.action || 'custom',
                    resourceType: options.resourceType,
                    resourceId: context.resourceId,
                    metadata: {
                        method: propertyKey,
                    },
                    status: 'success',
                });

                return result;
            } catch (error) {
                // Log failed action
                await logFailure(
                    options.action || 'custom',
                    options.resourceType,
                    error as Error,
                    {
                        userId: context.user?.id,
                        userEmail: context.user?.email,
                    },
                    context.resourceId,
                );

                throw error;
            }
        };

        return descriptor;
    };
}
