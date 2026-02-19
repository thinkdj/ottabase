// ============================================================
// @ottabase/ottaorm - Tenant-Aware CRUD Handler
// ============================================================
// Enforces tenant isolation at the database level
// Prevents cross-tenant data leaks by automatically scoping queries
// ============================================================

import logger from '@ottabase/logger';
import type { User } from '@ottabase/ottaorm/models';
import { extractOrganizationId } from '@ottabase/rbac';
import { handleCrud, type CrudRequest, type CrudResponse } from './index';

/**
 * Models that require tenant scoping (have organizationId field)
 * These models will have organizationId automatically injected into queries
 */
const TENANT_SCOPED_MODELS = new Set([
    'organizations',
    'organization_members',
    'roles', // Roles can be org-scoped or system-wide
    'permissions', // Permissions can be org-scoped or system-wide
    'user_roles', // User roles are always org-scoped
    'audit_logs', // Audit logs are always org-scoped
    // Add your custom tenant-scoped models here
]);

/**
 * Models that should only be accessible by admins
 */
const ADMIN_ONLY_MODELS = new Set([
    'users', // User management should go through dedicated endpoints
    'accounts',
    'sessions',
    'verification_tokens',
    'authenticators',
]);

/**
 * Check if a model is tenant-scoped
 */
function isTenantScoped(model: string): boolean {
    return TENANT_SCOPED_MODELS.has(model);
}

/**
 * Check if a model is admin-only
 */
function isAdminOnly(model: string): boolean {
    return ADMIN_ONLY_MODELS.has(model);
}

/**
 * Tenant-aware CRUD options
 */
export interface TenantAwareCrudOptions {
    request: Request;
    url: URL;
    basePath?: string;
    getUser?: () => Promise<InstanceType<typeof User> | null>;
    env?: Record<string, any>;
    // For single-founder mode: if true, allows operations without organizationId
    allowNullTenant?: boolean;
    // Skip tenant scoping for specific models (use with caution!)
    skipTenantScoping?: string[];
}

/**
 * Handle a tenant-aware CRUD request
 * Automatically enforces tenant isolation at the database level
 *
 * @example
 * ```typescript
 * // In your API route handler:
 * import { parseCrudRequest } from '@ottabase/ottaorm';
 * import { handleTenantAwareCrud } from '@ottabase/ottaorm/crud/tenant-aware';
 *
 * const crudRequest = await parseCrudRequest(request, url);
 * if (crudRequest) {
 *   const result = await handleTenantAwareCrud({
 *     request,
 *     url,
 *     getUser: async () => {
 *       const session = await getSession(request, env);
 *       return session?.user || null;
 *     },
 *     env,
 *     allowNullTenant: true, // Enable single-founder mode
 *   });
 *   return new Response(JSON.stringify(result.data || { error: result.error }), {
 *     status: result.status
 *   });
 * }
 * ```
 */
export async function handleTenantAwareCrud(options: TenantAwareCrudOptions): Promise<CrudResponse> {
    const {
        request,
        url,
        basePath = '/api/ottaorm',
        getUser,
        env,
        allowNullTenant = false,
        skipTenantScoping = [],
    } = options;

    // Parse the CRUD request
    const { parseCrudRequest } = await import('./index');
    const crudRequest = await parseCrudRequest(request, url, basePath);

    if (!crudRequest) {
        return {
            success: false,
            error: 'Invalid CRUD request',
            status: 400,
        };
    }

    const { model, method, id, query, body } = crudRequest;

    // Check if model is admin-only
    if (isAdminOnly(model)) {
        logger.warn('Attempted access to admin-only model', { model, method, userId: (await getUser?.())?.id });
        return {
            success: false,
            error: `Model '${model}' can only be accessed through dedicated admin endpoints`,
            status: 403,
        };
    }

    // Get authenticated user
    let user: InstanceType<typeof User> | null = null;
    if (getUser) {
        try {
            user = await getUser();
        } catch (error: any) {
            logger.error('Failed to get user', { message: error?.message });
        }
    }

    // Extract organization ID (tenant ID)
    let organizationId: string | null = null;
    try {
        organizationId = await extractOrganizationId({
            request,
            getJWT: getUser ? async () => user : undefined,
        });
    } catch (error: any) {
        logger.error('Failed to extract organization ID', { message: error?.message });
    }

    // Check if tenant scoping is required
    const requiresTenantScoping = isTenantScoped(model) && !skipTenantScoping.includes(model);

    // Enforce tenant scoping rules
    if (requiresTenantScoping) {
        // Special case: organizations model can be accessed without org context for listing
        if (model === 'organizations' && method === 'GET' && !id) {
            // Allow listing organizations (user can see orgs they belong to)
            // This will be further filtered by membership in a real implementation
            // For now, we allow it to pass through
        } else if (!organizationId && !allowNullTenant) {
            // Multi-tenant mode: require organizationId
            return {
                success: false,
                error: 'Organization context required. Please provide organizationId via header, subdomain, or query parameter.',
                hint: 'Use X-Org-Id header, subdomain (org.example.com), or ?organizationId=xxx',
                status: 403,
            };
        }

        // Inject organizationId into where clauses (if not already present)
        if (organizationId) {
            // For GET requests with query.where
            if (method === 'GET' && query?.where) {
                if (!query.where.organizationId) {
                    query.where.organizationId = organizationId;
                    logger.debug('Injected organizationId into query.where', { model, organizationId });
                } else if (query.where.organizationId !== organizationId) {
                    // User is trying to access a different organization's data
                    logger.warn('Cross-tenant access attempt detected', {
                        model,
                        requestedOrgId: query.where.organizationId,
                        userOrgId: organizationId,
                        userId: user?.id,
                    });
                    return {
                        success: false,
                        error: 'Access denied: You can only access data from your organization',
                        status: 403,
                    };
                }
            }

            // For GET requests without query.where, create one
            if (method === 'GET' && !query?.where) {
                if (!crudRequest.query) {
                    crudRequest.query = {};
                }
                crudRequest.query.where = { organizationId };
                logger.debug('Created query.where with organizationId', { model, organizationId });
            }

            // For POST requests, inject organizationId into body
            if (method === 'POST' && body) {
                if (!body.organizationId) {
                    body.organizationId = organizationId;
                    logger.debug('Injected organizationId into body', { model, organizationId });
                } else if (body.organizationId !== organizationId) {
                    // User is trying to create data for a different organization
                    logger.warn('Cross-tenant create attempt detected', {
                        model,
                        requestedOrgId: body.organizationId,
                        userOrgId: organizationId,
                        userId: user?.id,
                    });
                    return {
                        success: false,
                        error: 'Access denied: You can only create data for your organization',
                        status: 403,
                    };
                }
            }

            // For PATCH/PUT requests with ID, verify the resource belongs to the user's org
            if ((method === 'PATCH' || method === 'PUT') && id) {
                // First, fetch the existing record to verify ownership
                const verifyRequest: CrudRequest = {
                    method: 'GET',
                    model,
                    id,
                    query: { where: { organizationId } },
                };

                const verifyResult = await handleCrud(verifyRequest);
                if (!verifyResult.success) {
                    logger.warn('Resource not found or access denied', { model, id, organizationId, userId: user?.id });
                    return {
                        success: false,
                        error: 'Resource not found or access denied',
                        status: 404,
                    };
                }

                // Prevent changing organizationId via update
                if (body && body.organizationId && body.organizationId !== organizationId) {
                    logger.warn('Attempt to change organizationId via update', {
                        model,
                        id,
                        currentOrgId: organizationId,
                        newOrgId: body.organizationId,
                        userId: user?.id,
                    });
                    return {
                        success: false,
                        error: 'Cannot change organizationId',
                        status: 403,
                    };
                }
            }

            // For DELETE requests with ID, verify the resource belongs to the user's org
            if (method === 'DELETE' && id) {
                // First, fetch the existing record to verify ownership
                const verifyRequest: CrudRequest = {
                    method: 'GET',
                    model,
                    id,
                    query: { where: { organizationId } },
                };

                const verifyResult = await handleCrud(verifyRequest);
                if (!verifyResult.success) {
                    logger.warn('Resource not found or access denied for deletion', {
                        model,
                        id,
                        organizationId,
                        userId: user?.id,
                    });
                    return {
                        success: false,
                        error: 'Resource not found or access denied',
                        status: 404,
                    };
                }
            }
        }
    }

    // Log the request for audit purposes
    logger.info('Tenant-aware CRUD request', {
        model,
        method,
        id: id || undefined,
        organizationId: organizationId || undefined,
        userId: user?.id,
        hasWhere: !!query?.where,
        tenantScoped: requiresTenantScoping,
    });

    // Execute the CRUD operation
    return handleCrud(crudRequest);
}

/**
 * Middleware wrapper for tenant-aware CRUD
 * Use this in your Cloudflare Worker routes
 *
 * @example
 * ```typescript
 * // In your worker:
 * if (url.pathname.startsWith('/api/ottaorm/')) {
 *   return tenantAwareCrudMiddleware({
 *     request,
 *     url,
 *     getUser: async () => {
 *       const session = await getSession(request, env);
 *       return session?.user || null;
 *     },
 *     env,
 *     allowNullTenant: true,
 *   });
 * }
 * ```
 */
export async function tenantAwareCrudMiddleware(options: TenantAwareCrudOptions): Promise<Response> {
    const result = await handleTenantAwareCrud(options);

    return new Response(JSON.stringify(result.data || { error: result.error, hint: result.hint }), {
        status: result.status,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}
