// @vitest-environment node
/// <reference path="./node-sqlite.d.ts" />
// ============================================================
// @ottabase/alerts, end to end through otta-web's own wiring: the real Worker fetch handler,
// the real package list and alerts composition, the routes the kernel mounts, and a real
// SQLite database behind the D1 binding. A platform admin adds a webhook channel through the
// API; CI raises an alert through the ingest door; an unhandled error reaches it through the
// kernel's reporter. Each one lands in the database and is delivered, signed.
// ============================================================

import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { runHealth } from '@ottabase/kernel';
import { autoInit } from '@ottabase/ottaorm';
import { verifySignatureHeader } from '@ottabase/utils/hmac-signature';
import { alertChannelsTable, alertDeliveriesTable, alertEventsTable, alertKeysTable } from '@ottabase/alerts/schema';
import { getSession } from '@ottabase/auth/backend';
import { DatabaseSync } from 'node:sqlite';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import workerHandler from '../../cloudflare-worker';
import { getRegisteredAppCronHandlers } from '../cron';
import { packages } from '../packages';

vi.mock('@ottabase/auth/backend', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@ottabase/auth/backend');
    return { ...actual, getSession: vi.fn() };
});

type Param = string | number | bigint | null | Uint8Array;

/** A D1 binding over an in-memory SQLite database: the slice Drizzle's D1 driver uses. */
function sqliteD1() {
    const db = new DatabaseSync(':memory:');
    const norm = (params: unknown[]): Param[] =>
        params.map((v) => (typeof v === 'boolean' ? Number(v) : v === undefined ? null : (v as Param)));
    const prepare = (sql: string) => {
        let params: Param[] = [];
        const stmt = {
            bind(...p: unknown[]) {
                params = norm(p);
                return stmt;
            },
            async all() {
                return { results: db.prepare(sql).all(...params), success: true, meta: {} };
            },
            async raw() {
                return db
                    .prepare(sql)
                    .all(...params)
                    .map((row: Record<string, unknown>) => Object.values(row));
            },
            async first(column?: string) {
                const row = db.prepare(sql).get(...params) as Record<string, unknown> | undefined;
                return row ? (column ? row[column] : row) : null;
            },
            async run() {
                const r = db.prepare(sql).run(...params);
                return { success: true, meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
            },
        };
        return stmt;
    };
    return {
        prepare,
        batch: async (stmts: Array<{ all(): Promise<unknown> }>) => Promise.all(stmts.map((s) => s.all())),
        exec: async (sql: string) => {
            db.exec(sql);
            return { count: 0, duration: 0 };
        },
    } as unknown as D1Database;
}

const HOOK = 'https://hooks.acme.test/alerts';
const sent: Array<{ url: string; body: string; headers: Headers }> = [];
let env: CloudflareEnv;

/** One request through the Worker, with a real execution context whose waitUntil work is awaited. */
async function call(path: string, init: RequestInit = {}) {
    const pending: Promise<unknown>[] = [];
    const ctx = {
        waitUntil: (promise: Promise<unknown>) => void pending.push(promise),
        passThroughOnException: () => undefined,
    } as unknown as ExecutionContext;
    const headers = new Headers(init.headers);
    if (init.body) headers.set('content-type', 'application/json');
    const response = await workerHandler.fetch!(
        new Request(`https://acme.test${path}`, { ...init, headers }),
        env,
        ctx,
    );
    await Promise.all(pending);
    const text = await response.text();
    return { status: response.status, text, body: text ? JSON.parse(text) : null };
}

beforeAll(async () => {
    const d1 = sqliteD1();
    const result = await autoInit({
        driver: createD1Driver(d1),
        schema: { alertChannelsTable, alertEventsTable, alertDeliveriesTable, alertKeysTable },
        verbose: false,
    });
    expect(result.details.errors).toEqual([]);
    env = {
        OBCF_KV: (globalThis as unknown as { OBCF_KV: KVNamespace }).OBCF_KV,
        OBCF_D1: d1,
        ENVIRONMENT: 'test',
        AUTH_SECRET: 'an-auth-secret-long-enough-to-seal-with',
        AUTH_URL: 'https://acme.test',
        ALERTS_INGEST_TOKEN: 'ci-token-0123456789abcdefghij',
    } as unknown as CloudflareEnv;
    // The webhook channel's target answers 200 and is recorded; nothing else is fetched.
    vi.mocked(globalThis.fetch).mockImplementation(async (input, init) => {
        const url = String(input);
        if (url !== HOOK) throw new Error(`unexpected fetch ${url}`);
        sent.push({ url, body: String(init?.body), headers: new Headers(init?.headers) });
        return new Response('ok');
    });
    vi.mocked(getSession).mockResolvedValue({
        user: {
            id: 'owner',
            email: 'owner@acme.test',
            organizationId: 'system',
            permissions: ['*:*'],
            platformAdmin: true,
        },
    } as never);
});

describe('alerts in otta-web, end to end', () => {
    it('is listed, mounted, scheduled and reported on', async () => {
        expect(packages.has('alerts')).toBe(true);
        const handlers = getRegisteredAppCronHandlers().map((handler) => handler.name);
        expect(handlers).toEqual(expect.arrayContaining(['alerts:sweep', 'alerts:prune']));
        expect(packages.nav().find((item) => item.packageKey === 'alerts')).toMatchObject({
            href: '/admin/infrastructure/alerts',
        });
    });

    it('lets a platform admin add a webhook channel, and never shows its target', async () => {
        const created = await call('/api/alerts/channels', {
            method: 'POST',
            body: JSON.stringify({ name: 'Ops hook', type: 'webhook', url: HOOK, minSeverity: 'info' }),
        });
        expect(created.status).toBe(201);
        expect(created.body.data).toMatchObject({ type: 'webhook', hint: 'hooks.acme.test/…', readable: true });
        expect(created.body.data.signingSecret).toMatch(/^alsec_/);
        const listed = await call('/api/alerts/channels');
        expect(listed.text).not.toContain('/alerts"');
        expect(listed.text).not.toContain(created.body.data.signingSecret);
        // Kept for the next tests: the receiver verifies with it.
        (globalThis as unknown as { signingSecret: string }).signingSecret = created.body.data.signingSecret;
    });

    it('takes an alert from CI through the ingest door and delivers it, signed', async () => {
        expect((await call('/api/alerts/ingest', { method: 'POST', body: '{"title":"x"}' })).status).toBe(401);
        const raised = await call('/api/alerts/ingest', {
            method: 'POST',
            headers: { authorization: 'Bearer ci-token-0123456789abcdefghij' },
            body: JSON.stringify({
                title: 'Deploy failed on main',
                kind: 'ci.failed',
                severity: 'critical',
                key: 'deploy',
            }),
        });
        expect(raised.status).toBe(202);
        expect(raised.body.data).toMatchObject({ suppressed: false, routed: 1 });

        expect(sent).toHaveLength(1);
        const [delivery] = sent;
        expect(delivery!.headers.get('X-Ottabase-Event')).toBe('alert.firing');
        const secret = (globalThis as unknown as { signingSecret: string }).signingSecret;
        await expect(
            verifySignatureHeader(secret, delivery!.body, delivery!.headers.get('X-Ottabase-Signature')),
        ).resolves.toBe(true);
        expect(JSON.parse(delivery!.body).alert).toMatchObject({
            source: 'external',
            kind: 'ci.failed',
            severity: 'critical',
            title: 'Deploy failed on main',
            key: 'external:deploy',
        });
    });

    // With an error tracker installed (Pro's Blackbox) the alerts package leaves raw errors to it.
    const errorsAlerted = !packages.has('blackbox');

    it('turns an unhandled error the host reports into one alert, however many times it happens', async () => {
        for (let i = 0; i < 5; i++) {
            await packages.report({
                error: new Error(`R2 unavailable for job ${i}`),
                env,
                source: 'cron',
                task: 'vault:backup',
            });
        }
        if (!errorsAlerted) {
            expect(sent).toHaveLength(1);
            return;
        }
        expect(sent).toHaveLength(2);
        expect(JSON.parse(sent[1]!.body).alert).toMatchObject({
            source: 'errors',
            kind: 'cron',
            title: 'Scheduled task failed (vault:backup): Error: R2 unavailable for job 0',
        });
    });

    it('shows both in the feed with where they went, and reports healthy', async () => {
        const feed = await call('/api/alerts/alerts');
        expect(feed.status).toBe(200);
        expect(feed.body.data.map((alert: { source: string }) => alert.source)).toEqual(
            errorsAlerted ? ['errors', 'external'] : ['external'],
        );
        expect(feed.body.data[0].deliveries).toMatchObject([{ channelName: 'Ops hook', status: 'sent' }]);
        // What /api/admin/health (and Fleet, and so Tower) reports.
        const health = await runHealth(packages, env);
        expect(health.checks.find((check) => check.name === 'alerts:channels')).toMatchObject({
            ok: true,
            detail: '1 channel delivering',
        });
    });
});
