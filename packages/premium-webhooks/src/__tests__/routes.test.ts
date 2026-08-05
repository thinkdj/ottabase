// ============================================================
// The routes — tenancy and entitlements, which is where a paid package leaks or fails.
//
// The package mounts with `gate: 'entitlements'`, so the license does NOT close the
// namespace: the free tier has to work, and each paid path has to guard itself. Both
// halves are asserted here, against the SAME registry the server guards use.
// ============================================================

import { Router } from '@ottabase/ottarouter';
import { createPremiumRegistry, createMemoryStateStore, type PremiumRegistry } from '@ottabase/premium';
import { generateLicenseKeypair, issueLicense } from '@ottabase/premium/license-tools';
import { mountPremiumPackages } from '@ottabase/premium/server';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTables, tables } from './fake-models';
import { WEBHOOKS_PACKAGE_KEY } from '../constants';
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

let keys: { publicKey: string; privateKey: string };
let proLicense: string;

beforeAll(async () => {
    keys = await generateLicenseKeypair();
    proLicense = await issueLicense(
        {
            pkg: WEBHOOKS_PACKAGE_KEY,
            plan: 'pro',
            licensee: 'Acme',
            features: ['deliveries.log'],
            limits: { endpoints: 3 },
        },
        keys.privateKey,
    );
});

const ORG = { organizationId: 'org-1', appId: 'otta-web' };
const OTHER_ORG = { organizationId: 'org-2', appId: 'otta-web' };

let caller: { userId: string | null; organizationId: string | null; appId: string | null; canManage: boolean } | null;

function build(): { app: Router<Env>; registry: PremiumRegistry<Env> } {
    const pkg = createWebhooksPackage<Env>({
        licensePublicKey: keys.publicKey,
        resolveCaller: async () => caller,
        events: ['*', 'todo.created'],
    });
    const registry = createPremiumRegistry<Env>({
        packages: [pkg],
        getStore: () => createMemoryStateStore(),
        cacheTtlMs: 0,
    });
    const app = new Router<Env>();
    mountPremiumPackages(app, registry);
    return { app, registry };
}

const req = (path: string, init?: RequestInit) => new Request(`https://app.test/api/webhooks${path}`, init);
const post = (path: string, body?: unknown) =>
    req(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

const FREE: Env = {};
const PRO: Env = { PREMIUM_LICENSE_WEBHOOKS: '' };

beforeEach(() => {
    resetTables();
    caller = { userId: 'user-1', canManage: true, ...ORG };
    PRO.PREMIUM_LICENSE_WEBHOOKS = proLicense;
});

describe('authentication', () => {
    it('401s when the host cannot resolve a caller', async () => {
        caller = null;
        const { app } = build();
        expect((await app.handle(req('/'), FREE))?.status).toBe(401);
    });

    it('403s a read-only caller on every mutation', async () => {
        caller = { userId: 'user-1', canManage: false, ...ORG };
        const { app } = build();

        expect((await app.handle(post('/', { url: 'https://example.com/h' }), FREE))?.status).toBe(403);
        expect((await app.handle(req('/', { method: 'GET' }), FREE))?.status).toBe(200);
    });
});

describe('the free tier is reachable', () => {
    it('creates the first endpoint with no license at all', async () => {
        const { app } = build();
        const response = await app.handle(post('/', { url: 'https://example.com/hooks' }), FREE);
        const body = (await response?.json()) as { data: { id: string; secret?: string } };

        expect(response?.status).toBe(201);
        expect(body.data.secret).toMatch(/^whsec_/);
    });

    it('refuses the SECOND endpoint with 402 and names the ceiling', async () => {
        const { app } = build();
        await app.handle(post('/', { url: 'https://example.com/one' }), FREE);

        const response = await app.handle(post('/', { url: 'https://example.com/two' }), FREE);
        const body = (await response?.json()) as { code: string; metadata: Record<string, unknown> };

        expect(response?.status).toBe(402);
        expect(body.code).toBe('PREMIUM_REQUIRED');
        expect(body.metadata).toMatchObject({ package: 'webhooks', reason: 'LIMIT_REACHED', limit: 1 });
    });

    it('serves the event catalog without a license', async () => {
        const { app } = build();
        const response = await app.handle(req('/events'), FREE);
        await expect(response?.json()).resolves.toEqual({ data: ['*', 'todo.created'] });
    });
});

describe('a license raises the ceiling', () => {
    it('allows up to the licensed limit, then refuses', async () => {
        const { app } = build();
        for (let i = 0; i < 3; i++) {
            const response = await app.handle(post('/', { url: `https://example.com/h${i}` }), PRO);
            expect(response?.status).toBe(201);
        }

        const overflow = await app.handle(post('/', { url: 'https://example.com/h4' }), PRO);
        expect(overflow?.status).toBe(402);
    });
});

describe('the delivery log is the paid surface', () => {
    it('402s without the feature', async () => {
        const { app } = build();
        const response = await app.handle(req('/deliveries'), FREE);
        const body = (await response?.json()) as { metadata: Record<string, unknown> };

        expect(response?.status).toBe(402);
        expect(body.metadata.reason).toBe('LICENSE_MISSING');
    });

    it('returns the tenant’s deliveries with the feature', async () => {
        tables.deliveries.push(
            { id: 'dl_1', endpointId: 'ep_1', event: 'todo.created', status: 'success', ...ORG },
            { id: 'dl_2', endpointId: 'ep_9', event: 'todo.created', status: 'success', ...OTHER_ORG },
        );

        const { app } = build();
        const response = await app.handle(req('/deliveries'), PRO);
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

        const { app } = build();
        const body = (await (await app.handle(req('/'), FREE))?.json()) as { data: Array<{ id: string }> };

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

        const { app } = build();
        const patch = await app.handle(
            req('/ep_theirs', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: false }),
            }),
            FREE,
        );

        expect(patch?.status).toBe(404);
        expect(tables.endpoints[0].enabled).toBe(true);
    });

    it('stamps tenancy from the caller, never from the request body', async () => {
        const { app } = build();
        await app.handle(post('/', { url: 'https://example.com/h', organizationId: 'org-999', appId: 'evil' }), FREE);

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

        const { app } = build();
        const listed = (await (await app.handle(req('/'), FREE))?.json()) as { data: Array<{ id: string }> };
        expect(listed.data.map((row) => row.id)).toEqual(['ep_mine']);
        expect((await app.handle(req('/ep_theirs', { method: 'DELETE' }), FREE))?.status).toBe(404);
    });
});

describe('input validation', () => {
    it('requires a URL', async () => {
        const { app } = build();
        expect((await app.handle(post('/', {}), FREE))?.status).toBe(400);
    });

    it('refuses a destination that would be an SSRF', async () => {
        const { app } = build();
        const response = await app.handle(post('/', { url: 'https://169.254.169.254/latest' }), FREE);
        const body = (await response?.json()) as { code: string };

        expect(response?.status).toBe(400);
        expect(body.code).toBe('INVALID_URL');
    });

    it('defaults an empty event list to the wildcard rather than to silence', async () => {
        const { app } = build();
        await app.handle(post('/', { url: 'https://example.com/h', events: [] }), FREE);

        expect(tables.endpoints[0].events).toEqual(['*']);
    });
});

describe('the signing secret', () => {
    it('appears exactly once — at creation — and never in a list', async () => {
        const { app } = build();
        const created = (await (await app.handle(post('/', { url: 'https://example.com/h' }), FREE))?.json()) as {
            data: { secret?: string };
        };
        expect(created.data.secret).toBeTruthy();

        const listed = await (await app.handle(req('/'), FREE))?.text();
        expect(listed).not.toContain(created.data.secret);
    });
});

describe('the operator kill switch', () => {
    it('closes the whole namespace when the package is disabled, license or not', async () => {
        const pkg = createWebhooksPackage<Env>({ licensePublicKey: keys.publicKey, resolveCaller: async () => caller });
        const registry = createPremiumRegistry<Env>({
            packages: [pkg],
            disabled: [WEBHOOKS_PACKAGE_KEY],
            getStore: () => createMemoryStateStore(),
            cacheTtlMs: 0,
        });
        const app = new Router<Env>();
        mountPremiumPackages(app, registry);

        const response = await app.handle(req('/events'), PRO);
        expect(response?.status).toBe(403);
    });
});
