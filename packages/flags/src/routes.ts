import { Router, type Ctx } from '@ottabase/ottarouter';
import { DomainValidationError } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { FlagOverride } from './ottaorm-models/FlagOverride';
import type { Awaitable, Flags, Subject } from './types';

export interface FlagsCaller extends Subject {
    /** Set when the caller is a platform admin; only they read and write overrides. */
    platformAdmin?: boolean;
}

export interface FlagsRouterOptions<Env> {
    flags: Flags<Env>;
    /** The host's session → subject. Null means anonymous. Never read from request headers. */
    resolveCaller: (request: Request, env: Env) => Awaitable<FlagsCaller | null>;
    /**
     * Guard for the override endpoints. Defaults to `caller.platformAdmin === true`; a host that
     * wants its own admin guard (otta-web's `requireAdminAccess`) passes it here.
     */
    requireAdmin?: (c: Ctx<Env>, caller: FlagsCaller) => Awaitable<Response | null>;
}

async function readJson<T>(request: Request): Promise<T> {
    try {
        return ((await request.json()) as T) ?? ({} as T);
    } catch {
        return {} as T;
    }
}

/**
 * `GET /me` — the caller's own entitlements (what the client gate renders from).
 * `GET /overrides`, `POST /overrides`, `DELETE /overrides/:id` — operator overrides, admin only.
 */
export function createFlagsRouter<Env>(options: FlagsRouterOptions<Env>): Router<Env> {
    const router = new Router<Env>();
    const caller = async (request: Request, env: Env): Promise<FlagsCaller | Response> =>
        (await options.resolveCaller(request, env)) ?? errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    const admin = async (c: Ctx<Env>, who: FlagsCaller): Promise<Response | null> => {
        if (options.requireAdmin) return options.requireAdmin(c, who);
        return who.platformAdmin === true ? null : errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    };

    router.get('/me', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        return jsonResponse({ data: await options.flags.resolve(c.env, who) });
    });

    router.get('/overrides', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const denied = await admin(c, who);
        if (denied) return denied;
        const where: Record<string, unknown> = { appId: who.appId };
        const organizationId = c.url.searchParams.get('organizationId');
        const userId = c.url.searchParams.get('userId');
        if (organizationId) where.organizationId = organizationId;
        if (userId) where.userId = userId;
        const rows = (await FlagOverride.where(where, {
            orderBy: 'createdAt',
            orderDirection: 'desc',
            limit: 200,
        })) as FlagOverride[];
        return jsonResponse({
            data: rows.map((row) => ({
                ...row.toOverride(),
                organizationId: row.get('organizationId'),
                userId: row.get('userId'),
            })),
        });
    });

    router.post('/overrides', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const denied = await admin(c, who);
        if (denied) return denied;
        const body = await readJson<{
            organizationId?: string | null;
            userId?: string | null;
            key?: string;
            value?: unknown;
            reason?: string;
            expiresAt?: number | null;
        }>(c.req);
        try {
            const row = (await FlagOverride.create({
                appId: who.appId,
                organizationId: body.organizationId ?? null,
                userId: body.userId ?? null,
                key: body.key,
                value: body.value,
                reason: body.reason ?? null,
                createdBy: who.userId,
                expiresAt: body.expiresAt ?? null,
            })) as FlagOverride;
            options.flags.invalidate();
            return jsonResponse({ data: row.toOverride() }, 201);
        } catch (error) {
            if (error instanceof DomainValidationError) {
                return errorResponse(error.message, 400, { code: 'VALIDATION_ERROR', fieldErrors: error.fieldErrors });
            }
            throw error;
        }
    });

    router.delete('/overrides/:id', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const denied = await admin(c, who);
        if (denied) return denied;
        const row = (await FlagOverride.first({ id: c.params.id, appId: who.appId })) as FlagOverride | null;
        if (!row) return errorResponse('Not found', 404, { code: 'NOT_FOUND' });
        await FlagOverride.delete(c.params.id);
        options.flags.invalidate();
        return jsonResponse({ data: { id: c.params.id } });
    });

    return router;
}
