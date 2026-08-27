/**
 * Secure CRUD Operations with RLS
 *
 * Replaces manual tenant filtering with automatic RLS enforcement
 */

import { handleCrud, parseStrictQueryInteger, type CrudRequest, type CrudResponse } from '../crud';
import { getModel } from '../registry';
import { normalizeValidationFailure } from '../validation';
import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { globalRLS, RLSError } from './engine';
import { logSecurityViolation } from './logger';
import type { SecurityContext } from './types';

/** DB column names SQLite lists in composite UNIQUE errors (snake_case). */
const UNIQUE_FIELD_PRIORITY = ['slug', 'email', 'name', 'session_token', 'credential_id', 'referral_username'] as const;

function publicRlsFailure(context: SecurityContext): CrudResponse {
    const authenticated = Boolean(context.userId);
    return {
        success: false,
        error: authenticated ? 'Forbidden' : 'Authentication required',
        code: authenticated ? 'FORBIDDEN' : 'UNAUTHORIZED',
        status: authenticated ? 403 : 401,
    };
}

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
    prepareAuthorizedMutation?: PrepareAuthorizedMutation;
}

export interface AuthorizedMutationContext {
    method: 'POST' | 'PATCH' | 'PUT';
    model: string;
    id?: string;
    body: Record<string, unknown>;
    /** Complete authorized persistence snapshot; undefined for create. */
    currentData?: Record<string, unknown>;
    context: SecurityContext;
}

export type PrepareAuthorizedMutation = (
    mutation: AuthorizedMutationContext,
) => Promise<{ body: Record<string, unknown> } | CrudResponse> | { body: Record<string, unknown> } | CrudResponse;

export interface SecureCrudHooks {
    prepareAuthorizedMutation?: PrepareAuthorizedMutation;
}

/**
 * Secure CRUD with automatic, fail-closed RLS enforcement.
 *
 * Parses the request, derives the RLS filter from the registered policy + SecurityContext,
 * and enforces it on every read/write (verifying access before update/delete).
 */
export async function secureCrud(options: SecureCrudOptions): Promise<Response> {
    const { request, url, context, prepareAuthorizedMutation } = options;

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
                    return errorResponse('Invalid JSON body', 400, { code: 'INVALID_BODY' });
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
                return errorResponse('Invalid JSON in query parameter', 400, { code: 'INVALID_QUERY' });
            }
        } else {
            query = {};

            const whereParam = url.searchParams.get('where');
            if (whereParam) {
                try {
                    query.where = JSON.parse(whereParam);
                } catch {
                    return errorResponse('Invalid JSON in where parameter', 400, {
                        code: 'INVALID_QUERY',
                    });
                }
            }

            const orderBy = url.searchParams.get('orderBy') || url.searchParams.get('sort');
            if (orderBy) query.orderBy = orderBy;

            const orderDirection = url.searchParams.get('orderDirection') || url.searchParams.get('order');
            if (orderDirection === 'asc' || orderDirection === 'desc') {
                query.orderDirection = orderDirection;
            }

            const numericParameters: Array<{
                raw: string | null;
                name: 'limit' | 'offset' | 'page' | 'perPage';
            }> = [
                { raw: url.searchParams.get('limit'), name: 'limit' },
                { raw: url.searchParams.get('offset'), name: 'offset' },
                { raw: url.searchParams.get('page'), name: 'page' },
                {
                    raw: url.searchParams.get('perPage') ?? url.searchParams.get('per_page'),
                    name: 'perPage',
                },
            ];
            for (const parameter of numericParameters) {
                if (parameter.raw === null) continue;
                try {
                    query[parameter.name] = parseStrictQueryInteger(parameter.raw, parameter.name);
                } catch {
                    return errorResponse('Invalid query parameter', 400, {
                        code: 'INVALID_QUERY',
                        details: `${parameter.name} must be a safe integer`,
                    });
                }
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
            return errorResponse('Model not found', 404, { code: 'MODEL_NOT_FOUND' });
        }

        const result = await executeSecureCrud({
            method,
            model,
            id,
            body,
            query,
            context,
            prepareAuthorizedMutation,
        });

        if (!result.success) {
            return errorResponse(result.error || 'Request failed', result.status || 500, {
                code: result.code,
                details: result.details,
                hint: result.hint,
                messages: result.messages,
                fieldErrors: result.fieldErrors,
            });
        }

        return jsonResponse(result, 200);
    } catch (error) {
        if (error instanceof RLSError) {
            if (error.violation) {
                try {
                    await logSecurityViolation(error.violation);
                } catch {
                    // Audit logging must never mask the original authorization failure.
                }
            }
            const failure = publicRlsFailure(context);
            return errorResponse(failure.error!, failure.status, { code: failure.code });
        }

        const validation = normalizeValidationFailure(error);
        if (validation) {
            return errorResponse(validation.message, validation.status, {
                code: validation.code,
                fieldErrors: validation.fieldErrors,
            });
        }

        console.error(
            JSON.stringify({
                event: 'ottaorm_secure_crud_failed',
                method: request.method,
                path: url.pathname.slice(0, 512),
                error: redactErrorForLog(error),
            }),
        );
        return errorResponse('Internal server error', 500, { code: 'INTERNAL_SERVER_ERROR' });
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
    hooks: SecureCrudHooks = {},
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
            status: crudRequest.parseError.status ?? 400,
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
            prepareAuthorizedMutation: hooks.prepareAuthorizedMutation,
        });
    } catch (error) {
        if (error instanceof RLSError) {
            // Persist the violation at the request boundary (awaited), where it ties into the
            // response lifecycle — instead of an unreliable fire-and-forget from the constructor.
            if (error.violation) {
                try {
                    await logSecurityViolation(error.violation);
                } catch {
                    // Audit logging must never mask the original authorization failure.
                }
            }
            return publicRlsFailure(context);
        }

        const validation = normalizeValidationFailure(error);
        if (validation) {
            return {
                success: false,
                error: validation.message,
                code: validation.code,
                fieldErrors: validation.fieldErrors,
                hint: `Validation failed for ${model}`,
                status: validation.status,
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

        console.error(
            JSON.stringify({
                event: 'ottaorm_secure_crud_failed',
                model: model.slice(0, 128),
                method,
                error: redactErrorForLog(error),
            }),
        );

        return {
            success: false,
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR',
            status: 500,
        };
    }
}

/**
 * Fail closed if any RLS-managed field is not a real column on the registered model.
 * `buildWhereConditions` silently drops unknown columns, so an RLS filter referencing a
 * mistyped/missing column would otherwise evaporate and return UNSCOPED rows. When the model
 * isn't registered we skip (handleCrud returns MODEL_NOT_FOUND) — so this is also a no-op in
 * tests that register only a policy without a model.
 */
function assertSecurityColumns(model: string, fields: string[], context: SecurityContext): void {
    if (fields.length === 0) return;
    const Model = getModel(model) as { hasColumn?: (f: string) => boolean } | undefined;
    if (!Model || typeof Model.hasColumn !== 'function') return;
    for (const field of fields) {
        if (field !== undefined && !Model.hasColumn(field)) {
            throw new RLSError(
                `RLS misconfiguration: policy for "${model}" references field "${field}", which is not a column on the model. Refusing to run an unscoped query.`,
                { type: 'unauthorized_access', model, context },
            );
        }
    }
}

/**
 * Fields the RLS policy injects/enforces on writes — these must be allowed past the
 * writable-field check even if the model marks them non-editable.
 */
function securityWriteFields(model: string): string[] {
    const policyConfig = globalRLS.getPolicy(model);
    const fields = new Set<string>();
    if (policyConfig?.policy?.field) fields.add(policyConfig.policy.field);
    if (policyConfig?.contextFields) for (const f of policyConfig.contextFields) fields.add(f);
    if (policyConfig?.enforceOnWrite) for (const f of Object.keys(policyConfig.enforceOnWrite)) fields.add(f);
    return Array.from(fields);
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
    prepareAuthorizedMutation?: PrepareAuthorizedMutation;
}): Promise<CrudResponse> {
    const { method, model, id, body, query, context, prepareAuthorizedMutation } = params;

    const prepareMutation = async (
        mutationMethod: 'POST' | 'PATCH' | 'PUT',
        mutationBody: Record<string, unknown>,
        currentData?: Record<string, unknown>,
    ): Promise<{ body: Record<string, unknown> } | CrudResponse> => {
        if (!prepareAuthorizedMutation) return { body: mutationBody };
        return prepareAuthorizedMutation({
            method: mutationMethod,
            model,
            id,
            body: mutationBody,
            currentData,
            context,
        });
    };

    const mutationGuard = (
        Model: { hasColumn?: (field: string) => boolean },
        rlsFilter: Record<string, any>,
        currentData: Record<string, unknown>,
    ): NonNullable<CrudRequest['mutationGuard']> => {
        const expected: Record<string, unknown> = {};
        for (const field of ['updatedAt', 'version']) {
            if (Model.hasColumn?.(field) && Object.prototype.hasOwnProperty.call(currentData, field)) {
                expected[field] = currentData[field];
            }
        }
        return { where: rlsFilter, ...(Object.keys(expected).length > 0 ? { expected } : {}) };
    };

    // READ operations
    if (method === 'GET') {
        // Pure RLS filter (also runs role/permission checks). Validate its columns before
        // merging so a misconfigured policy fails closed instead of returning unscoped rows.
        const rlsFilter = globalRLS.getReadFilter(model, context);
        assertSecurityColumns(model, Object.keys(rlsFilter), context);

        // Merge over caller-supplied where; RLS keys win (spread last) so scope can't be widened.
        let rlsWhere: Record<string, any> = { ...(query?.where ?? {}), ...rlsFilter };

        // Slug uniqueness must match DB scope (organization + app), not "only my rows".
        // Posts use Hierarchical RLS (organizationId + userId + appId); strip userId for /unique only.
        if (id === 'unique' && model === 'posts') {
            const { userId: _omitUserId, ...orgAndApp } = rlsWhere;
            rlsWhere = orgAndApp;
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
    }

    // CREATE operations
    if (method === 'POST') {
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return { success: false, error: 'Missing request body', status: 400 };
        }

        const prepared = await prepareMutation('POST', { ...body });
        if ('success' in prepared) return prepared;
        const mutationBody = prepared.body;

        // Validate write and inject security context (mutates body to inject tenant/owner ids)
        globalRLS.validateWrite(model, context, mutationBody, 'create');

        // Fail closed: a security field that isn't a real column can't be enforced by the DB.
        const writableSecurityFields = securityWriteFields(model);
        assertSecurityColumns(model, writableSecurityFields, context);

        const crudRequest: CrudRequest = {
            method: 'POST',
            model,
            body: mutationBody,
            allowedWritableFields: writableSecurityFields.length > 0 ? writableSecurityFields : undefined,
        };

        return handleCrud(crudRequest);
    }

    // UPDATE operations (PATCH and PUT are treated the same)
    if (method === 'PATCH' || method === 'PUT') {
        if (!id) {
            return { success: false, error: 'Missing record ID', status: 400 };
        }

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return { success: false, error: 'Missing request body', status: 400 };
        }

        // First, verify the record exists and the caller has access to it (read-before-write).
        const rlsFilter = globalRLS.getReadFilter(model, context);
        assertSecurityColumns(model, Object.keys(rlsFilter), context);

        const Model = getModel(model);
        if (!Model) return handleCrud({ method, model, id, body });
        const currentData = await Model.readMutationSnapshot(id, rlsFilter);
        if (!currentData) {
            return {
                success: false,
                error: 'Record not found or access denied',
                status: 404,
            };
        }

        const prepared = await prepareMutation(method, { ...body }, currentData);
        if ('success' in prepared) return prepared;
        const mutationBody = prepared.body;

        // Validate write
        globalRLS.validateWrite(model, context, mutationBody, 'update');

        const writableSecurityFields = securityWriteFields(model);
        assertSecurityColumns(model, writableSecurityFields, context);

        const crudRequest: CrudRequest = {
            method: method === 'PUT' ? 'PUT' : 'PATCH',
            model,
            id,
            body: mutationBody,
            currentData,
            mutationGuard: mutationGuard(Model, rlsFilter, currentData),
            allowedWritableFields: writableSecurityFields.length > 0 ? writableSecurityFields : undefined,
        };

        return handleCrud(crudRequest);
    }

    // DELETE operations
    if (method === 'DELETE') {
        if (!id) {
            return { success: false, error: 'Missing record ID', status: 400 };
        }

        // Verify access first (read-before-write): you can't delete what you can't read.
        const rlsFilter = globalRLS.getReadFilter(model, context);
        assertSecurityColumns(model, Object.keys(rlsFilter), context);

        const Model = getModel(model);
        if (!Model) return handleCrud({ method: 'DELETE', model, id });
        const currentData = await Model.readMutationSnapshot(id, rlsFilter);
        if (!currentData) {
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
            mutationGuard: mutationGuard(Model, rlsFilter, currentData),
        };

        return handleCrud(crudRequest);
    }

    return { success: false, error: 'Method not allowed', status: 405 };
}

/**
 * Middleware wrapper for Cloudflare Workers
 */
export async function rlsMiddleware(
    request: Request,
    env: any,
    getContext: (request: Request, env: any) => Promise<SecurityContext> | SecurityContext,
): Promise<Response> {
    if (typeof getContext !== 'function') {
        // No safe default: deriving context from raw headers would be spoofable. Callers MUST
        // pass an explicit resolver that reads from a verified session/JWT.
        throw new Error(
            'rlsMiddleware requires an explicit getContext(request, env) that derives the SecurityContext ' +
                'from a TRUSTED source (verified session/JWT). Do not trust client-supplied headers.',
        );
    }

    const url = new URL(request.url);
    const context = await getContext(request, env);

    return secureCrud({ request, url, context, env });
}
