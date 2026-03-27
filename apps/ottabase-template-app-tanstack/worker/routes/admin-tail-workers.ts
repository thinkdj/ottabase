import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminAccess } from '../lib/admin-guard';
import type { ApiRouteContext } from './router';

const DEFAULT_WORKER_NAME = 'ottabase-template-app-tanstack';

interface TailWorkerTarget {
    id: string;
    name: string;
    description: string;
    filterHint: string;
}

const LOG_TARGETS: TailWorkerTarget[] = [
    {
        id: 'queue',
        name: 'Queue processors',
        description: 'Background job handlers dispatched via Cloudflare Queues (OBCF_QUEUE).',
        filterHint: 'wrangler tail <worker> --format json --search "queue"',
    },
    {
        id: 'cron',
        name: 'Scheduled tasks',
        description: 'Cron jobs created in the Admin → Scheduled Tasks console.',
        filterHint: 'wrangler tail <worker> --format json --search "cron"',
    },
    {
        id: 'realtime',
        name: 'Realtime events',
        description: 'Durable Object realtime activity (OBCF_REALTIME).',
        filterHint: 'wrangler tail <worker> --format json --search "realtime"',
    },
];

function resolveWorkerName(env: ApiRouteContext['env']): string {
    const envName = (env as { WORKER_NAME?: string }).WORKER_NAME;
    if (envName && envName.trim()) {
        return envName.trim();
    }
    return DEFAULT_WORKER_NAME;
}

export async function handleAdminTailWorkers(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const workerName = resolveWorkerName(context.env);
    const environment = (context.env as { ENVIRONMENT?: string }).ENVIRONMENT || 'unknown';
    const nodeEnv = (context.env as { NODE_ENV?: string }).NODE_ENV || 'unknown';

    return jsonResponse({
        workerName,
        environment,
        nodeEnv,
        tailCommands: {
            basic: `wrangler tail ${workerName}`,
            json: `wrangler tail ${workerName} --format json`,
            sampled: `wrangler tail ${workerName} --format json --sampling 0.1`,
        },
        logTargets: LOG_TARGETS,
    });
}
