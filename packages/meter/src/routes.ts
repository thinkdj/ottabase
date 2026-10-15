import { Router, type Ctx } from '@ottabase/ottarouter';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { Awaitable, Meter, Subject } from './types';

export interface MeterCaller extends Subject {
    platformAdmin?: boolean;
}

export interface MeterRouterOptions<Env> {
    meter: Meter<Env>;
    /** The host's session → subject. Null means anonymous. Never read from request headers. */
    resolveCaller: (request: Request, env: Env) => Awaitable<MeterCaller | null>;
    /** Guard for grant/top-up/reset. Defaults to `caller.platformAdmin === true`. */
    requireAdmin?: (c: Ctx<Env>, caller: MeterCaller) => Awaitable<Response | null>;
}

interface AdminBody {
    organizationId?: string | null;
    userId?: string | null;
    meter?: string;
    credits?: number | null;
    amount?: number;
    periodEnd?: number | null;
    resetCredits?: number | null;
}

async function readJson<T>(request: Request): Promise<T> {
    try {
        return ((await request.json()) as T) ?? ({} as T);
    } catch {
        return {} as T;
    }
}

function target(who: MeterCaller, body: AdminBody): Subject | Response {
    const subject: Subject = {
        appId: who.appId,
        organizationId: typeof body.organizationId === 'string' ? body.organizationId : null,
        userId: typeof body.userId === 'string' ? body.userId : null,
    };
    if (!subject.organizationId && !subject.userId) {
        return errorResponse('A balance belongs to an organization or a user', 400, { code: 'VALIDATION_ERROR' });
    }
    return subject;
}

function meterName(value: unknown): string | Response {
    return typeof value === 'string' && /^[a-z][a-z0-9._:-]{0,63}$/i.test(value)
        ? value
        : errorResponse('A meter name is required', 400, { code: 'VALIDATION_ERROR' });
}

/**
 * `GET /me` (all balances) and `GET /me/:meter` (one, with recent usage) for the caller;
 * `POST /grant`, `POST /top-up`, `POST /reset`, `GET /balances` for platform admins.
 */
export function createMeterRouter<Env>(options: MeterRouterOptions<Env>): Router<Env> {
    const router = new Router<Env>();
    const caller = async (request: Request, env: Env): Promise<MeterCaller | Response> =>
        (await options.resolveCaller(request, env)) ?? errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    const admin = async (c: Ctx<Env>, who: MeterCaller): Promise<Response | null> => {
        if (options.requireAdmin) return options.requireAdmin(c, who);
        return who.platformAdmin === true ? null : errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    };

    router.get('/me', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        return jsonResponse({ data: await options.meter.balances(c.env, who) });
    });

    router.get('/me/:meter', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const name = meterName(c.params.meter);
        if (name instanceof Response) return name;
        const balance = await options.meter.balance(c.env, who, name);
        if (!balance) return errorResponse('No balance for this meter', 404, { code: 'NOT_FOUND' });
        const usage = await options.meter.usage(c.env, who, name, 50);
        return jsonResponse({ data: { ...balance, usage } });
    });

    router.get('/balances', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const denied = await admin(c, who);
        if (denied) return denied;
        const subject = target(who, {
            organizationId: c.url.searchParams.get('organizationId'),
            userId: c.url.searchParams.get('userId'),
        });
        if (subject instanceof Response) return subject;
        return jsonResponse({ data: await options.meter.balances(c.env, subject) });
    });

    router.post('/grant', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const denied = await admin(c, who);
        if (denied) return denied;
        const body = await readJson<AdminBody>(c.req);
        const subject = target(who, body);
        if (subject instanceof Response) return subject;
        const name = meterName(body.meter);
        if (name instanceof Response) return name;
        if (body.credits !== null && (!Number.isSafeInteger(body.credits) || (body.credits as number) < 0)) {
            return errorResponse('credits must be null (unlimited) or a non-negative integer', 400, {
                code: 'VALIDATION_ERROR',
            });
        }
        const balance = await options.meter.grant(c.env, subject, name, {
            credits: body.credits ?? null,
            periodEnd: body.periodEnd ?? null,
            resetCredits: body.resetCredits,
        });
        return jsonResponse({ data: balance }, 201);
    });

    router.post('/top-up', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const denied = await admin(c, who);
        if (denied) return denied;
        const body = await readJson<AdminBody>(c.req);
        const subject = target(who, body);
        if (subject instanceof Response) return subject;
        const name = meterName(body.meter);
        if (name instanceof Response) return name;
        if (!Number.isSafeInteger(body.amount) || (body.amount as number) <= 0) {
            return errorResponse('amount must be a positive integer', 400, { code: 'VALIDATION_ERROR' });
        }
        const balance = await options.meter.topUp(c.env, subject, name, body.amount as number);
        if (!balance) return errorResponse('No limited balance to top up', 404, { code: 'NOT_FOUND' });
        return jsonResponse({ data: balance });
    });

    router.post('/reset', async (c) => {
        const who = await caller(c.req, c.env);
        if (who instanceof Response) return who;
        const denied = await admin(c, who);
        if (denied) return denied;
        const body = await readJson<AdminBody>(c.req);
        const subject = target(who, body);
        if (subject instanceof Response) return subject;
        const name = meterName(body.meter);
        if (name instanceof Response) return name;
        const balance = await options.meter.reset(c.env, subject, name, { periodEnd: body.periodEnd });
        if (!balance) return errorResponse('No balance to reset', 404, { code: 'NOT_FOUND' });
        return jsonResponse({ data: balance });
    });

    return router;
}
