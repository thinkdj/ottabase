import { Router } from '@ottabase/ottarouter';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { ApiKeys, Awaitable, Subject } from './types';

export interface ApiKeysCaller extends Subject {
    /** May create organization-wide keys (not just personal ones). */
    canManage?: boolean;
}

export interface ApiKeysRouterOptions<Env> {
    keys: ApiKeys<Env>;
    /** The host's session → subject. Null means anonymous. Never read from request headers. */
    resolveCaller: (request: Request, env: Env) => Awaitable<ApiKeysCaller | null>;
    /** Scopes a customer may ask for. Omit to accept any well-formed scope. */
    allowedScopes?: string[];
}

async function readJson<T>(request: Request): Promise<T> {
    try {
        return ((await request.json()) as T) ?? ({} as T);
    } catch {
        return {} as T;
    }
}

/** Personal keys by default; `scope: 'organization'` in the body asks for an org-wide key (managers only). */
function subjectFor(who: ApiKeysCaller, organizationWide: boolean): Subject | Response {
    if (organizationWide) {
        if (!who.organizationId)
            return errorResponse('You are not in an organization', 400, { code: 'VALIDATION_ERROR' });
        if (!who.canManage)
            return errorResponse('Only organization managers create organization keys', 403, { code: 'FORBIDDEN' });
        return { appId: who.appId, organizationId: who.organizationId, userId: null };
    }
    if (!who.userId) return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    return { appId: who.appId, organizationId: who.organizationId, userId: who.userId };
}

/**
 * `GET /` lists the caller's keys (personal, plus the organization's with `?scope=organization`);
 * `POST /` issues one and returns the plaintext ONCE; `DELETE /:id` revokes.
 */
export function createApiKeysRouter<Env>(options: ApiKeysRouterOptions<Env>): Router<Env> {
    const router = new Router<Env>();
    const caller = async (request: Request, env: Env): Promise<ApiKeysCaller | Response> =>
        (await options.resolveCaller(request, env)) ?? errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });

    router.get('/', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const subject = subjectFor(who, c.url.searchParams.get('scope') === 'organization');
        if (subject instanceof Response) return subject;
        return jsonResponse({ data: await options.keys.list(c.env, subject) });
    });

    router.post('/', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const body = await readJson<{ name?: string; scopes?: string[]; expiresAt?: number | null; scope?: string }>(
            c.req,
        );
        const subject = subjectFor(who, body.scope === 'organization');
        if (subject instanceof Response) return subject;
        const scopes = Array.isArray(body.scopes)
            ? body.scopes.filter((scope): scope is string => typeof scope === 'string')
            : [];
        if (options.allowedScopes) {
            const unknown = scopes.filter((scope) => !options.allowedScopes!.includes(scope));
            if (unknown.length) {
                return errorResponse(`Unknown scope: ${unknown.join(', ')}`, 400, {
                    code: 'VALIDATION_ERROR',
                    metadata: { allowed: options.allowedScopes },
                });
            }
        }
        if (
            body.expiresAt !== undefined &&
            body.expiresAt !== null &&
            (!Number.isFinite(body.expiresAt) || body.expiresAt <= Date.now())
        ) {
            return errorResponse('expiresAt must be a future timestamp', 400, { code: 'VALIDATION_ERROR' });
        }
        try {
            const issued = await options.keys.issue(c.env, subject, {
                name: String(body.name ?? ''),
                scopes,
                expiresAt: body.expiresAt ?? null,
            });
            return jsonResponse({ data: issued }, 201);
        } catch (error) {
            if (error instanceof Error && error.message.startsWith('[apikeys]')) {
                return errorResponse(error.message.replace('[apikeys] ', ''), 400, { code: 'VALIDATION_ERROR' });
            }
            throw error;
        }
    });

    router.delete('/:id', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const personal = subjectFor(who, false);
        if (personal instanceof Response) return personal;
        let revoked = await options.keys.revoke(c.env, personal, c.params.id);
        if (!revoked && who.organizationId && who.canManage) {
            revoked = await options.keys.revoke(
                c.env,
                { appId: who.appId, organizationId: who.organizationId, userId: null },
                c.params.id,
            );
        }
        if (!revoked) return errorResponse('Not found', 404, { code: 'NOT_FOUND' });
        return jsonResponse({ data: revoked });
    });

    return router;
}
