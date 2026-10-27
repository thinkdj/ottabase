// ============================================================
// The routes, mounted the way the app mounts them (through the kernel registry): who may
// call what, what the console is shown, and the ingest door for CI.
// ============================================================

import { createPackageRegistry, mountPackages } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createAlertsPackage } from '../manifest';
import type { AlertsCaller } from '../types';
import { ENV, SLACK_URL, closeDatabase, makeEngine, openDatabase, type TestEnv } from './harness';

beforeEach(openDatabase);
afterAll(closeDatabase);

const callers: Record<string, AlertsCaller> = {
    admin: { userId: 'u1', organizationId: null, appId: 'app', platformAdmin: true },
    member: { userId: 'u2', organizationId: 'o1', appId: 'app', platformAdmin: false },
};

function setup(extra: Partial<Parameters<typeof createAlertsPackage<TestEnv>>[0]> = {}) {
    const engine = makeEngine();
    const pkg = createAlertsPackage<TestEnv>({
        alerts: engine.alerts,
        // Tests name the caller in a header; the app resolves it from the verified session.
        resolveCaller: (request) => callers[request.headers.get('x-test-caller') ?? ''] ?? null,
        ...extra,
    });
    const router = new Router<TestEnv>();
    mountPackages(router, { packages: createPackageRegistry({ packages: [pkg] }) });
    const call = async (path: string, init: RequestInit & { as?: string } = {}, env: TestEnv = ENV) => {
        const headers = new Headers(init.headers);
        if (init.as) headers.set('x-test-caller', init.as);
        if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
        // A real execution context: what a route hands to waitUntil is awaited before the test looks.
        const pending: Promise<unknown>[] = [];
        const ctx = {
            waitUntil: (promise: Promise<unknown>) => void pending.push(promise),
            passThroughOnException() {},
        };
        const request = new Request(`https://acme.test/api/alerts${path}`, { ...init, headers });
        const response = (await router.handle(request, env, ctx))!;
        await Promise.all(pending);
        const text = await response.text();
        return { status: response.status, text, body: text ? JSON.parse(text) : null };
    };
    return { ...engine, call };
}

describe('the console routes', () => {
    it('refuse anyone but a platform administrator', async () => {
        const { call } = setup();
        expect((await call('/channels')).status).toBe(401);
        expect((await call('/channels', { as: 'member' })).status).toBe(403);
        expect((await call('/alerts', { as: 'member' })).status).toBe(403);
        expect((await call('/channels', { as: 'admin' })).status).toBe(200);
    });

    it('create, list, change and remove a channel, never echoing its target', async () => {
        const { call } = setup();
        const created = await call('/channels', {
            as: 'admin',
            method: 'POST',
            body: JSON.stringify({ name: 'Ops', type: 'slack', url: SLACK_URL, minSeverity: 'warning' }),
        });
        expect(created.status).toBe(201);
        expect(created.text).not.toContain('abcdefghijkl');
        const id = created.body.data.id as string;

        const listed = await call('/channels', { as: 'admin' });
        expect(listed.text).not.toContain('abcdefghijkl');
        expect(listed.body.data.channels).toHaveLength(1);
        expect(listed.body.data.types.map((type: { type: string }) => type.type)).toEqual([
            'email',
            'slack',
            'discord',
            'telegram',
            'pagerduty',
            'webhook',
        ]);

        const changed = await call(`/channels/${id}`, {
            as: 'admin',
            method: 'PATCH',
            body: JSON.stringify({ enabled: false }),
        });
        expect(changed.body.data).toMatchObject({ enabled: false, hint: 'hooks.slack.com/…/ijkl' });

        expect((await call(`/channels/${id}`, { as: 'admin', method: 'DELETE' })).body.data).toEqual({
            id,
            removed: true,
        });
        expect((await call(`/channels/${id}`, { as: 'admin', method: 'DELETE' })).status).toBe(404);
        expect((await call('/channels/nope', { as: 'admin', method: 'PATCH', body: '{}' })).status).toBe(404);
    });

    it('explain a bad target in words the operator can act on', async () => {
        const { call } = setup();
        const refused = await call('/channels', {
            as: 'admin',
            method: 'POST',
            body: JSON.stringify({ name: 'Ops', type: 'slack', url: 'https://example.com/hook' }),
        });
        expect(refused.status).toBe(400);
        expect(refused.body.error).toContain('hooks.slack.com');
        expect((await call('/channels', { as: 'admin', method: 'POST', body: '[1]' })).status).toBe(400);
    });

    it('say so when the deployment has no secret to seal targets with', async () => {
        const { call } = setup();
        const refused = await call(
            '/channels',
            { as: 'admin', method: 'POST', body: JSON.stringify({ name: 'Ops', type: 'slack', url: SLACK_URL }) },
            { ...ENV, secret: '' },
        );
        expect(refused.status).toBe(503);
        expect(refused.body).toMatchObject({ code: 'ALERTS_SECRET_MISSING' });
        expect(refused.body.error).toContain('ALERTS_SECRET');
    });

    it('test a channel, show the feed and the summary, refuse to retry a sent delivery', async () => {
        const { call } = setup();
        const { body } = await call('/channels', {
            as: 'admin',
            method: 'POST',
            body: JSON.stringify({ name: 'Ops', type: 'slack', url: SLACK_URL }),
        });
        const test = await call(`/channels/${body.data.id}/test`, { as: 'admin', method: 'POST' });
        expect(test.body.data).toMatchObject({ ok: true, delivery: { status: 'sent' } });
        expect((await call('/channels/missing/test', { as: 'admin', method: 'POST' })).status).toBe(404);

        const feed = await call('/alerts?limit=10&severity=info', { as: 'admin' });
        expect(feed.body.data[0]).toMatchObject({ source: 'alerts', kind: 'test', deliveries: [{ status: 'sent' }] });
        expect((await call('/summary', { as: 'admin' })).body.data.last24h.info).toBe(1);

        const deliveryId = feed.body.data[0].deliveries[0].id as string;
        expect((await call(`/deliveries/${deliveryId}/retry`, { as: 'admin', method: 'POST' })).status).toBe(409);
    });
});

describe('ingest', () => {
    const TOKEN = 'ci-token-0123456789abcdefghij';
    const post = (body: unknown, token?: string) => ({
        method: 'POST',
        body: typeof body === 'string' ? body : JSON.stringify(body),
        headers: (token ? { authorization: `Bearer ${token}` } : {}) as Record<string, string>,
    });

    it('does not exist without a token, and refuses a wrong one', async () => {
        const { call } = setup();
        expect((await call('/ingest', post({ title: 'x' }, 'anything'))).status).toBe(404);
        // A token short enough to guess is no token.
        const short = { ...ENV, token: 'ci-token-123' };
        expect((await call('/ingest', post({ title: 'x' }, 'ci-token-123'), short)).status).toBe(404);
        const env = { ...ENV, token: TOKEN };
        expect((await call('/ingest', post({ title: 'x' }), env)).status).toBe(401);
        expect((await call('/ingest', post({ title: 'x' }, 'wrong'), env)).status).toBe(401);
    });

    it('runs the throttle before the token compare', async () => {
        const { call } = setup({ rateLimit: async () => Response.json({ error: 'slow down' }, { status: 429 }) });
        const env = { ...ENV, token: TOKEN };
        expect((await call('/ingest', post({ title: 'x' }, 'wrong'), env)).status).toBe(429);
        expect((await call('/ingest', post({ title: 'x' }, TOKEN), env)).status).toBe(429);
    });

    it('raises an external alert, keyed so a resolve closes it', async () => {
        const { call, net } = setup();
        const env = { ...ENV, token: TOKEN };
        await call('/channels', {
            as: 'admin',
            method: 'POST',
            body: JSON.stringify({ name: 'Ops', type: 'slack', url: SLACK_URL }),
        });
        const raised = await call(
            '/ingest',
            post(
                {
                    title: 'Deploy failed',
                    kind: 'ci.failed',
                    severity: 'critical',
                    key: 'deploy',
                    url: 'https://ci.test/run/1',
                },
                TOKEN,
            ),
            env,
        );
        expect(raised.status).toBe(202);
        expect(raised.body.data).toMatchObject({ suppressed: false, routed: 1 });
        const [alert] = (await call('/alerts', { as: 'admin' }, env)).body.data;
        expect(alert).toMatchObject({
            source: 'external',
            kind: 'ci.failed',
            key: 'external:deploy',
            severity: 'critical',
        });
        expect(net.sent).toHaveLength(1);

        expect((await call('/ingest', post({ body: 'no title' }, TOKEN), env)).status).toBe(400);
        expect((await call('/ingest', post('not json', TOKEN), env)).status).toBe(400);
        expect((await call('/ingest', post({ title: 'x'.repeat(20_000) }, TOKEN), env)).status).toBe(413);
    });
});
