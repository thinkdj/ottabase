/**
 * Secure CRUD Operations with RLS
 *
 * Replaces manual tenant filtering with automatic RLS enforcement
 */

import { handleCrud, type CrudRequest, type CrudResponse } from '../crud';
import { globalRLS, RLSError } from './engine';
import type { SecurityContext } from './types';

/** DB column names SQLite lists in composite UNIQUE errors (snake_case). */
const UNIQUE_FIELD_PRIORITY = ['slug', 'email', 'name', 'session_token', 'credential_id', 'referral_username'] as const;

/**
 * Map SQLite "UNIQUE constraint failed: table.col1, table.col2" to a single API/model field
 * (camelCase) for forms. Prefer human-meaningful columns (e.g. slug) in composites.
 */
export function parseSqliteUniqueConstraintForApi(sqliteMessage: string): string {
    const m = sqliteMessage.match(/UNIQUE constraint failed:\s*(.+)/i);
    if (!m?.[1]) return 'unknown';
    const segments = m[1].split(',').map((s) => s.trim());
    const dbCols: string[] = [];
    for (const seg of segments) {
        const col = seg.match(/^[\w.]+\.(\w+)$/)?.[1];
        if (col) dbCols.push(col);
    }
    if (dbCols.length === 0) return 'unknown';
    for (const pref of UNIQUE_FIELD_PRIORITY) {
        if (dbCols.includes(pref)) return sqliteColumnToApiField(pref);
    }
    return sqliteColumnToApiField(dbCols[dbCols.length - 1]!);
}

function sqliteColumnToApiField(dbCol: string): string {
    const map: Record<string, string> = {
        organization_id: 'organizationId',
        app_id: 'appId',
        user_id: 'userId',
        author_id: 'authorId',
        category_id: 'categoryId',
        session_token: 'sessionToken',
        credential_id: 'credentialId',
        referral_username: 'referralUsername',
        content_type: 'contentType',
    };
    return map[dbCol] ?? dbCol;
}

export interface SecureCrudOptions {
    request: Request;
    url: URL;
    context: SecurityContext;
    env?: any;
}

/**
 * Secure CRUD with automatic RLS enforcement
 *
 * This replaces the manual tenantAwareCrudMiddleware with automatic RLS
 */
export async function secureCrud(options: SecureCrudOptions): Promise<Response> {
    const { request, url, context } = options;

    try {
        // Parse CRUD request
        const pathParts = url.pathname.split('/').filter(Boolean);
        let model: string | undefined;
        let id: string | undefined;

        if (pathParts[0] === 'api' && pathParts[1] === 'ottaorm') {
            model = pathParts[2];
            id = pathParts[3];
        } else {
            model = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];
            id = pathParts.length > 3 ? pathParts[pathParts.length - 1] : undefined;
        }

        const method = request.method as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

        // Parse request body
        let body: any = null;
        if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
            const text = await request.text();
            if (text) {
                try {
                    body = JSON.parse(text);
                } catch {
                    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
            }
        }

        // Parse query params
        const queryString = url.searchParams.get('query');
        let query: CrudRequest['query'] | undefined;

        if (queryString) {
            try {
                query = JSON.parse(queryString);
            } catch {
                return new Response(JSON.stringify({ error: 'Invalid JSON in query parameter' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        } else {
            query = {};

            const whereParam = url.searchParams.get('where');
            if (whereParam) {
                try {
                    query.where = JSON.parse(whereParam);
                } catch {
                    return new Response(JSON.stringify({ error: 'Invalid JSON in where parameter' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json' },
                    });
                }
            }

            const orderBy = url.searchParams.get('orderBy') || url.searchParams.get('sort');
            if (orderBy) query.orderBy = orderBy;

            const orderDirection = url.searchParams.get('orderDirection') || url.searchParams.get('order');
            if (orderDirection === 'asc' || orderDirection === 'desc') {
                query.orderDirection = orderDirection;
            }

            const limit = url.searchParams.get('limit');
            if (limit) {
                const parsedLimit = parseInt(limit, 10);
                if (!Number.isFinite(parsedLimit)) {
                    return new Response(
                        JSON.stringify({
                            error: 'Invalid query parameter',
                            message: 'limit must be a valid integer',
                        }),
                        {
                            status: 400,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                query.limit = Math.min(Math.max(1, parsedLimit), 1000);
            }

            const offset = url.searchParams.get('offset');
            if (offset) {
                const parsedOffset = parseInt(offset, 10);
                if (!Number.isFinite(parsedOffset)) {
                    return new Response(
                        JSON.stringify({
                            error: 'Invalid query parameter',
                            message: 'offset must be a valid integer',
                        }),
                        {
                            status: 400,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                query.offset = Math.min(Math.max(0, parsedOffset), 100_000);
            }

            const page = url.searchParams.get('page');
            if (page) {
                const parsedPage = parseInt(page, 10);
                if (!Number.isFinite(parsedPage)) {
                    return new Response(
                        JSON.stringify({
                            error: 'Invalid query parameter',
                            message: 'page must be a valid integer',
                        }),
                        {
                            status: 400,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                query.page = parsedPage;
            }

            const perPage = url.searchParams.get('perPage') || url.searchParams.get('per_page');
            if (perPage) {
                const parsedPerPage = parseInt(perPage, 10);
                if (!Number.isFinite(parsedPerPage)) {
                    return new Response(
                        JSON.stringify({
                            error: 'Invalid query parameter',
                            message: 'perPage must be a valid integer',
                        }),
                        {
                            status: 400,
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }
                query.perPage = parsedPerPage;
            }

            const uniqueField = url.searchParams.get('uniqueField');
            if (uniqueField) query.uniqueField = uniqueField;

            const uniqueValue = url.searchParams.get('uniqueValue');
            if (uniqueValue !== null) query.uniqueValue = uniqueValue;

            const uniqueIgnoreId = url.searchParams.get('uniqueIgnoreId');
            if (uniqueIgnoreId) query.uniqueIgnoreId = uniqueIgnoreId;

            const field = url.searchParams.get('field');
            if (field) query.field = field;

            const value = url.searchParams.get('value');
            if (value !== null) query.value = value;

            const search = url.searchParams.get('search');
            if (search !== null) query.search = search;

            if (Object.keys(query).length === 0) query = undefined;
        }

        // Execute secure CRUD operation
        if (!model) {
            return new Response(JSON.stringify({ error: 'Model not specified' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const result = await executeSecureCrud({
            method,
            model,
            id,
            body,
            query,
            context,
        });

        if (!result.success) {
            return new Response(JSON.stringify({ error: result.error }), {
                status: result.status || 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        if (error instanceof RLSError) {
            return new Response(
                JSON.stringify({
                    error: 'Access denied',
                    message: error.message,
                    violation: error.violation,
                }),
                {
                    status: 403,
                    headers: { 'Content-Type': 'application/json' },
                },
            );
        }

        return new Response(
            JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    }
}

/**
 * Execute secure CRUD operation with RLS from a CrudRequest
 *
 * This is the main function used by the worker when it has already parsed the request
 */
export async function executeSecureCrudRequest(
    crudRequest: CrudRequest,
    context: SecurityContext,
): Promise<CrudResponse> {
    const { method, model, id, body, query } = crudRequest;

    // Fail closed on malformed request payloads surfaced by parseCrudRequest.
    // Prevents invalid JSON bodies from silently degrading into empty-body no-ops,
    // and invalid `where` JSON from running an unfiltered query.
    if (crudRequest.parseError) {
        return {
            success: false,
            error: crudRequest.parseError.message,
            code: crudRequest.parseError.code,
            status: 400,
        };
    }

    try {
        return await executeSecureCrud({
            method,
            model,
            id,
            body,
            query,
            context,
        });
    } catch (error) {
        if (error instanceof RLSError) {
            return {
                success: false,
                error: error.message,
                code: 'RLS_ERROR',
                details: error.violation ? JSON.stringify(error.violation) : undefined,
                hint: `RLS policy violation for model: ${model}`,
                status: 403,
            };
        }

        // Handle ValidationError from BaseModel.create/update
        // Returns field-level errors for forms to display inline
        if (error && typeof error === 'object' && 'fieldErrors' in error && (error as any).name === 'ValidationError') {
            const err = error as unknown as { message?: string; fieldErrors: Record<string, string> };
            const raw = err.fieldErrors;
            const fieldErrors: Record<string, string[]> = {};
            for (const [k, v] of Object.entries(raw)) {
                fieldErrors[k] = [v];
            }
            return {
                success: false,
                error: err.message || 'Validation failed',
                code: 'VALIDATION_ERROR',
                fieldErrors,
                hint: `Validation failed for ${model}`,
                status: 422,
            };
        }

        // Handle SQLite UNIQUE constraint violations (single or composite indexes)
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('UNIQUE constraint failed')) {
            const field = parseSqliteUniqueConstraintForApi(message);
            const detail =
                field === 'slug'
                    ? 'This slug is already in use for this organization and app.'
                    : 'This value is already in use.';
            return {
                success: false,
                error: `${field} already exists`,
                code: 'UNIQUE_CONSTRAINT_VIOLATION',
                fieldErrors: { [field]: [detail] },
                hint: `A record with this ${field} already exists`,
                status: 409,
            };
        }

        const stack = error instanceof Error ? error.stack : undefined;
        console.error(`[executeSecureCrudRequest] Error for ${model}:`, {
            error: message,
            stack,
            model,
            method,
            context,
        });

        return {
            success: false,
            error: message,
            code: 'INTERNAL_SERVER_ERROR',
            details: stack,
            hint: `An error occurred while processing ${method} request for ${model}`,
            status: 500,
        };
    }
}

/**
 * Execute secure CRUD operation with RLS
 */
async function executeSecureCrud(params: {
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    model: string;
    id?: string;
    body?: any;
    query?: any;
    context: SecurityContext;
}): Promise<CrudResponse> {
    const { method, model, id, body, query, context } = params;

    // READ operations
    if (method === 'GET') {
        try {
            // Apply RLS filter
            let rlsWhere = globalRLS.applyReadFilter(model, context, query?.where);

            // Slug uniqueness must match DB scope (organization + app), not "only my rows".
            // Posts use Hierarchical RLS (organizationId + userId + appId); strip userId for /unique only.
            if (id === 'unique' && model === 'posts') {
                const { userId: _omitUserId, ...orgAndApp } = rlsWhere as Record<string, unknown>;
                rlsWhere = orgAndApp as Record<string, any>;
            }

            const crudRequest: CrudRequest = {
                method: 'GET',
                model,
                id,
                query: {
                    ...query,
                    where: rlsWhere,
                },
            };

            return handleCrud(crudRequest);
        } catch (rlsError) {
            // Re-throw RLS errors so they're caught by outer try-catch
            throw rlsError;
        }
    }

    // CREATE operations
    if (method === 'POST') {
        if (!body) {
            return { success: false, error: 'Missing request body', status: 400 };
        }

        // Validate write and inject security context
        globalRLS.validateWrite(model, context, body, 'create');

        const policyConfig = globalRLS.getPolicy(model);
        const extraWritable = new Set<string>();
        if (policyConfig?.policy?.field) extraWritable.add(policyConfig.policy.field);
        if (policyConfig?.contextFields) {
            for (const field of policyConfig.contextFields) extraWritable.add(field);
        }

        const crudRequest: CrudRequest = {
            method: 'POST',
            model,
            body,
            allowedWritableFields: extraWritable.size > 0 ? Array.from(extraWritable) : undefined,
        };

        return handleCrud(crudRequest);
    }

    // UPDATE operations (PATCH and PUT are treated the same)
    if (method === 'PATCH' || method === 'PUT') {
        if (!id) {
            return { success: false, error: 'Missing record ID', status: 400 };
        }

        if (!body) {
            return { success: false, error: 'Missing request body', status: 400 };
        }

        // First, verify the record exists and user has access
        const rlsWhere = globalRLS.applyReadFilter(model, context);
        const verifyRequest: CrudRequest = {
            method: 'GET',
            model,
            id,
            query: { where: rlsWhere },
        };

        const verifyResult = await handleCrud(verifyRequest);
        if (!verifyResult.success || !verifyResult.data) {
            return {
                success: false,
                error: 'Record not found or access denied',
                status: 404,
            };
        }

        // Validate write
        globalRLS.validateWrite(model, context, body, 'update');

        const policyConfig = globalRLS.getPolicy(model);
        const extraWritable = new Set<string>();
        if (policyConfig?.policy?.field) extraWritable.add(policyConfig.policy.field);
        if (policyConfig?.contextFields) {
            for (const field of policyConfig.contextFields) extraWritable.add(field);
        }

        const crudRequest: CrudRequest = {
            method: method === 'PUT' ? 'PUT' : 'PATCH',
            model,
            id,
            body,
            allowedWritableFields: extraWritable.size > 0 ? Array.from(extraWritable) : undefined,
        };

        return handleCrud(crudRequest);
    }

    // DELETE operations
    if (method === 'DELETE') {
        if (!id) {
            return { success: false, error: 'Missing record ID', status: 400 };
        }

        // Verify access first
        const rlsWhere = globalRLS.applyReadFilter(model, context);
        const verifyRequest: CrudRequest = {
            method: 'GET',
            model,
            id,
            query: { where: rlsWhere },
        };

        const verifyResult = await handleCrud(verifyRequest);
        if (!verifyResult.success || !verifyResult.data) {
            return {
                success: false,
                error: 'Record not found or access denied',
                status: 404,
            };
        }

        // Validate delete permission
        globalRLS.validateWrite(model, context, {}, 'delete');

        const crudRequest: CrudRequest = {
            method: 'DELETE',
            model,
            id,
        };

        return handleCrud(crudRequest);
    }

    return { success: false, error: 'Method not allowed', status: 405 };
}

/**
 * Extract security context from request
 */
export function extractSecurityContext(request: Request, env?: any): SecurityContext {
    // Extract from headers
    const userId = request.headers.get('x-user-id') || undefined;
    const organizationId = request.headers.get('x-org-id') || undefined;
    const appId = request.headers.get('x-app-id') || undefined;

    // Parse roles and permissions from header (comma-separated)
    const rolesHeader = request.headers.get('x-user-roles');
    const roles = rolesHeader ? rolesHeader.split(',').map((r) => r.trim()) : undefined;

    const permissionsHeader = request.headers.get('x-user-permissions');
    const permissions = permissionsHeader ? permissionsHeader.split(',').map((p) => p.trim()) : undefined;

    // Alternative: Extract from JWT (if using auth)
    // const token = request.headers.get('authorization')?.replace('Bearer ', '');
    // const decoded = verifyJWT(token, env.JWT_SECRET);
    // return decoded as SecurityContext;

    return {
        userId,
        organizationId: organizationId === 'null' ? null : organizationId,
        appId,
        roles,
        permissions,
    };
}

/**
 * Middleware wrapper for Cloudflare Workers
 */
export async function rlsMiddleware(
    request: Request,
    env: any,
    getContext?: (request: Request, env: any) => Promise<SecurityContext> | SecurityContext,
): Promise<Response> {
    const url = new URL(request.url);

    // Extract security context
    const context = getContext ? await getContext(request, env) : extractSecurityContext(request, env);

    // Execute secure CRUD
    return secureCrud({ request, url, context, env });
}
