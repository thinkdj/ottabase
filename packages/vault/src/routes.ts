import { Router, type Ctx } from '@ottabase/ottarouter';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { DEFAULT_MAX_MANUAL_BACKUPS, DEFAULT_MIN_BACKUP_INTERVAL_MINUTES } from './constants';
import { VaultError, type Awaitable, type Vault } from './types';

export interface VaultCaller {
    userId: string;
    organizationId: string | null;
    appId: string;
    /** Platform (system-scoped) administrator: the only one who backs up and restores. */
    platformAdmin?: boolean;
    /** May export the organization they are in. */
    canManage?: boolean;
}

export interface VaultRouterOptions<Env> {
    vault: Vault<Env>;
    /** The host's session → caller. Null means anonymous. Never read from request headers. */
    resolveCaller: (request: Request, env: Env) => Awaitable<VaultCaller | null>;
    /** Guard for everything but `/export/me`. Defaults to `caller.platformAdmin === true`. */
    requireAdmin?: (c: Ctx<Env>, caller: VaultCaller) => Awaitable<Response | null>;
    /** The column a tenant export filters on. Default `organization_id`; personal exports use `user_id`. */
    tenantColumn?: string;
    userColumn?: string;
    /** Manual backups that may exist at once; one more answers 409 `BACKUP_LIMIT`. Default 10. */
    maxManualBackups?: number;
    /** Minutes between two manual backups; sooner answers 429 `TOO_SOON`. Default 10; 0 turns it off. */
    minBackupIntervalMinutes?: number;
}

async function readJson<T>(request: Request): Promise<T> {
    try {
        return ((await request.json()) as T) ?? ({} as T);
    } catch {
        return {} as T;
    }
}

function failed(error: unknown): Response {
    if (error instanceof VaultError) {
        if (error.code === 'NO_BUCKET') return errorResponse(error.message, 503, { code: 'NOT_CONFIGURED' });
        if (error.code === 'NOT_FOUND') return errorResponse(error.message, 404, { code: 'NOT_FOUND' });
        return errorResponse(error.message, 400, { code: 'VALIDATION_ERROR' });
    }
    throw error;
}

/** Refuse a config count that is not a whole number at or above `min`: a NaN cap would silently mean "no cap". */
export function assertCount(name: string, value: number, min = 0): void {
    if (!Number.isInteger(value) || value < min) {
        throw new Error(`[vault] ${name} must be a whole number of at least ${min}, got ${String(value)}`);
    }
}

function tableList(value: unknown): string[] | undefined {
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? (value as string[]) : undefined;
}

/**
 * Platform admin: `GET|POST /backups`, `GET|DELETE /backups/:id`,
 * `POST /backups/:id/restore` (body `{ confirm: id, tables?, truncate? }`), and
 * `GET /export?organizationId=|userId=` for any tenant.
 * Any signed-in user: `GET /export/me`, their organization (when they manage it) or their own rows.
 */
export function createVaultRouter<Env>(options: VaultRouterOptions<Env>): Router<Env> {
    const router = new Router<Env>();
    const tenantColumn = options.tenantColumn ?? 'organization_id';
    const userColumn = options.userColumn ?? 'user_id';
    const maxManual = options.maxManualBackups ?? DEFAULT_MAX_MANUAL_BACKUPS;
    const minIntervalMinutes = options.minBackupIntervalMinutes ?? DEFAULT_MIN_BACKUP_INTERVAL_MINUTES;
    assertCount('maxManualBackups', maxManual);
    assertCount('minBackupIntervalMinutes', minIntervalMinutes);
    const minIntervalMs = minIntervalMinutes * 60_000;
    const caller = async (request: Request, env: Env): Promise<VaultCaller | Response> =>
        (await options.resolveCaller(request, env)) ?? errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    const admin = async (c: Ctx<Env>): Promise<VaultCaller | Response> => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const denied = options.requireAdmin
            ? await options.requireAdmin(c, who)
            : who.platformAdmin === true
              ? null
              : errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
        return denied ?? who;
    };
    const download = (env: Env, column: string, value: string, name: string): Response =>
        new Response(options.vault.export(env, { column, value }), {
            status: 200,
            headers: {
                'content-type': 'application/x-ndjson; charset=utf-8',
                'content-disposition': `attachment; filename="${name}.ndjson"`,
                'cache-control': 'no-store',
            },
        });

    router.get('/backups', async (c) => {
        const who = await admin(c);
        if (who instanceof Response) return who;
        const limit = Math.min(Math.max(Number(c.url.searchParams.get('limit')) || 20, 1), 100);
        try {
            return jsonResponse({ data: await options.vault.list(c.env, limit) });
        } catch (error) {
            return failed(error);
        }
    });

    router.post('/backups', async (c) => {
        const who = await admin(c);
        if (who instanceof Response) return who;
        const body = await readJson<{ tables?: unknown; label?: unknown; objects?: unknown }>(c.req);
        try {
            // ponytail: list-then-backup, so two simultaneous clicks can both pass; fine for an admin-only button.
            const manual = (await options.vault.list(c.env, Number.MAX_SAFE_INTEGER)).filter(
                (manifest) => manifest.trigger === 'manual',
            );
            if (manual.length >= maxManual) {
                return errorResponse(
                    `${manual.length} manual backups already exist, the most allowed. Delete an older one first.`,
                    409,
                    { code: 'BACKUP_LIMIT' },
                );
            }
            const waitMs = manual[0] ? Date.parse(manual[0].createdAt) + minIntervalMs - Date.now() : 0;
            if (waitMs > 0) {
                const minutes = Math.ceil(waitMs / 60_000);
                const response = errorResponse(
                    `The last manual backup was moments ago. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
                    429,
                    { code: 'TOO_SOON' },
                );
                response.headers.set('Retry-After', String(Math.ceil(waitMs / 1000)));
                return response;
            }
            const manifest = await options.vault.backup(c.env, {
                tables: tableList(body.tables),
                label: typeof body.label === 'string' ? body.label.slice(0, 120) : undefined,
                objects: body.objects !== false,
            });
            return jsonResponse({ data: manifest }, 201);
        } catch (error) {
            return failed(error);
        }
    });

    router.get('/backups/:id', async (c) => {
        const who = await admin(c);
        if (who instanceof Response) return who;
        try {
            const manifest = await options.vault.manifest(c.env, c.params.id);
            return manifest
                ? jsonResponse({ data: manifest })
                : errorResponse('Backup not found', 404, { code: 'NOT_FOUND' });
        } catch (error) {
            return failed(error);
        }
    });

    router.delete('/backups/:id', async (c) => {
        const who = await admin(c);
        if (who instanceof Response) return who;
        try {
            const removed = await options.vault.remove(c.env, c.params.id);
            return removed
                ? jsonResponse({ data: { id: c.params.id, removed: true } })
                : errorResponse('Backup not found', 404, { code: 'NOT_FOUND' });
        } catch (error) {
            return failed(error);
        }
    });

    router.post('/backups/:id/restore', async (c) => {
        const who = await admin(c);
        if (who instanceof Response) return who;
        const body = await readJson<{ confirm?: unknown; tables?: unknown; truncate?: unknown; objects?: unknown }>(
            c.req,
        );
        if (body.confirm !== c.params.id) {
            return errorResponse('Send { "confirm": "<backup id>" } to restore; this replaces live rows', 400, {
                code: 'VALIDATION_ERROR',
            });
        }
        try {
            const result = await options.vault.restore(c.env, c.params.id, {
                tables: tableList(body.tables),
                truncate: body.truncate !== false,
                objects: body.objects !== false,
            });
            return jsonResponse({ data: result });
        } catch (error) {
            return failed(error);
        }
    });

    router.get('/export', async (c) => {
        const who = await admin(c);
        if (who instanceof Response) return who;
        const organizationId = c.url.searchParams.get('organizationId');
        const userId = c.url.searchParams.get('userId');
        if (organizationId) return download(c.env, tenantColumn, organizationId, `organization-${organizationId}`);
        if (userId) return download(c.env, userColumn, userId, `user-${userId}`);
        return errorResponse('organizationId or userId is required', 400, { code: 'VALIDATION_ERROR' });
    });

    router.get('/export/me', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        if (who.organizationId && who.canManage) {
            return download(c.env, tenantColumn, who.organizationId, `organization-${who.organizationId}`);
        }
        return download(c.env, userColumn, who.userId, `user-${who.userId}`);
    });

    return router;
}
