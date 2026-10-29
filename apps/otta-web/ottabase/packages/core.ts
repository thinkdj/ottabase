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

    // Descriptions feed the admin "System readiness" view; a value is shown only for `secret: false`.
    env: {
        required: [
            { key: 'OBCF_D1', kind: 'binding', description: 'The D1 database: users, organizations, every model.' },
            { key: 'AUTH_SECRET', kind: 'secret', description: 'Signs session cookies and tokens (16+ chars).' },
        ],
        optional: [
            {
                key: 'OBCF_KV',
                kind: 'binding',
                description: 'Sessions, caches and install records. Required in production.',
            },
            { key: 'OBCF_QUEUE', kind: 'binding', description: 'Background jobs; without it jobs run inline.' },
            { key: 'OBCF_R2', kind: 'binding', description: 'Uploads and backups.' },
            { key: 'OBCF_ASSETS', kind: 'binding', description: 'The built SPA served by the Worker.' },
            { key: 'OBCF_VERSION', kind: 'binding', description: 'Version metadata: which build is running.' },
            { key: 'ENVIRONMENT', secret: false, description: 'development, staging, preview, demo or production.' },
            { key: 'AUTH_URL', secret: false, description: 'Public origin used in auth redirects and emails.' },
            { key: 'MIGRATION_SECRET', kind: 'secret', description: 'Protects /api/ottaorm/init in production.' },
            { key: 'BOOTSTRAP_OWNER_SECRET', kind: 'secret', description: 'Protects the first-run bootstrap wizard.' },
        ],
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
