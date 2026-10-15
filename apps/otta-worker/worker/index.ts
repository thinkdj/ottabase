// ============================================================
// The Worker: fetch, scheduled, queue
// ============================================================
import type { QueuedJob } from '@ottabase/queue';
import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { handleScheduled } from './cron';
import { ensureDbConnection } from './lib/db-utils';
import { queueHandler } from './queue';
import { router } from './routes';

export default {
    async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
        try {
            ensureDbConnection(env);
            return (await router.handle(request, env, ctx)) ?? errorResponse('Not found', 404, { code: 'NOT_FOUND' });
        } catch (error) {
            console.error(JSON.stringify({ event: 'unhandled_request_error', error: redactErrorForLog(error) }));
            return errorResponse('Internal server error', 500, { code: 'INTERNAL_SERVER_ERROR' });
        }
    },
    scheduled: handleScheduled,
    queue: queueHandler,
} satisfies ExportedHandler<CloudflareEnv, QueuedJob<unknown>>;
