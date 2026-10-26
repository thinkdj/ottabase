import { Router } from '@ottabase/ottarouter';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { authorizeFleet } from './report';
import type { Awaitable, FleetReport } from './types';

export interface FleetRouterOptions<Env> {
    report: (env: Env) => Promise<FleetReport>;
    token: (env: Env) => string | null | undefined;
    init?: (env: Env) => Awaitable<unknown>;
}

/** `GET /report` and `POST /init`, both behind the bearer token. */
export function createFleetRouter<Env>(options: FleetRouterOptions<Env>): Router<Env> {
    const router = new Router<Env>();

    router.get('/report', async (c) => {
        const denied = authorizeFleet(c.req, options.token(c.env));
        if (denied) return denied;
        return jsonResponse({ data: await options.report(c.env) });
    });

    router.post('/init', async (c) => {
        const denied = authorizeFleet(c.req, options.token(c.env));
        if (denied) return denied;
        if (!options.init) return errorResponse('This app has no init action', 501, { code: 'NOT_SUPPORTED' });
        try {
            const result = await options.init(c.env);
            return jsonResponse({ data: result ?? { ok: true } });
        } catch (error) {
            // A 500 body is sanitised to a generic message on purpose; the cause goes to the host's log.
            console.error('[fleet] init failed', error instanceof Error ? error.message : error);
            return errorResponse('init failed', 500, { code: 'INIT_FAILED' });
        }
    });

    return router;
}
