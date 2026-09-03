import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';

import type { Env } from '../cloudflare-env';
import { handleTurbo } from './turbo';

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const { pathname } = new URL(request.url);
        // Unauthenticated: deploy.yml health check needs a 2xx without a token.
        if (pathname === '/health' && request.method === 'GET') return jsonResponse({ ok: true });
        try {
            return await handleTurbo(request, env);
        } catch (error) {
            // Never log bodies, headers or tokens; artifacts carry task logs.
            console.error('otta-cache: unhandled error', redactErrorForLog(error));
            return errorResponse('Internal error', 500);
        }
    },
} satisfies ExportedHandler<Env>;
