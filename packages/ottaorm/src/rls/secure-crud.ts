/**
 * Secure CRUD Operations with RLS
 *
 * Replaces manual tenant filtering with automatic RLS enforcement
 */

import { handleCrud, type CrudRequest, type CrudResponse } from '../crud';
import { globalRLS, RLSError } from './engine';
import type { SecurityContext } from './types';

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
        const model = pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];
        const id = pathParts.length > 3 ? pathParts[pathParts.length - 1] : undefined;
        const method = request.method as 'GET' | 'POST' | 'PATCH' | 'DELETE';

        // Parse request body
        let body: any = null;
        if (method === 'POST' || method === 'PATCH') {
            const text = await request.text();
            body = text ? JSON.parse(text) : null;
        }

        // Parse query params
        const queryString = url.searchParams.get('query');
        const query = queryString ? JSON.parse(queryString) : undefined;

        // Execute secure CRUD operation
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

        const message = error instanceof Error ? error.message : 'Unknown error';
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
            const rlsWhere = globalRLS.applyReadFilter(model, context, query?.where);

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

        const crudRequest: CrudRequest = {
            method: 'POST',
            model,
            body,
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

        const crudRequest: CrudRequest = {
            method: method === 'PUT' ? 'PUT' : 'PATCH',
            model,
            id,
            body,
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
    const organizationId = request.headers.get('x-organization-id') || undefined;
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
