// ============================================================
// core — the framework itself, as a package
// ============================================================
// Auth, tenants, RBAC, audit, media and the scheduler are always installed; their tables
// and models are registered by `worker/lib/db-utils.ts` because the ORM needs them before
// anything else. What belongs HERE is the part of core that behaves like any other
// package: its cron housekeeping, its queue handlers, its env contract and its health.
// ============================================================

import { CRON_JOB_TYPE, type CronJobPayload } from '@ottabase/cron';
import { EVENT_JOB_TYPE } from '@ottabase/events';
import { definePackage, type FilePurposeContribution } from '@ottabase/kernel';
import type { JobHandler } from '@ottabase/queue';
import { AUDIT_PRUNE_HANDLER, DEFAULT_AUDIT_RETENTION_DAYS, pruneAuditLogs } from '../../worker/lib/audit-retention';
import { getOttabaseConfig } from '../config.loader';
import { events } from '../events';

const MB = 1024 * 1024;
/** What the files service sniffs as a raster image: the types it strips and renders variants of. */
const RASTER = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];

/**
 * The core file purposes. `server: true` ones are written by their own guarded route (the
 * avatar, brand and landing routes), never by the generic `POST /api/files`.
 */
const corePurposes: FilePurposeContribution[] = [
    {
        purpose: 'avatar',
        label: 'Avatars',
        audience: 'public',
        types: RASTER,
        maxBytes: 5 * MB,
        variants: ['thumb'],
        server: true,
    },
    {
        purpose: 'media',
        label: 'The media library',
        audience: 'public',
        types: [...RASTER, 'video/mp4', 'video/webm', 'application/pdf'],
        maxBytes: 10 * MB,
        variants: ['thumb', 'card', 'full'],
    },
    {
        purpose: 'attachment',
        label: 'Attachments',
        audience: 'members',
        types: [...RASTER, 'application/pdf', 'text/plain', 'text/csv'],
        maxBytes: 10 * MB,
    },
    {
        purpose: 'brand-asset',
        label: 'Brand assets',
        audience: 'public',
        types: [...RASTER, 'image/svg+xml', 'image/x-icon'],
        maxBytes: 5 * MB,
        svg: true,
        server: true,
    },
    {
        purpose: 'share-image',
        label: 'Social share images',
        audience: 'public',
        types: ['image/png', 'image/jpeg', 'image/webp'],
        maxBytes: 2 * MB,
        server: true,
    },
];

/** Runs one queued scheduler run. Loaded on use: `../cron` reads the package list, which imports this file. */
const runQueuedCronTask: JobHandler<CronJobPayload, CloudflareEnv> = async (job, ctx) => {
    const { runQueuedAppCronTask } = await import('../cron');
    await runQueuedAppCronTask(ctx.env, job.payload);
};

export const corePackage = definePackage<CloudflareEnv>({
    key: 'core',
    name: 'Ottabase core',
    version: '1.0.0',
    description: 'Auth, organizations, RBAC, audit log, media and the scheduler.',

    files: corePurposes,

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
            {
                key: 'OBCF_R2',
                kind: 'binding',
                description: 'Public files (avatars, the media library, brand assets): served by key.',
            },
            {
                key: 'OBCF_R2_PRIVATE',
                kind: 'binding',
                description: 'Members and owner files, and system artifacts: never served by key.',
            },
            { key: 'OBCF_IMAGES', kind: 'binding', description: 'Images binding: thumb/card/full WebP variants.' },
            {
                key: 'R2_PUBLIC_URL',
                secret: false,
                description: 'Base URL of the public files bucket. Default /api/files/public.',
            },
            {
                key: 'FILES_SIGNING_SECRET',
                kind: 'secret',
                description: 'Signs ?t= links to private files. Unset: no signed links.',
            },
            {
                key: 'FILES_QUOTA_MB',
                secret: false,
                description: 'Storage per organization (or user), MB. Default 1024.',
            },
            {
                key: 'OBCF_RATE_LIMITER_UPLOADS',
                kind: 'binding',
                description: 'Upload rate limit, 60 a minute per user. Required in production.',
            },
            {
                key: 'CLOUDFLARE_FILES_ZONE_ID',
                secret: false,
                description: 'Zone of the public files domain: quarantine purges its URLs there.',
            },
            {
                key: 'CLOUDFLARE_PURGE_API_TOKEN',
                kind: 'secret',
                description: 'Token with Cache Purge on that zone. Unset: purge quarantined URLs by hand.',
            },
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
        // The consumer half of the scheduler: one task run per job, in its own invocation.
        [CRON_JOB_TYPE]: runQueuedCronTask,
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
