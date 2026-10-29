/**
 * CrudHub: generic admin data screens over any model that opted in with `static admin`.
 *
 * - `GET /api/admin/crudhub` lists the models the caller may open.
 * - `/api/admin/crudhub/{model}/{id?}` is secure CRUD (same parser, caps and RLS as `/api/ottaorm`),
 *   gated by the model's scope and permissions, refused for read-only models and the grant/auth
 *   denylist, and audit-logged on every write.
 * - `POST /api/admin/crudhub/{model}/{id}/actions/{key}` runs one declared `adminActions` entry.
 */
import {
    CRUDHUB_DENYLIST,
    CRUDHUB_RELATION_LIMIT,
    describeCrudHubModel,
    executeSecureCrudRequest,
    getCrudHubModel,
    listCrudHubModels,
    loadRelations,
    parseCrudRequest,
    parseRelationSpec,
    type BaseModel,
    type AdminAction,
    type AdminModelConfig,
    type CrudResponse,
    type CrudHubModelDescriptor,
    type CrudHubRelation,
    type ModelRegistryEntry,
} from '@ottabase/ottaorm';
import { AuditLog } from '@ottabase/ottaorm/models';
import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import { requireAdminAccess, type AdminContext } from '../lib/admin-guard';
import { getSecurityContext } from '../lib/auth-utils';
import type { ApiRouteContext } from './router';

const NO_STORE = { headers: { 'Cache-Control': 'private, no-store' } };
const WRITE_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

type HubModel = ModelRegistryEntry['model'] & {
    admin?: AdminModelConfig;
    adminActions?: Record<string, AdminAction<any, CloudflareEnv>>;
};

function isPlatformAdmin(auth: AdminContext): boolean {
    return auth.session?.user?.platformAdmin === true;
}

/**
 * Gate one model for the caller: scope first, then the model's own permission key.
 *
 * `org` models accept either an org admin (RLS scopes them to their org) or a platform admin, so a
 * platform admin with no active org is not refused with ORG_REQUIRED. `readOnly` blocks generic
 * create/update/delete only: a declared `adminActions` entry is explicit server code and still runs.
 *
 * Writes here do NOT run the per-model guards of the public `/api/ottaorm` route (post content
 * validation and publish rules, organization provisioning, comment org derivation). A model whose
 * writes need such a guard must stay `readOnly` in the hub and expose its writes as actions or a
 * custom `routes.edit` page instead.
 */
async function authorize(
    context: ApiRouteContext,
    entry: ModelRegistryEntry,
    mode: 'read' | 'write' | 'action',
): Promise<AdminContext | Response> {
    const admin = (entry.model as HubModel).admin ?? { enabled: true };
    const permission = admin.permissions?.[mode === 'read' ? 'read' : 'write'];
    const auth = await requireAdminAccess(context, {
        scope: admin.scope === 'org' ? 'either' : 'system',
        requiredPermissions: permission ? [permission] : undefined,
    });
    if (auth instanceof Response) return auth;
    if (mode === 'write' && admin.readOnly) {
        return errorResponse('This model is read-only in CrudHub', 403, { code: 'CRUDHUB_READ_ONLY' });
    }
    return auth;
}

function notFound(): Response {
    return errorResponse('Model not found', 404, { code: 'MODEL_NOT_FOUND' });
}

function crudFailure(result: CrudResponse): Response {
    return errorResponse(result.error || 'Request failed', result.status, {
        code: result.code,
        details: result.details,
        hint: result.hint,
        messages: result.messages,
        fieldErrors: result.fieldErrors,
    });
}

/** One audit row per hub write. Field names only: values may carry secrets. */
async function audit(
    context: ApiRouteContext,
    auth: AdminContext,
    action: string,
    entity: string,
    resourceId: string | undefined,
    fields?: string[],
): Promise<void> {
    try {
        await AuditLog.log({
            userId: auth.user?.id,
            userEmail: auth.user?.email ?? undefined,
            organizationId: auth.organizationId ?? undefined,
            appId: auth.appId,
            action,
            resourceType: entity,
            resourceId,
            metadata: { source: 'crudhub', fields, method: context.request.method, url: context.url.pathname },
            ipAddress: context.request.headers.get('cf-connecting-ip') ?? undefined,
            userAgent: context.request.headers.get('user-agent')?.slice(0, 200) ?? undefined,
            status: 'success',
        });
    } catch (error) {
        console.error(JSON.stringify({ event: 'crudhub_audit_failed', entity, error: redactErrorForLog(error) }));
    }
}

/** The directory: every opted-in model the caller may open, with its UI-safe descriptor. */
export async function handleCrudHubModels(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;
    const platformAdmin = isPlatformAdmin(auth);
    const permissions = auth.rbac.permissions as string[] | undefined;
    const models = listCrudHubModels().filter((model) => visibleTo(model, platformAdmin, permissions));
    return jsonResponse({ models, total: models.length }, 200, NO_STORE);
}

function visibleTo(model: CrudHubModelDescriptor, platformAdmin: boolean, permissions?: string[]): boolean {
    if (model.scope === 'system' && !platformAdmin) return false;
    const entry = getCrudHubModel(model.entity);
    const read = (entry?.model as HubModel | undefined)?.admin?.permissions?.read;
    return !read || hasGrantedPermission(permissions, read);
}

/** Secure CRUD for one hub model. `id` may be undefined (list/create) or a row id. */
export async function handleCrudHubCrud(context: ApiRouteContext, model: string): Promise<Response> {
    const { request, url, env } = context;
    const entry = getCrudHubModel(model);
    if (!entry) return notFound();

    const auth = await authorize(context, entry, WRITE_METHODS.has(request.method) ? 'write' : 'read');
    if (auth instanceof Response) return auth;

    const crudRequest = await parseCrudRequest(request, url, '/api/admin/crudhub');
    if (!crudRequest || crudRequest.model !== model) {
        return errorResponse('Invalid CrudHub request', 400, { code: 'INVALID_REQUEST' });
    }

    const securityContext = await getSecurityContext(request, auth.session, env);
    const result = await executeSecureCrudRequest(crudRequest, securityContext);
    if (!result.success) {
        if (result.status >= 500) {
            console.error(JSON.stringify({ event: 'crudhub_crud_failed', model, status: result.status }));
        }
        return crudFailure(result);
    }

    if (WRITE_METHODS.has(request.method)) {
        const action = request.method === 'POST' ? 'create' : request.method === 'DELETE' ? 'delete' : 'update';
        const created = result.data as Record<string, unknown> | undefined;
        const id = crudRequest.id ?? (created ? String(created[entry.model.primaryKey || 'id']) : undefined);
        await audit(context, auth, action, model, id, crudRequest.body ? Object.keys(crudRequest.body) : undefined);
        return jsonResponse(result.data, result.status, NO_STORE);
    }

    // A details read carries the model's declared relations, for the "Related" section.
    const relations = (entry.model as HubModel).admin?.relations;
    if (crudRequest.id && crudRequest.id !== 'unique' && relations?.length && result.data) {
        const row = result.data as Record<string, unknown>;
        row.__relations = await loadHubRelations(entry, row, relations);
    }

    // List reads carry the enabled action keys per row, so the menu only shows what will run.
    const actions = (entry.model as HubModel).adminActions;
    const listed = result.data as { data?: Record<string, unknown>[] } | undefined;
    if (actions && !crudRequest.id && Array.isArray(listed?.data)) {
        for (const row of listed.data) row.__actions = enabledActionKeys(actions, row);
    }
    return jsonResponse(result.data, 200, NO_STORE);
}

/**
 * Load `admin.relations` for one row the caller already read under RLS. The related rows come from
 * the model's relationship methods (not RLS-filtered), so the declared projections decide what an
 * admin sees; a relation into a denylisted table without one is cut to `id` and `name`. A failing
 * relation never fails the details page: it is logged and left out.
 */
async function loadHubRelations(
    entry: ModelRegistryEntry,
    row: Record<string, unknown>,
    specs: string[],
): Promise<CrudHubRelation[]> {
    const instance = new (entry.model as unknown as new (params: {
        entity: string;
        data: Record<string, unknown>;
    }) => BaseModel)({
        entity: entry.model.entity,
        data: { ...row },
    });
    const entities: Record<string, string> = {};
    try {
        await loadRelations([instance], specs, { onResolved: (path, entity) => (entities[path] ??= entity) });
    } catch (error) {
        console.error(
            JSON.stringify({
                event: 'crudhub_relations_failed',
                model: entry.model.entity,
                error: redactErrorForLog(error),
            }),
        );
        return [];
    }
    const parsed = specs.map(parseRelationSpec);
    const names = [...new Set(parsed.map((spec) => spec.name))];
    return names.map((name): CrudHubRelation => {
        const value = instance.get(name) as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
        const many = Array.isArray(value);
        let items = many ? value : value ? [value] : [];
        const entity = entities[name] ?? null;
        const projected = parsed.some((spec) => spec.name === name && spec.path.length === 1 && spec.fields);
        if (entity && CRUDHUB_DENYLIST.has(entity) && !projected) {
            items = items.map((item) => ({ id: item.id, name: item.name ?? null }));
        }
        return {
            name,
            entity,
            many,
            items: items.slice(0, CRUDHUB_RELATION_LIMIT),
            truncated: items.length > CRUDHUB_RELATION_LIMIT,
        };
    });
}

function enabledActionKeys(actions: Record<string, AdminAction<any, CloudflareEnv>>, row: Record<string, unknown>) {
    return Object.entries(actions)
        .filter(([, action]) => safeWhen(action, row))
        .map(([key]) => key);
}

function safeWhen(action: AdminAction<any, CloudflareEnv>, row: Record<string, unknown>): boolean {
    try {
        return action.when ? action.when(row) === true : true;
    } catch {
        return false;
    }
}

/** Run one declared action on one row the caller can read under RLS. */
export async function handleCrudHubAction(
    context: ApiRouteContext,
    model: string,
    id: string,
    key: string,
): Promise<Response> {
    const { request, env } = context;
    const entry = getCrudHubModel(model);
    if (!entry) return notFound();
    const action = (entry.model as HubModel).adminActions?.[key];
    if (!action) return errorResponse('Action not found', 404, { code: 'ACTION_NOT_FOUND' });

    const auth = await authorize(context, entry, 'action');
    if (auth instanceof Response) return auth;
    if (action.permission && !hasGrantedPermission(auth.rbac.permissions as string[] | undefined, action.permission)) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    const securityContext = await getSecurityContext(request, auth.session, env);
    const read = await executeSecureCrudRequest({ method: 'GET', model, id }, securityContext);
    if (!read.success) return crudFailure(read);
    const row = read.data as Record<string, unknown>;
    if (!safeWhen(action, row)) {
        return errorResponse('Action is not available for this record', 409, { code: 'ACTION_NOT_APPLICABLE' });
    }

    try {
        const result = await action.run(row, {
            env,
            request,
            user: { id: auth.user?.id, email: auth.user?.email ?? null },
            organizationId: auth.organizationId,
        });
        await audit(context, auth, `action:${key}`, model, id);
        return jsonResponse({ ok: true, result: result ?? null }, 200, NO_STORE);
    } catch (error) {
        console.error(JSON.stringify({ event: 'crudhub_action_failed', model, key, error: redactErrorForLog(error) }));
        return errorResponse('Action failed', 500, { code: 'ACTION_FAILED' });
    }
}

/** Used by the directory cards and tests: the descriptor of one model, or 404. */
export async function handleCrudHubModel(context: ApiRouteContext, model: string): Promise<Response> {
    const entry = getCrudHubModel(model);
    if (!entry) return notFound();
    const auth = await authorize(context, entry, 'read');
    if (auth instanceof Response) return auth;
    return jsonResponse(describeCrudHubModel(entry), 200, NO_STORE);
}
