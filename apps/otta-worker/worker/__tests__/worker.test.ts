import { describe, expect, it } from 'vitest';
import { packages } from '../../ottabase/packages';
import worker from '../index';
import { getAllSchemas } from '../lib/db-utils';

// No D1 in these tests: the Worker must still answer its own routes, and every package's
// route must be mounted and fail closed (503 NOT_CONFIGURED) rather than be missing (404).
const baseEnv = {
    APP_ID: 'test-app',
    ENVIRONMENT: 'production',
    ADMIN_TOKEN: 'operator-secret',
} as unknown as CloudflareEnv;
const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

const call = (path: string, init: RequestInit = {}, env: Partial<CloudflareEnv> = {}) =>
    worker.fetch(new Request(`https://worker.test${path}`, init), { ...baseEnv, ...env } as CloudflareEnv, ctx);
const asOperator = { headers: { authorization: 'Bearer operator-secret' } };

describe('the Worker', () => {
    it('renders the home page from the package list', async () => {
        const response = await call('/');
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/html');
        const body = await response.text();
        expect(body).toContain('<title>test-app</title>');
        expect(body).toContain('<code>core</code>');
        expect(body).toContain('<code>vault</code>');
        expect(body).toContain('/api/vault');
        expect(body).toContain('vault:backup');
    });

    it('answers the public health probe and the operator report, token-gated outside development', async () => {
        const health = await call('/api/health');
        expect(await health.json()).toEqual({
            ok: true,
            app: 'test-app',
            environment: 'production',
            packages: ['core', 'vault'],
        });

        expect((await call('/api/admin/health')).status).toBe(401);
        expect((await call('/api/admin/health', { headers: { authorization: 'Bearer wrong' } })).status).toBe(401);
        const report = await call('/api/admin/health', asOperator);
        expect(report.status).toBe(503); // no D1 bound: required env missing
        const json = (await report.json()) as {
            ok: boolean;
            packages: string[];
            checks: Array<{ package: string; name: string; ok: boolean }>;
        };
        expect(json.ok).toBe(false);
        expect(json.packages).toEqual(['core', 'vault']);
        expect(json.checks.some((check) => check.package === 'core' && check.name === 'env:OBCF_D1' && !check.ok)).toBe(
            true,
        );

        const open = await call('/api/admin/health', {}, { ENVIRONMENT: 'development', ADMIN_TOKEN: undefined });
        expect(open.status).toBe(503);
        const unset = await call('/api/admin/health', {}, { ADMIN_TOKEN: undefined });
        expect(unset.status).toBe(503);
        expect(((await unset.json()) as { code: string }).code).toBe('NOT_CONFIGURED');
    });

    it('mounts package routes behind the same operator token, and 404s the rest as JSON', async () => {
        expect((await call('/api/vault/backups')).status).toBe(401);
        const backups = await call('/api/vault/backups', asOperator);
        expect(backups.status).toBe(503); // mounted, operator accepted, no bucket bound
        expect(((await backups.json()) as { code: string }).code).toBe('NOT_CONFIGURED');

        const missing = await call('/nope');
        expect(missing.status).toBe(404);
        expect(((await missing.json()) as { code: string }).code).toBe('NOT_FOUND');
    });

    it('refuses to init tables without D1 and never seeds schedules it did not create', async () => {
        const init = await call('/api/admin/init', { method: 'POST', ...asOperator });
        expect(init.status).toBe(503);
    });
});

describe('the package list', () => {
    it('reaches auto-init with the scheduler table and every package table under a *Table key', () => {
        const schemas = Object.keys(getAllSchemas());
        expect(schemas).toContain('scheduledTasksTable');
        for (const key of Object.keys(packages.tables())) {
            expect(schemas).toContain(key);
            expect(key.endsWith('Table')).toBe(true);
        }
    });

    it('contributes the handlers the scheduler and queue run', () => {
        expect(Object.keys(packages.cron())).toContain('vault:backup');
        expect(packages.cron()['vault:backup'].schedule).toBe('23 2 * * *');
        expect(Object.keys(packages.queue())).toContain('events:deliver');
        expect(packages.keys()).toEqual(['core', 'vault']);
    });
});
