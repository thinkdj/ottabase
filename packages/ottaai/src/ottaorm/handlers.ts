// ====================================================================
// @ottabase/ottaai/ottaorm — the route factory
// --------------------------------------------------------------------
// A ROUTE FACTORY, NOT A CRUD BRANCH.
//
// Credentials could be exposed through generic auto-CRUD, and this framework
// forbids custom CRUD endpoints without a real non-CRUD need — so an app would
// otherwise add a model-specific branch to its shared CRUD handler that
// force-sets tenancy from the session, plus a post-write branch calling the
// activation static. Forgetting either is a cross-tenant write or a broken
// invariant, WITH NO ERROR.
//
// TWO COORDINATED RESPONSES, BOTH REQUIRED:
//  1. these mounted handlers derive tenancy from the app-supplied context and
//     NEVER read tenancy from the body (this is also where the filter/sort
//     deny-list lives);
//  2. tenancy stamping and sibling deactivation live INSIDE the model's
//     create/update overrides, because auto-CRUD calls the statics directly and
//     these handlers are not the only write path.
// ====================================================================

import { errorResponse } from '@ottabase/utils/http-errors';
import { AI_ERROR_HTTP_STATUS, AiProvisioningError, AI_ERROR_CODES } from '../errors';
import { CREDENTIAL_QUERY_DENY_LIST } from '../fields';
import { KEY_HINT_MASK } from '../secret';
import type { AiContext } from '../types';
import { toCredentialView, type AiProvisioning } from '../resolver';
import { verifyCredential, type VerifyInput, type VerifyLimiter } from '../resolver/verify';
import { AiProviderCredential } from './AiProviderCredential';

export interface CredentialHandlerOptions<HostContext = unknown> {
    /**
     * Turns a `Request` into the host security context the instance's `contextFrom` maps.
     *
     * Return `null` for an unauthenticated caller. NAMED `contextFromRequest` and OWNED BY
     * THE APP — deliberately a different name from the instance's `contextFrom`, because
     * two functions called `contextFrom` is a conflation waiting to happen.
     */
    contextFromRequest: (request: Request) => Promise<HostContext | null> | HostContext | null;
    /** Shared verification budget. Defaults to the package's in-memory limiter. */
    verifyLimiter?: VerifyLimiter;
    /** Base path the handlers are mounted at, used only for building `next`/`self` links. */
    basePath?: string;
}

export interface CredentialHandlers {
    /** `GET  <base>/credentials` */
    list(request: Request): Promise<Response>;
    /** `POST <base>/credentials` */
    create(request: Request): Promise<Response>;
    /** `PATCH <base>/credentials/:id` */
    update(request: Request, id: string): Promise<Response>;
    /** `DELETE <base>/credentials/:id` */
    remove(request: Request, id: string): Promise<Response>;
    /** `POST <base>/credentials/:id/activate` */
    activate(request: Request, id: string): Promise<Response>;
    /** `POST <base>/credentials/test` — ALWAYS HTTP 200 for a classified result. */
    test(request: Request): Promise<Response>;
    /** `GET  <base>/status` */
    status(request: Request): Promise<Response>;
    /** `GET  <base>/providers` — the registry, for the form. */
    providers(request: Request): Promise<Response>;
    /** `GET  <base>/explain?task=<key>` — support surface. Verdict projection only. */
    explain(request: Request): Promise<Response>;
}

/**
 * Strategies under which an org-scoped row can actually be SELECTED.
 *
 * Under `strategy: 'user'` an org-only row scores 0 in every match class and is therefore
 * permanently unselectable — a rung the write path can produce but the resolver can never
 * choose is dead data that errors nowhere.
 */
const ORG_MANAGEABLE_STRATEGIES = new Set(['org', 'user-then-org', 'org-then-user']);

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
    try {
        const parsed = await request.json();
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

/**
 * THE FILTER / SORT DENY-LIST.
 *
 * Marking a column hidden covers SERIALISATION. It does not cover `where` / `orderBy`,
 * which the framework passes straight through to the model — and the `filterable` /
 * `sortable` field metadata is read by nobody. So a filterable secret column is an
 * equality and ordering ORACLE reachable through an endpoint no one wrote by hand.
 *
 * Applied here, in the package, so no consumer has to remember it.
 */
function rejectDeniedQuery(url: URL): string | null {
    const denied = new Set(CREDENTIAL_QUERY_DENY_LIST.map((field) => field.toLowerCase()));

    const orderBy = url.searchParams.get('orderBy') ?? url.searchParams.get('sort');
    if (orderBy && denied.has(orderBy.toLowerCase())) return orderBy;

    for (const param of ['field', 'uniqueField'] as const) {
        const value = url.searchParams.get(param);
        if (value && denied.has(value.toLowerCase())) return value;
    }

    const where = url.searchParams.get('where');
    if (where) {
        try {
            const parsed = JSON.parse(where) as Record<string, unknown>;
            for (const key of Object.keys(parsed)) {
                if (denied.has(key.toLowerCase())) return key;
            }
        } catch {
            return '__invalid_where__';
        }
    }
    return null;
}

function errorFrom(error: unknown): Response {
    if (error instanceof AiProvisioningError) {
        return errorResponse(error.message, AI_ERROR_HTTP_STATUS[error.code] ?? 400, {
            code: error.code,
            ...(error.details?.field ? { fieldErrors: { [String(error.details.field)]: [error.message] } } : {}),
        });
    }
    return errorResponse(error instanceof Error ? error.message : 'Unexpected error', 500, {
        code: AI_ERROR_CODES.ERROR,
    });
}

export function createCredentialHandlers<HostContext>(
    instance: AiProvisioning<HostContext>,
    options?: CredentialHandlerOptions<HostContext>,
): CredentialHandlers {
    if (!options?.contextFromRequest) {
        throw new AiProvisioningError(
            'createAiProvisioningWithStorage({ handlers: { contextFromRequest } }) is required to mount the ' +
                'credential routes. Tenancy must come from an authenticated context, never from the request body.',
            AI_ERROR_CODES.CONFIGURATION,
        );
    }
    const contextFromRequest = options.contextFromRequest;

    async function withContext(
        request: Request,
    ): Promise<{ ok: true; context: AiContext } | { ok: false; response: Response }> {
        const host = await contextFromRequest(request);
        if (host === null || host === undefined) {
            return { ok: false, response: errorResponse('Authentication required', 401, { code: 'UNAUTHENTICATED' }) };
        }
        return { ok: true, context: instance.contextFrom(host) };
    }

    /** Authorization for a specific row, using the instance's `authorize` hook. */
    async function authorizeRow(
        context: AiContext,
        operation: Parameters<typeof instance.authorizeOp>[0]['operation'],
        credential: { id: string | null; organizationId: string | null; userId: string | null } | null,
    ): Promise<Response | null> {
        const allowed = await instance.authorizeOp({ context, operation, credential });
        if (allowed) return null;
        return errorResponse('You do not have permission to manage this AI provider connection.', 403, {
            code: AI_ERROR_CODES.FORBIDDEN,
        });
    }

    async function loadInScope(context: AiContext, id: string) {
        return instance.store.findByIdInScope(
            { organizationId: context.organizationId, userId: context.userId, appId: context.appId },
            id,
        );
    }

    /** Same 404 for "not found" and "not yours" — closes the existence oracle. */
    const notFound = () => errorResponse('Provider connection not found', 404, { code: 'NOT_FOUND' });

    return {
        async list(request) {
            const auth = await withContext(request);
            if (!auth.ok) return auth.response;

            const url = new URL(request.url);
            const denied = rejectDeniedQuery(url);
            if (denied) {
                return errorResponse(`Filtering or sorting by "${denied}" is not allowed.`, 400, {
                    code: 'FIELD_NOT_QUERYABLE',
                });
            }

            const records = await instance.store.findCandidates(
                {
                    organizationId: auth.context.organizationId,
                    userId: auth.context.userId,
                    appId: auth.context.appId,
                },
                instance.strategy,
            );

            // De-dupe (the fan-out returns a both-dimension row twice) and project.
            const seen = new Set<string>();
            const data = [];
            for (const record of records) {
                if (seen.has(record.id)) continue;
                seen.add(record.id);
                // STRICT ON BOTH SIDES, matching `store.findByIdInScope`. Listing is the
                // discovery half of the same boundary: a row this app may not load, re-key or
                // delete must not appear here either — including an unbound (`appId: null`)
                // row, which the previous `record.appId && …` form let through for every app.
                if ((record.appId ?? null) !== (auth.context.appId ?? null)) continue;

                const view = toCredentialView(record);

                // THE HINT IS ADMIN-ONLY ON AN ORG ROW.
                //
                // Every member of an org can legitimately SEE that a shared key exists — they
                // need that to understand why their prompts are billed to the workspace. They
                // do not need its last four characters. `hasSecret` is enough to render "your
                // organization has a key configured" without handing key material to every
                // seat, so an unauthorized member gets the bare mask instead.
                if (record.organizationId) {
                    const mayReadHint = await instance.authorizeOp({
                        context: auth.context,
                        operation: 'status',
                        credential: {
                            id: record.id,
                            organizationId: record.organizationId,
                            userId: record.userId,
                        },
                    });
                    if (!mayReadHint) view.keyHint = view.hasSecret ? KEY_HINT_MASK : '';
                }

                data.push(view);
            }
            data.sort((a, b) => b.updatedAt - a.updatedAt);
            return json({ data });
        },

        async create(request) {
            const auth = await withContext(request);
            if (!auth.ok) return auth.response;

            const body = await readJson(request);
            if (!body) return errorResponse('Invalid JSON body', 400, { code: 'INVALID_JSON' });

            // `scope` selects the tenancy rung; the VALUES always come from the
            // authenticated context, never from the body.
            const scope = body.scope === 'organization' ? 'organization' : 'user';
            const organizationId = scope === 'organization' ? auth.context.organizationId : null;
            const userId = scope === 'organization' ? null : auth.context.userId;

            // TWO INDEPENDENT REASONS ORG SCOPE CAN BE UNAVAILABLE, both enforced here.
            //
            // 1. THE OPERATOR TURNED IT OFF (`allowOrgCredentials: false`). This dial used to
            //    reach only the settings component's `allowOrgScope` prop — so it hid a radio
            //    button and nothing more. A `POST /api/ai/credentials {"scope":"organization"}`
            //    from curl still succeeded for any admin, which is precisely the caller the
            //    dial exists to stop. A gate enforced only in the browser is not a gate.
            //
            // 2. THE STRATEGY CANNOT SELECT SUCH A ROW. Under `strategy: 'user'` an org-only
            //    row scores 0 and is permanently unselectable, so accepting the write would
            //    succeed, list fine, and never once be used.
            if (scope === 'organization' && !instance.orgCredentialsAllowed) {
                return errorResponse('Organization-wide AI keys are disabled on this deployment.', 400, {
                    code: 'ORG_SCOPE_UNAVAILABLE',
                    hint: 'allowOrgCredentials=false',
                });
            }

            if (scope === 'organization' && !ORG_MANAGEABLE_STRATEGIES.has(instance.strategy)) {
                return errorResponse(
                    "Organization-wide keys are not available under this deployment's AI strategy.",
                    400,
                    { code: 'ORG_SCOPE_UNAVAILABLE', hint: `strategy=${instance.strategy}` },
                );
            }

            if (scope === 'organization' && !organizationId) {
                return errorResponse('No active organization', 400, { code: 'ORG_REQUIRED' });
            }

            const denied = await authorizeRow(auth.context, 'create', { id: null, organizationId, userId });
            if (denied) return denied;

            try {
                const created = await AiProviderCredential.create({
                    label: body.label,
                    provider: body.provider,
                    model: body.model,
                    secret: body.secret,
                    alias: body.alias,
                    enabled: body.enabled,
                    transportConfig: body.transportConfig,
                    organizationId,
                    userId,
                    appId: auth.context.appId,
                });
                return json({ data: toCredentialView(created.toRecord()) }, 201);
            } catch (error) {
                return errorFrom(error);
            }
        },

        async update(request, id) {
            const auth = await withContext(request);
            if (!auth.ok) return auth.response;

            const existing = await loadInScope(auth.context, id);
            if (!existing) return notFound();

            const denied = await authorizeRow(auth.context, 'update', {
                id: existing.id,
                organizationId: existing.organizationId,
                userId: existing.userId,
            });
            if (denied) return denied;

            const body = await readJson(request);
            if (!body) return errorResponse('Invalid JSON body', 400, { code: 'INVALID_JSON' });

            try {
                const updated = await AiProviderCredential.update(id, {
                    ...(body.label !== undefined ? { label: body.label } : {}),
                    ...(body.provider !== undefined ? { provider: body.provider } : {}),
                    ...(body.model !== undefined ? { model: body.model } : {}),
                    ...(body.secret !== undefined ? { secret: body.secret } : {}),
                    ...(body.alias !== undefined ? { alias: body.alias } : {}),
                    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
                    ...(body.clearSecret !== undefined ? { clearSecret: body.clearSecret } : {}),
                    ...(body.transportConfig !== undefined ? { transportConfig: body.transportConfig } : {}),
                });
                return json({ data: toCredentialView(updated.toRecord()) });
            } catch (error) {
                return errorFrom(error);
            }
        },

        async remove(request, id) {
            const auth = await withContext(request);
            if (!auth.ok) return auth.response;

            const existing = await loadInScope(auth.context, id);
            if (!existing) return notFound();

            const denied = await authorizeRow(auth.context, 'delete', {
                id: existing.id,
                organizationId: existing.organizationId,
                userId: existing.userId,
            });
            if (denied) return denied;

            await instance.store.deleteById(id);
            return json({ data: { deleted: true, id } });
        },

        async activate(request, id) {
            const auth = await withContext(request);
            if (!auth.ok) return auth.response;

            const existing = await loadInScope(auth.context, id);
            if (!existing) return notFound();

            const denied = await authorizeRow(auth.context, 'activate', {
                id: existing.id,
                organizationId: existing.organizationId,
                userId: existing.userId,
            });
            if (denied) return denied;

            const ok = await instance.store.markActive(id);
            if (!ok) return notFound();
            const refreshed = await loadInScope(auth.context, id);
            return json({ data: refreshed ? toCredentialView(refreshed) : { id, isActive: true } });
        },

        async test(request) {
            const auth = await withContext(request);
            if (!auth.ok) return auth.response;

            const body = await readJson(request);
            if (!body) return errorResponse('Invalid JSON body', 400, { code: 'INVALID_JSON' });

            const input: VerifyInput =
                typeof body.credentialId === 'string' && body.credentialId
                    ? { kind: 'saved', credentialId: body.credentialId }
                    : {
                          kind: 'inline',
                          provider: String(body.provider ?? ''),
                          model: typeof body.model === 'string' ? body.model : null,
                          secret: String(body.secret ?? ''),
                      };

            if (input.kind === 'inline' && !input.provider) {
                return errorResponse('A provider is required to test a key.', 400, { code: 'VALIDATION_ERROR' });
            }

            const result = await verifyCredential(instance, auth.context, input, {
                limiter: options.verifyLimiter,
            });
            // ANSWER HTTP 200 FOR A CLASSIFIED RESULT and render from the `code` — a
            // validation failure is a RESULT, not a transport error. (Auth, scope and
            // payload-validation failures above are ordinary API errors and use
            // `errorResponse`.)
            return json({ data: result });
        },

        async status(request) {
            const auth = await withContext(request);
            if (!auth.ok) return auth.response;
            const status = await instance.status(auth.context);
            return json({ data: status });
        },

        async providers(request) {
            const auth = await withContext(request);
            if (!auth.ok) return auth.response;
            return json({
                // TENANT-SELECTABLE ONLY — this endpoint feeds the BYOK form. Listing a
                // provider here that `create` then rejects is a form that offers a choice the
                // server refuses.
                data: instance.registry.tenantSelectable().map((entry) => ({
                    id: entry.id,
                    displayName: entry.displayName,
                    requiresKey: entry.requiresKey,
                    keyFormatHint: entry.keyFormatHint ?? null,
                    docsUrl: entry.docsUrl ?? null,
                    allowCustomModel: entry.allowCustomModel !== false,
                    models: (entry.models ?? []).map((model) => ({ id: model.id, label: model.label ?? model.id })),
                })),
            });
        },

        async explain(request) {
            const auth = await withContext(request);
            if (!auth.ok) return auth.response;

            const url = new URL(request.url);
            const taskKey = url.searchParams.get('task');
            if (!taskKey) {
                return errorResponse('A task key is required.', 400, { code: 'VALIDATION_ERROR' });
            }
            try {
                // Returns a VERDICT PROJECTION, never `CredentialRecord`s — a version that
                // returned records would serve every ciphertext in scope over HTTP and into
                // ticket attachments.
                const explained = await instance.explainResolution(auth.context, taskKey);
                return json({ data: explained });
            } catch (error) {
                return errorFrom(error);
            }
        },
    };
}
