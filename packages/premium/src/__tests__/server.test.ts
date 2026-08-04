// ============================================================
// The server surface — the half a customer cannot edit.
//
// These assert the property the browser gates cannot: an unlicensed package's routes
// REFUSE, they do not merely disappear from the UI.
// ============================================================

import { Router } from '@ottabase/ottarouter';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { definePremiumPackage } from '../define';
import { generateLicenseKeypair, issueLicense } from '../license/issue';
import { createPremiumRegistry, licenseEnvKey } from '../registry';
import { createMemoryStateStore } from '../state-store';
import { createPremiumAdminRouter } from '../server/routes';
import { mountPremiumPackages } from '../server/mount';
import { requirePremiumFeature, requirePremiumLimit } from '../server/guard';

type Env = Record<string, unknown>;

let keys: { publicKey: string; privateKey: string };
let license: string;

beforeAll(async () => {
    keys = await generateLicenseKeypair();
    license = await issueLicense(
        { pkg: 'webhooks', plan: 'pro', licensee: 'Acme', features: ['deliveries.log'], limits: { endpoints: 5 } },
        keys.privateKey,
    );
});

function makePackage() {
    return definePremiumPackage<Env>({
        key: 'webhooks',
        name: 'Webhooks',
        version: '1.0.0',
        licensePublicKey: keys.publicKey,
        purchaseUrl: 'https://example.com/pricing',
        features: ['deliveries.log'],
        freeLimits: { endpoints: 1 },
        routes: {
            basePath: '/api/webhooks',
            build: () => {
                const router = new Router<Env>();
                router.get('/', () => Response.json({ ok: true }));
                return router;
            },
        },
    });
}

function makeRegistry() {
    const store = createMemoryStateStore();
    return createPremiumRegistry<Env>({
        packages: [makePackage()],
        getStore: () => store,
        cacheTtlMs: 0,
    });
}

const get = (path: string) => new Request(`https://app.test${path}`);
const post = (path: string, body?: unknown) =>
    new Request(`https://app.test${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

describe('mounted package routes', () => {
    function build() {
        const registry = makeRegistry();
        const app = new Router<Env>();
        const mounted = mountPremiumPackages(app, registry);
        return { registry, app, mounted };
    }

    it('serves the package route when licensed', async () => {
        const { app } = build();
        const response = await app.handle(get('/api/webhooks'), { [licenseEnvKey('webhooks')]: license });

        expect(response?.status).toBe(200);
        await expect(response?.json()).resolves.toEqual({ ok: true });
    });

    it('answers 402 with actionable metadata when unlicensed', async () => {
        const { app } = build();
        const response = await app.handle(get('/api/webhooks'), {});

        expect(response?.status).toBe(402);
        const body = (await response?.json()) as Record<string, any>;
        expect(body.code).toBe('PREMIUM_REQUIRED');
        expect(body.metadata).toMatchObject({
            package: 'webhooks',
            reason: 'LICENSE_MISSING',
            purchaseUrl: 'https://example.com/pricing',
        });
    });

    it('closes the whole namespace, not just the declared routes', async () => {
        const { app } = build();
        // A path with no route behind it: an unlicensed package must not leak which
        // sub-paths exist by answering 404 for some and 402 for others.
        const response = await app.handle(get('/api/webhooks/deliveries/42'), {});

        expect(response?.status).toBe(402);
    });

    it('lets a beforeGate hook answer first, so anonymous callers get 401 not 402', async () => {
        const registry = makeRegistry();
        const app = new Router<Env>();
        mountPremiumPackages(app, registry, {
            beforeGate: () => new Response('unauthorized', { status: 401 }),
        });

        const response = await app.handle(get('/api/webhooks'), { [licenseEnvKey('webhooks')]: license });
        expect(response?.status).toBe(401);
    });

    it('reports which base paths it mounted', () => {
        expect(build().mounted).toEqual(['/api/webhooks']);
    });

    it('leaves unrelated routes untouched', async () => {
        const { app } = build();
        app.get('/api/health', () => Response.json({ ok: true }));

        const response = await app.handle(get('/api/health'), {});
        expect(response?.status).toBe(200);
    });
});

describe('feature and limit guards', () => {
    it('refuses a feature outside the plan with 402', async () => {
        const registry = makeRegistry();
        const denied = await requirePremiumFeature(registry, {}, 'webhooks', 'deliveries.log');

        expect(denied?.status).toBe(402);
    });

    it('allows a licensed feature', async () => {
        const registry = makeRegistry();
        const denied = await requirePremiumFeature(
            registry,
            { [licenseEnvKey('webhooks')]: license },
            'webhooks',
            'deliveries.log',
        );

        expect(denied).toBeNull();
    });

    it('enforces the plan limit and reports the ceiling that applied', async () => {
        const registry = makeRegistry();
        const env = { [licenseEnvKey('webhooks')]: license };

        expect(await requirePremiumLimit(registry, env, 'webhooks', 'endpoints', 4)).toBeNull();

        const denied = await requirePremiumLimit(registry, env, 'webhooks', 'endpoints', 5);
        expect(denied?.status).toBe(402);
        const body = (await denied?.json()) as Record<string, any>;
        expect(body.metadata.limit).toBe(5);
    });

    it('answers 403 (not 402) for a package that is not installed — money does not fix a typo', async () => {
        const registry = makeRegistry();
        const denied = await requirePremiumFeature(registry, {}, 'not-a-package', 'x');

        expect(denied?.status).toBe(403);
    });
});

describe('control-plane API', () => {
    function build(requireAdmin = vi.fn(() => null)) {
        const registry = makeRegistry();
        const app = new Router<Env>();
        app.mount('/api/premium', createPremiumAdminRouter(registry, { requireAdmin }));
        return { registry, app, requireAdmin };
    }

    it('lists installed packages', async () => {
        const { app } = build();
        const response = await app.handle(get('/api/premium/packages'), {});
        const body = (await response?.json()) as { data: Array<Record<string, unknown>> };

        expect(response?.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0]).toMatchObject({ key: 'webhooks', state: 'unlicensed', enabled: false });
    });

    it('never returns the license key itself', async () => {
        const { app } = build();
        const response = await app.handle(get('/api/premium/packages'), { [licenseEnvKey('webhooks')]: license });

        expect(await response?.text()).not.toContain(license);
    });

    it('activates a pasted license and reports the new state', async () => {
        const { app } = build();
        const response = await app.handle(post('/api/premium/packages/webhooks/license', { license }), {});
        const body = (await response?.json()) as { data: Record<string, unknown> };

        expect(response?.status).toBe(200);
        expect(body.data).toMatchObject({ state: 'active', plan: 'pro', licenseSource: 'store' });
    });

    it('answers 422 with the reason for a key that does not verify', async () => {
        const { app } = build();
        const response = await app.handle(
            post('/api/premium/packages/webhooks/license', { license: 'obp1.bogus.bogus' }),
            {},
        );
        const body = (await response?.json()) as { data: Record<string, unknown>; error: string };

        expect(response?.status).toBe(422);
        expect(body.error).toBe('LICENSE_MALFORMED');
    });

    it('rejects an empty or oversized key before touching the store', async () => {
        const { app } = build();
        expect((await app.handle(post('/api/premium/packages/webhooks/license', { license: '  ' }), {}))?.status).toBe(
            400,
        );
        expect(
            (await app.handle(post('/api/premium/packages/webhooks/license', { license: 'x'.repeat(9000) }), {}))
                ?.status,
        ).toBe(400);
    });

    it('404s for a package that is not installed', async () => {
        const { app } = build();
        expect((await app.handle(get('/api/premium/packages/ghost'), {}))?.status).toBe(404);
    });

    it('runs the injected guard on every mutation', async () => {
        const requireAdmin = vi.fn(() => new Response('nope', { status: 403 }));
        const { app } = build(requireAdmin as never);

        expect((await app.handle(post('/api/premium/packages/webhooks/license', { license }), {}))?.status).toBe(403);
        expect(requireAdmin).toHaveBeenCalled();
    });

    it('uses requireViewer for reads when one is supplied', async () => {
        const registry = makeRegistry();
        const app = new Router<Env>();
        const requireViewer = vi.fn(() => new Response('nope', { status: 401 }));
        app.mount(
            '/api/premium',
            createPremiumAdminRouter(registry, { requireAdmin: () => null, requireViewer: requireViewer as never }),
        );

        expect((await app.handle(get('/api/premium/packages'), {}))?.status).toBe(401);
    });
});
