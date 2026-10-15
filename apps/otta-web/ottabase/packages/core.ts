// ============================================================
// core — the framework itself, as a package
// ============================================================
// Auth, tenants, RBAC, audit, media and the scheduler are always installed; their tables
// and models are registered by `worker/lib/db-utils.ts` because the ORM needs them before
// anything else. What belongs HERE is the part of core that behaves like any other
// package: its cron housekeeping, its queue handlers, its env contract and its health.
// ============================================================

import { EVENT_JOB_TYPE } from '@ottabase/events';
import { definePackage } from '@ottabase/kernel';
import { AUDIT_PRUNE_HANDLER, DEFAULT_AUDIT_RETENTION_DAYS, pruneAuditLogs } from '../../worker/lib/audit-retention';
import { getOttabaseConfig } from '../config.loader';
import { events } from '../events';

export const corePackage = definePackage<CloudflareEnv>({
    key: 'core',
    name: 'Ottabase core',
    version: '1.0.0',
    description: 'Auth, organizations, RBAC, audit log, media and the scheduler.',

    env: {
        required: ['OBCF_D1'],
        optional: ['OBCF_KV', 'OBCF_QUEUE', 'OBCF_R2', 'OBCF_ASSETS'],
    },

    cron: {
        [AUDIT_PRUNE_HANDLER]: {
            description: `Delete this app's audit_logs rows older than the retention window (payload olderThanDays, default ${DEFAULT_AUDIT_RETENTION_DAYS}).`,
            handler: async ({ env, payload }) => {
                await pruneAuditLogs(payload, getOttabaseConfig(env).appId);
            },
            // Seeded on install: an initialised app never grows audit_logs unbounded.
            schedule: '17 3 * * *',
            payload: { olderThanDays: DEFAULT_AUDIT_RETENTION_DAYS },
        },
    },

    queue: {
        // The consumer half of the event bus: runs every `via: 'queue'` subscriber.
        [EVENT_JOB_TYPE]: events.jobHandler(),
    },

    health: (env) => [
        { name: 'd1', ok: Boolean(env.OBCF_D1) },
        {
            name: 'kv',
            ok: Boolean(env.OBCF_KV),
            detail: env.OBCF_KV ? undefined : 'no KV: caches and install records are in memory',
        },
        {
            name: 'queue',
            ok: Boolean(env.OBCF_QUEUE),
            detail: env.OBCF_QUEUE ? undefined : 'no queue: jobs and queued events run inline',
        },
    ],
});
