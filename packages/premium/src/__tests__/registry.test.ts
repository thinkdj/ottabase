// ============================================================
// The registry — resolution, license precedence, and the lifecycle it drives.
//
// The two behaviours that matter most to a host app are here: a stock app with no
// paid packages must be completely unaffected, and a package whose license cannot be
// verified must close its own gate without touching anything else.
// ============================================================

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { definePremiumPackage } from '../define';
import { generateLicenseKeypair, issueLicense } from '../license/issue';
import { createPremiumRegistry, licenseEnvKey, toggleEnvKey } from '../registry';
import { createMemoryStateStore } from '../state-store';
import type { PremiumStateStore } from '../types';

let keys: { publicKey: string; privateKey: string };
let license: string;

beforeAll(async () => {
    keys = await generateLicenseKeypair();
    license = await issueLicense(
        { pkg: 'webhooks', plan: 'pro', licensee: 'Acme Inc', features: ['deliveries.log'], limits: { endpoints: 25 } },
        keys.privateKey,
    );
});

const hooks = {
    onInstall: vi.fn(),
    onUpgrade: vi.fn(),
    onActivate: vi.fn(),
    onDeactivate: vi.fn(),
    onUninstall: vi.fn(),
};

function makePackage(version = '1.0.0') {
    return definePremiumPackage({
        key: 'webhooks',
        name: 'Webhooks',
        version,
        licensePublicKey: keys.publicKey,
        features: ['deliveries.log'],
        freeLimits: { endpoints: 1 },
        tables: { webhookEndpointsTable: { name: 'endpoints' } },
        migrations: [{ id: 'm1' }],
        models: [class Endpoint {}],
        nav: [{ title: 'Webhooks', description: 'Outbound webhooks', href: '/admin/webhooks' }],
        lifecycle: hooks,
    });
}

function makeRegistry(options?: { store?: PremiumStateStore; disabled?: string[]; version?: string; appId?: string }) {
    const store = options?.store ?? createMemoryStateStore();
    return {
        store,
        registry: createPremiumRegistry({
            packages: [makePackage(options?.version)],
            appId: options?.appId,
            getStore: () => store,
            disabled: options?.disabled,
            // Resolution caching is an optimisation; tests assert behaviour, not the cache.
            cacheTtlMs: 0,
        }),
    };
}

beforeEach(() => {
    for (const hook of Object.values(hooks)) hook.mockReset();
});

describe('an app with no paid packages', () => {
    it('contributes nothing and answers every gate closed', async () => {
        const registry = createPremiumRegistry({ packages: [] });

        expect(registry.packages).toHaveLength(0);
        expect(registry.tables()).toEqual({});
        expect(registry.migrations()).toEqual([]);
        expect(registry.models()).toEqual([]);
        expect(registry.nav()).toEqual([]);
        expect(await registry.statuses({})).toEqual([]);
        expect(await registry.isActive({}, 'anything')).toBe(false);

        const answer = await registry.feature({}, 'anything', 'x');
        expect(answer.allowed).toBe(false);
        expect(answer.reason).toBe('PACKAGE_UNKNOWN');
    });

    it('refuses to register the same key twice', () => {
        expect(() => createPremiumRegistry({ packages: [makePackage(), makePackage()] })).toThrow(/Duplicate/);
    });
});

describe('license sources', () => {
    it('resolves a license from the package-specific env var', async () => {
        const { registry } = makeRegistry();
        const status = await registry.status({ [licenseEnvKey('webhooks')]: license }, 'webhooks');

        expect(status?.state).toBe('active');
        expect(status?.licenseSource).toBe('env');
        expect(status?.plan).toBe('pro');
        expect(status?.limits).toEqual({ endpoints: 25 });
    });

    it('resolves a license from the PREMIUM_LICENSES json map', async () => {
        const { registry } = makeRegistry();
        const status = await registry.status({ PREMIUM_LICENSES: JSON.stringify({ webhooks: license }) }, 'webhooks');

        expect(status?.state).toBe('active');
        expect(status?.licenseSource).toBe('env');
    });

    it('falls back to a stored (admin-activated) license', async () => {
        const { registry } = makeRegistry();
        await registry.activate({}, 'webhooks', license);
        const status = await registry.status({}, 'webhooks');

        expect(status?.state).toBe('active');
        expect(status?.licenseSource).toBe('store');
    });

    it('lets the env license win over a stored one, so infrastructure config is authoritative', async () => {
        const { registry } = makeRegistry();
        await registry.activate({}, 'webhooks', 'obp1.garbage.garbage');
        const status = await registry.status({ [licenseEnvKey('webhooks')]: license }, 'webhooks');

        expect(status?.state).toBe('active');
        expect(status?.licenseSource).toBe('env');
    });

    it('ignores a malformed PREMIUM_LICENSES map rather than hiding a valid stored key', async () => {
        const { registry } = makeRegistry();
        await registry.activate({}, 'webhooks', license);
        const status = await registry.status({ PREMIUM_LICENSES: '{not json' }, 'webhooks');

        expect(status?.state).toBe('active');
        expect(status?.licenseSource).toBe('store');
    });

    it('reports an unlicensed package without breaking anything', async () => {
        const { registry } = makeRegistry();
        const status = await registry.status({}, 'webhooks');

        expect(status?.state).toBe('unlicensed');
        expect(status?.enabled).toBe(false);
        // The free tier is still described, so the UI can render what the customer does have.
        expect(status?.limits).toEqual({ endpoints: 1 });
    });
});

describe('operator switches', () => {
    it('honours the disabled list', async () => {
        const { registry } = makeRegistry({ disabled: ['webhooks'] });
        const status = await registry.status({ [licenseEnvKey('webhooks')]: license }, 'webhooks');

        expect(status?.state).toBe('disabled');
        expect(registry.tables()).toEqual({});
        expect(registry.nav()).toEqual([]);
    });

    it('honours PREMIUM_PKG_<KEY>=false even with a valid license', async () => {
        const { registry } = makeRegistry();
        const env = { [licenseEnvKey('webhooks')]: license, [toggleEnvKey('webhooks')]: 'false' };

        expect(await registry.isActive(env, 'webhooks')).toBe(false);
        expect((await registry.status(env, 'webhooks'))?.reason).toBe('PACKAGE_DISABLED');
    });
});

describe('app binding', () => {
    it('refuses a license minted for another app', async () => {
        const bound = await issueLicense(
            { pkg: 'webhooks', plan: 'pro', licensee: 'Acme', appId: 'other-app' },
            keys.privateKey,
        );
        const { registry } = makeRegistry({ appId: 'otta-web' });
        const status = await registry.status({ [licenseEnvKey('webhooks')]: bound }, 'webhooks');

        expect(status?.state).toBe('invalid');
        expect(status?.reason).toBe('LICENSE_APP_MISMATCH');
    });

    it('reads the app id from the request env when given a resolver', async () => {
        // A fixed appId would verify against the value compiled into the config file, so a
        // deployment whose APP_ID is env-overridden would reject its own correct key.
        const bound = await issueLicense(
            { pkg: 'webhooks', plan: 'pro', licensee: 'Acme', appId: 'from-env' },
            keys.privateKey,
        );
        const registry = createPremiumRegistry({
            packages: [makePackage()],
            appId: (env) => (env as Record<string, unknown>).APP_ID as string,
            getStore: () => createMemoryStateStore(),
            cacheTtlMs: 0,
        });

        const env = { APP_ID: 'from-env', [licenseEnvKey('webhooks')]: bound };
        expect((await registry.status(env, 'webhooks'))?.state).toBe('active');
        expect((await registry.status({ ...env, APP_ID: 'other' }, 'webhooks'))?.state).toBe('invalid');
    });
});

describe('lifecycle', () => {
    it('runs onInstall once, then stays quiet', async () => {
        const { registry } = makeRegistry();
        await registry.status({}, 'webhooks');
        await registry.status({}, 'webhooks');

        expect(hooks.onInstall).toHaveBeenCalledTimes(1);
        expect(hooks.onUpgrade).not.toHaveBeenCalled();
    });

    it('runs onUpgrade when the manifest version moves', async () => {
        const store = createMemoryStateStore();
        await makeRegistry({ store }).registry.status({}, 'webhooks');
        hooks.onUpgrade.mockClear();

        await makeRegistry({ store, version: '2.0.0' }).registry.status({}, 'webhooks');

        expect(hooks.onUpgrade).toHaveBeenCalledTimes(1);
        expect(hooks.onUpgrade.mock.calls[0][0]).toMatchObject({ previousVersion: '1.0.0', version: '2.0.0' });
        expect((await store.get('webhooks'))?.version).toBe('2.0.0');
    });

    it('fires onActivate on the transition into serving, not on every resolve', async () => {
        const { registry } = makeRegistry();
        const env = { [licenseEnvKey('webhooks')]: license };

        await registry.status(env, 'webhooks');
        await registry.status(env, 'webhooks');

        expect(hooks.onActivate).toHaveBeenCalledTimes(1);
    });

    it('fires onDeactivate when a license is removed', async () => {
        const { registry } = makeRegistry();
        await registry.activate({}, 'webhooks', license);
        await registry.status({}, 'webhooks');
        expect(hooks.onActivate).toHaveBeenCalledTimes(1);

        await registry.deactivate({}, 'webhooks');
        await registry.status({}, 'webhooks');

        expect(hooks.onDeactivate).toHaveBeenCalledTimes(1);
        expect(hooks.onDeactivate.mock.calls[0][0].reason).toBe('LICENSE_MISSING');
    });

    it('never lets a throwing hook reach the caller', async () => {
        hooks.onInstall.mockImplementation(() => {
            throw new Error('vendor bug');
        });
        const warn = vi.fn();
        const registry = createPremiumRegistry({
            packages: [makePackage()],
            getStore: () => createMemoryStateStore(),
            logger: { warn },
            cacheTtlMs: 0,
        });

        await expect(registry.status({}, 'webhooks')).resolves.toBeTruthy();
        expect(warn).toHaveBeenCalled();
    });

    it('uninstall clears the record and runs the hook, but leaves the package registered', async () => {
        const { registry, store } = makeRegistry();
        await registry.status({}, 'webhooks');

        expect(await registry.uninstall({}, 'webhooks')).toBe(true);
        expect(hooks.onUninstall).toHaveBeenCalledTimes(1);
        expect(await store.get('webhooks')).toBeNull();
        // Still registered — uninstall removes bookkeeping, not the config entry.
        expect(registry.get('webhooks')).not.toBeNull();
    });
});

describe('contributions', () => {
    it('exposes tables, migrations, models and nav for host wiring', () => {
        const { registry } = makeRegistry();

        expect(Object.keys(registry.tables())).toEqual(['webhookEndpointsTable']);
        expect(registry.migrations()).toHaveLength(1);
        expect(registry.models()).toHaveLength(1);
        expect(registry.nav()[0]).toMatchObject({ packageKey: 'webhooks', href: '/admin/webhooks' });
    });
});

describe('resolution caching', () => {
    it('reuses a resolution inside the ttl and re-resolves after invalidate()', async () => {
        const store = createMemoryStateStore();
        const get = vi.spyOn(store, 'get');
        const registry = createPremiumRegistry({
            packages: [makePackage()],
            getStore: () => store,
            cacheTtlMs: 60_000,
        });

        await registry.status({}, 'webhooks');
        const afterFirst = get.mock.calls.length;
        await registry.status({}, 'webhooks');
        expect(get.mock.calls.length).toBe(afterFirst);

        registry.invalidate();
        await registry.status({}, 'webhooks');
        expect(get.mock.calls.length).toBeGreaterThan(afterFirst);
    });
});
