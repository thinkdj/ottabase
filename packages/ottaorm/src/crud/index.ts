// ============================================================
// @ottabase/ottaorm - Generic CRUD Handler
// ============================================================
// Single handler for all model CRUD operations
// ============================================================

import { getModel, hasModel } from '../registry';

export interface CrudRequest {
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    model: string;
    id?: string;
    body?: Record<string, unknown>;
    query?: {
        where?: Record<string, unknown>;
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
        limit?: number;
        offset?: number;
        page?: number;
        perPage?: number;
        uniqueField?: string;
        uniqueValue?: string;
        uniqueIgnoreId?: string;
        field?: string;
        value?: string;
    };
}

export interface CrudResponse {
    success: boolean;
    data?: unknown;
    error?: string;
    code?: string;
    details?: string;
    hint?: string;
    messages?: string[];
    fieldErrors?: Record<string, string[]>;
    status: number;
}

/**
 * Handle a generic CRUD request for any registered model
 *
 * @example
 * ```typescript
 * // In your API route handler:
 * const result = await handleCrud({
 *   method: "GET",
 *   model: "users",
 *   query: { orderBy: "createdAt", orderDirection: "desc" }
 * });
 *
 * if (!result.success) {
 *   return new Response(JSON.stringify({ error: result.error }), { status: result.status });
 * }
 * return new Response(JSON.stringify(result.data), { status: 200 });
 * ```
 */
export async function handleCrud(request: CrudRequest): Promise<CrudResponse> {
    const { method, model: entityName, id, body, query } = request;

    // Check if model is registered
    if (!hasModel(entityName)) {
        return {
            success: false,
            error: `Model '${entityName}' not found. Make sure to register it with registerModel().`,
            status: 404,
        };
    }

    const Model = getModel(entityName)!;

    try {
        // GET uniqueness check
        if (method === 'GET' && id === 'unique') {
            const uniqueField = query?.uniqueField;
            const uniqueValue = query?.uniqueValue;

            if (!uniqueField || uniqueValue === undefined) {
                return {
                    success: false,
                    error: 'uniqueField and uniqueValue are required',
                    status: 400,
                };
            }

            const isUnique = await Model.isUnique(uniqueField, uniqueValue, {
                where: query?.where,
                ignoreId: query?.uniqueIgnoreId,
            });

            return {
                success: true,
                data: { unique: isUnique },
                status: 200,
            };
        }

        // GET with ID - find single record
        if (method === 'GET' && id) {
            const record = await Model.find(id);
            if (!record) {
                return {
                    success: false,
                    error: `${entityName} with id '${id}' not found`,
                    status: 404,
                };
            }
            return {
                success: true,
                data: record.toJson(),
                status: 200,
            };
        }

        // GET without ID - list records
        if (method === 'GET') {
            const basePath = `/api/ottaorm/${entityName}`;

            // Check for single object lookup by field/value
            if (query?.field && query?.value !== undefined) {
                const record = await Model.first({ [query.field]: query.value });
                if (!record) {
                    return {
                        success: false,
                        error: `${entityName} with ${query.field} '${query.value}' not found`,
                        status: 404,
                    };
                }
                return {
                    success: true,
                    data: record.toJson(),
                    status: 200,
                };
            }

            // Check for pagination
            if (query?.page || query?.perPage) {
                const page = query.page || 1;
                const perPage = Math.min(query.perPage || 15, 100); // Cap at 100
                const result = await Model.paginate(page, perPage, query.where, {
                    orderBy: query.orderBy,
                    orderDirection: query.orderDirection,
                });

                const totalPages = Math.max(1, result.totalPages);
                const currentPage = Math.min(Math.max(1, page), totalPages);

                return {
                    success: true,
                    data: {
                        data: result.data.map((r: any) => r.toJson()),
                        pagination: {
                            page: currentPage,
                            perPage,
                            total: result.total,
                            totalPages,
                            next:
                                currentPage < totalPages
                                    ? `${basePath}?page=${currentPage + 1}&per_page=${perPage}`
                                    : null,
                            prev: currentPage > 1 ? `${basePath}?page=${currentPage - 1}&per_page=${perPage}` : null,
                        },
                    },
                    status: 200,
                };
            }

            // Regular list (non-paginated)
            const records = await Model.where(query?.where || {}, {
                orderBy: query?.orderBy,
                orderDirection: query?.orderDirection,
                limit: query?.limit,
                offset: query?.offset,
            });

            const total = records.length;

            return {
                success: true,
                data: {
                    data: records.map((r: any) => r.toJson()),
                    pagination: {
                        page: 1,
                        perPage: total,
                        total,
                        totalPages: 1,
                        next: null,
                        prev: null,
                    },
                },
                status: 200,
            };
        }

        // POST - create new record
        if (method === 'POST') {
            if (!body) {
                return {
                    success: false,
                    error: 'Request body is required',
                    status: 400,
                };
            }
            const record = await Model.create(body);
            return {
                success: true,
                data: record.toJson(),
                status: 201,
            };
        }

        // PATCH/PUT - update record
        if ((method === 'PATCH' || method === 'PUT') && id) {
            if (!body) {
                return {
                    success: false,
                    error: 'Request body is required',
                    status: 400,
                };
            }
            const record = await Model.update(id, body);
            return {
                success: true,
                data: record.toJson(),
                status: 200,
            };
        }

        // DELETE - delete record
        if (method === 'DELETE' && id) {
            await Model.delete(id);
            return {
                success: true,
                data: { success: true, message: `${singularize(entityName)} deleted` },
                status: 200,
            };
        }

        return {
            success: false,
            error: 'Invalid request',
            status: 400,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const isD1Error = message.includes('D1_ERROR') || message.includes('SQLITE_ERROR');

        return {
            success: false,
            error: message,
            code: isD1Error ? 'DATABASE_ERROR' : 'INTERNAL_SERVER_ERROR',
            messages: [message],
            hint: isD1Error
                ? 'Make sure your database tables are initialized and migrations are up to date.'
                : undefined,
            status: 500,
        };
    }
}

/**
 * Simple singularize - removes trailing 's'
 */
function singularize(word: string): string {
    if (word.endsWith('ies')) {
        return word.slice(0, -3) + 'y';
    }
    if (word.endsWith('s') && !word.endsWith('ss')) {
        return word.slice(0, -1);
    }
    return word;
}

/**
 * Parse request URL and body into CrudRequest
 *
 * @example
 * ```typescript
 * // In Cloudflare Worker:
 * const crudRequest = await parseCrudRequest(request, url, "/api/ottaorm");
 * if (crudRequest) {
 *   const result = await handleCrud(crudRequest);
 *   return new Response(JSON.stringify(result.data || { error: result.error }), {
 *     status: result.status
 *   });
 * }
 * ```
 */
export async function parseCrudRequest(
    request: Request,
    url: URL,
    basePath: string = '/api/ottaorm',
): Promise<CrudRequest | null> {
    const path = url.pathname;

    // Check if this is a CRUD request
    if (!path.startsWith(basePath + '/')) {
        return null;
    }

    // Extract model and id from path: /api/ottaorm/users/123 -> ["users", "123"]
    const relativePath = path.slice(basePath.length + 1);
    const parts = relativePath.split('/').filter(Boolean);

    if (parts.length === 0) {
        return null;
    }

    const model = parts[0];
    const id = parts[1];

    // Parse query parameters
    const query: CrudRequest['query'] = {};

    const whereParam = url.searchParams.get('where');
    if (whereParam) {
        try {
            query.where = JSON.parse(whereParam);
        } catch (error) {
            // Log invalid JSON in "where" to aid debugging, but keep behavior lenient
            console.warn('ottaorm: Ignoring invalid JSON in "where" query parameter:', whereParam, error);
        }
    }

    const orderBy = url.searchParams.get('orderBy') || url.searchParams.get('sort');
    if (orderBy) query.orderBy = orderBy;

    const orderDirection = url.searchParams.get('orderDirection') || url.searchParams.get('order');
    if (orderDirection === 'asc' || orderDirection === 'desc') {
        query.orderDirection = orderDirection;
    }

    const limit = url.searchParams.get('limit');
    if (limit) query.limit = parseInt(limit, 10);

    const offset = url.searchParams.get('offset');
    if (offset) query.offset = parseInt(offset, 10);

    const page = url.searchParams.get('page');
    if (page) query.page = parseInt(page, 10);

    // Support both perPage and per_page
    const perPage = url.searchParams.get('perPage') || url.searchParams.get('per_page');
    if (perPage) query.perPage = parseInt(perPage, 10);

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

    // Parse body for POST/PATCH/PUT
    let body: Record<string, unknown> | undefined;
    if (request.method === 'POST' || request.method === 'PATCH' || request.method === 'PUT') {
        try {
            body = (await request.json()) as Record<string, unknown>;
        } catch {
            body = {};
        }
    }

    return {
        method: request.method as CrudRequest['method'],
        model,
        id,
        body,
        query: Object.keys(query).length > 0 ? query : undefined,
    };
}

// NOTE: tenant-aware CRUD exports are commented out to avoid circular dependencies during build
// Users can import directly from '@ottabase/ottaorm/crud/tenant-aware' if needed
// export { handleTenantAwareCrud, tenantAwareCrudMiddleware, type TenantAwareCrudOptions } from "./tenant-aware";
