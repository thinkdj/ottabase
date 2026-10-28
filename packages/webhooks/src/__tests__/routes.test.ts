// ============================================================
// The routes — tenancy, which is where a multi-tenant package leaks or fails.
// ============================================================

import { createPackageRegistry, mountPackages } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTables, tables } from './fake-models';
import { createWebhooksPackage } from '../manifest';

// The models are the one thing these suites do not want to exercise for real — see
// fake-models.ts. `vi.mock` is hoisted above the imports above, so the manifest built
// below already sees the fakes.
vi.mock('../ottaorm-models/WebhookEndpoint', async () => {
    const { FakeWebhookEndpoint } = await import('./fake-models');
    return { WebhookEndpoint: FakeWebhookEndpoint };
});
vi.mock('../ottaorm-models/WebhookDelivery', async () => {
    const { FakeWebhookDelivery } = await import('./fake-models');
    return { WebhookDelivery: FakeWebhookDelivery };
});

type Env = Record<string, unknown>;

const ORG = { organizationId: 'org-1', appId: 'otta-web' };
const OTHER_ORG = { organizationId: 'org-2', appId: 'otta-web' };

type TestCaller = { userId: string | null; organizationId: string | null; appId: string | null; canManage: boolean };

let caller: TestCaller | null;

function build(): Router<Env> {
    const pkg = createWebhooksPackage<Env>({
        resolveCaller: async () => caller,
        events: ['*', 'todo.created'],
    });
    const app = new Router<Env>();
    mountPackages(app, { packages: createPackageRegistry<Env>({ packages: [pkg] }) });
    return app;
}

const req = (path: string, init?: RequestInit) => new Request(`https://app.test/api/webhooks${path}`, init);
const post = (path: string, body?: unknown) =>
    req(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

const ENV: Env = {};

beforeEach(() => {
    resetTables();
    caller = { userId: 'user-1', canManage: true, ...ORG };
});

describe('the package', () => {
    it('is a free package, mounted by the kernel like any other', () => {
        const pkg = createWebhooksPackage<Env>({ resolveCaller: async () => caller });
        expect(pkg.premium).toBeUndefined();
        expect(pkg.routes).toMatchObject({ basePath: '/api/webhooks' });
    });
});

describe('authentication', () => {
    it('401s when the host cannot resolve a caller', async () => {
        caller = null;
        expect((await build().handle(req('/'), ENV))?.status).toBe(401);
    });

    it('403s a read-only caller on every mutation', async () => {
        caller = { userId: 'user-1', canManage: false, ...ORG };
        const app = build();

        expect((await app.handle(post('/', { url: 'https://example.com/h' }), ENV))?.status).toBe(403);
        expect((await app.handle(req('/', { method: 'GET' }), ENV))?.status).toBe(200);
    });
});

describe('endpoints', () => {
    it('creates as many endpoints as the tenant wants', async () => {
        const app = build();
        for (let i = 0; i < 3; i++) {
            const response = await app.handle(post('/', { url: `https://example.com/h${i}` }), ENV);
            const body = (await response?.json()) as { data: { id: string; secret?: string } };
            expect(response?.status).toBe(201);
            expect(body.data.secret).toMatch(/^whsec_/);
        }
        expect(tables.endpoints).toHaveLength(3);
    });

    it('serves the event catalog', async () => {
        const response = await build().handle(req('/events'), ENV);
        await expect(response?.json()).resolves.toEqual({ data: ['*', 'todo.created'] });
    });
});

describe('the delivery log', () => {
    it('returns the tenant’s deliveries', async () => {
        tables.deliveries.push(
            { id: 'dl_1', endpointId: 'ep_1', event: 'todo.created', status: 'success', ...ORG },
            { id: 'dl_2', endpointId: 'ep_9', event: 'todo.created', status: 'success', ...OTHER_ORG },
        );

        const response = await build().handle(req('/deliveries'), ENV);
        const body = (await response?.json()) as { data: Array<{ id: string }> };

        expect(response?.status).toBe(200);
        expect(body.data.map((row) => row.id)).toEqual(['dl_1']);
    });
});

describe('tenancy', () => {
    it('lists only the caller’s endpoints', async () => {
        tables.endpoints.push(
            { id: 'ep_mine', url: 'https://example.com/a', events: ['*'], enabled: true, ...ORG },
            { id: 'ep_theirs', url: 'https://example.com/b', events: ['*'], enabled: true, ...OTHER_ORG },
        );

        const body = (await (await build().handle(req('/'), ENV))?.json()) as { data: Array<{ id: string }> };

        expect(body.data.map((row) => row.id)).toEqual(['ep_mine']);
    });

    it('404s another tenant’s endpoint rather than editing it', async () => {
        tables.endpoints.push({
            id: 'ep_theirs',
            url: 'https://example.com/b',
            events: ['*'],
            enabled: true,
            ...OTHER_ORG,
        });

        const patch = await build().handle(
            req('/ep_theirs', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: false }),
            }),
            ENV,
        );

        expect(patch?.status).toBe(404);
        expect(tables.endpoints[0].enabled).toBe(true);
    });

    it('stamps tenancy from the caller, never from the request body', async () => {
        await build().handle(
            post('/', { url: 'https://example.com/h', organizationId: 'org-999', appId: 'evil' }),
            ENV,
        );

        expect(tables.endpoints[0]).toMatchObject({ organizationId: 'org-1', appId: 'otta-web' });
    });

    it('isolates personal endpoints by user id when organizationId is null', async () => {
        caller = { userId: 'user-1', organizationId: null, appId: 'otta-web', canManage: true };
        tables.endpoints.push(
            {
                id: 'ep_mine',
                url: 'https://example.com/mine',
                events: ['*'],
                enabled: true,
                organizationId: null,
                userId: 'user-1',
                appId: 'otta-web',
            },
            {
                id: 'ep_theirs',
                url: 'https://example.com/theirs',
                events: ['*'],
                enabled: true,
                organizationId: null,
                userId: 'user-2',
                appId: 'otta-web',
            },
        );

        const app = build();
        const listed = (await (await app.handle(req('/'), ENV))?.json()) as { data: Array<{ id: string }> };
        expect(listed.data.map((row) => row.id)).toEqual(['ep_mine']);
        expect((await app.handle(req('/ep_theirs', { method: 'DELETE' }), ENV))?.status).toBe(404);
    });
});

describe('input validation', () => {
    it('requires a URL', async () => {
        expect((await build().handle(post('/', {}), ENV))?.status).toBe(400);
    });

    it('refuses a destination that would be an SSRF', async () => {
        const response = await build().handle(post('/', { url: 'https://169.254.169.254/latest' }), ENV);
        const body = (await response?.json()) as { code: string };

        expect(response?.status).toBe(400);
        expect(body.code).toBe('INVALID_URL');
    });

    it('defaults an empty event list to the wildcard rather than to silence', async () => {
        await build().handle(post('/', { url: 'https://example.com/h', events: [] }), ENV);

        expect(tables.endpoints[0].events).toEqual(['*']);
    });
});

describe('the signing secret', () => {
    it('appears exactly once — at creation — and never in a list', async () => {
        const app = build();
        const created = (await (await app.handle(post('/', { url: 'https://example.com/h' }), ENV))?.json()) as {
            data: { secret?: string };
        };
        expect(created.data.secret).toBeTruthy();

        const listed = await (await app.handle(req('/'), ENV))?.text();
        expect(listed).not.toContain(created.data.secret);
    });
});
