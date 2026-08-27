// ============================================================
// Premium Package wiring for otta-web.
//
// A Premium Package can be registered in `config.premium.ts` and STILL be invisible —
// its tables missing from auto-init, its nav entry hidden, its routes unmounted — with no
// error anywhere. The symptom is always the same: an empty screen that sends people to
// debug the wrong layer. These assertions are cheap and they are what stands between
// "I added the manifest" and "the feature exists".
// ============================================================

import { Router } from '@ottabase/ottarouter';
import { createMemoryStateStore, createPremiumRegistry } from '@ottabase/premium';
import { mountPremiumPackages } from '@ottabase/premium/server';
import { DEMO_PRO_LICENSE, WEBHOOKS_BASE_PATH, WEBHOOKS_PACKAGE_KEY } from '@ottabase/premium-webhooks';
import { describe, expect, it } from 'vitest';
import { getEnabledPackageTables } from '../config.migrations';
import { PREMIUM_PACKAGES } from '../config.premium';
import { getAllSchemas, getSchemaSummary } from '../db/schemas-helper';
import * as drizzleSchema from '../db/schema';
import { ADMIN_NAV_GROUPS, getEnabledAdminNav } from '../../src/ottabase/config/admin-nav';
import { PREMIUM_PACKAGES_INSTALLED } from '../../src/ottabase/config/premium';

const WEBHOOK_TABLE_KEYS = ['webhookEndpointsTable', 'webhookDeliveriesTable'];

describe('the client mirror tracks the server manifests', () => {
    // `src/ottabase/config/premium.ts` cannot import the manifests (they carry server
    // wiring), so it duplicates the KEYS. This is the assertion that keeps the duplicate
    // honest — without it, uninstalling a package leaves a nav entry pointing at a route
    // whose API is gone.
    it('lists exactly the installed package keys', () => {
        expect([...PREMIUM_PACKAGES_INSTALLED].sort()).toEqual(PREMIUM_PACKAGES.map((pkg) => pkg.key).sort());
    });
});

describe('premium tables reach auto-init', () => {
    it('appear in getEnabledPackageTables() under keys the migrator will collect', () => {
        const tables = getEnabledPackageTables();
        for (const key of WEBHOOK_TABLE_KEYS) {
            expect(Object.keys(tables)).toContain(key);
            // `collectTableSchemas` picks up entries whose KEY ends in `Table`; a correctly
            // shaped table exported under any other key is invisible to it.
            expect(key.endsWith('Table')).toBe(true);
        }
    });

    it('appear in getAllSchemas() and getSchemaSummary() — auto-init skips a table missing from either', () => {
        const schemas = Object.keys(getAllSchemas());
        const summary = getSchemaSummary().packages;
        for (const key of WEBHOOK_TABLE_KEYS) {
            expect(schemas).toContain(key);
            expect(summary).toContain(key);
        }
    });

    it('carry the tenancy columns every query filters on', () => {
        const tables = getAllSchemas() as unknown as Record<string, unknown>;
        const endpoints = tables.webhookEndpointsTable as Record<string, unknown>;
        const deliveries = tables.webhookDeliveriesTable as Record<string, unknown>;
        for (const column of ['id', 'organizationId', 'appId']) {
            expect(endpoints[column], `endpoints.${column}`).toBeDefined();
            expect(deliveries[column], `deliveries.${column}`).toBeDefined();
        }
    });

    it('exports every premium table from db/schema.ts for drizzle-kit', () => {
        const schemaExports = drizzleSchema as unknown as Record<string, unknown>;
        for (const pkg of PREMIUM_PACKAGES) {
            for (const [tableName, table] of Object.entries(pkg.tables ?? {})) {
                expect(schemaExports[tableName], `${pkg.key}.${tableName}`).toBe(table);
            }
        }
    });

    it('are contributed regardless of license — activating a key must not need a migration run', () => {
        // No license anywhere in this process, yet the tables are still collected.
        expect(Object.keys(getEnabledPackageTables())).toEqual(expect.arrayContaining(WEBHOOK_TABLE_KEYS));
    });
});

describe('premium RLS contributions', () => {
    it('ships a fail-closed policy for every tenant-owned webhook model', () => {
        const policies = PREMIUM_PACKAGES.flatMap((pkg) => pkg.policies ?? []) as Array<{
            model?: string;
            policy?: unknown;
        }>;
        expect(policies.map((policy) => policy.model).sort()).toEqual(
            expect.arrayContaining(['premium_webhook_deliveries', 'premium_webhook_endpoints']),
        );
    });
});

describe('admin navigation', () => {
    const caps = { isPlatformAdmin: true, isOrgAdmin: true };

    it('shows the premium control plane even with nothing installed', () => {
        const growth = getEnabledAdminNav(caps).find((group) => group.id === 'growth');
        expect(growth?.items.map((item) => item.href)).toContain('/admin/growth/premium');
    });

    it('shows an installed Premium Package', () => {
        const growth = getEnabledAdminNav(caps).find((group) => group.id === 'growth');
        expect(growth?.items.map((item) => item.href)).toContain('/admin/growth/webhooks');
    });

    it('hides a Premium Package that is not installed', () => {
        const uninstalled = ADMIN_NAV_GROUPS.flatMap((group) => group.items).find(
            (item) => item.requiresPremiumPackage === 'not-installed-package',
        );
        expect(uninstalled).toBeUndefined();

        const visible = getEnabledAdminNav(caps)
            .flatMap((group) => group.items)
            .filter((item) => item.requiresPremiumPackage)
            .every((item) => PREMIUM_PACKAGES_INSTALLED.includes(item.requiresPremiumPackage!));
        expect(visible).toBe(true);
    });

    // `src/ottabase/config/premium.ts` PREMIUM_ADMIN_PAGES is what actually registers a Premium Package
    // package's route (router.tsx) and sidebar entry (admin-nav.ts) — the manifest's own `nav`
    // field only drives the drop-in `/admin/growth/premium` status page. Two hrefs for the same
    // page, in two files on two sides of the client/server split; nothing else stops them
    // drifting apart the day someone renames one.
    it('the client page registration (PREMIUM_ADMIN_PAGES) matches every manifest nav href', () => {
        const manifestHrefs = PREMIUM_PACKAGES.flatMap((pkg) => (pkg.nav ?? []).map((item) => item.href)).sort();
        const clientHrefs = getEnabledAdminNav(caps)
            .flatMap((group) => group.items)
            .filter((item) => item.requiresPremiumPackage)
            .map((item) => item.href)
            .sort();
        expect(clientHrefs).toEqual(manifestHrefs);
    });
});

describe('mounted routes', () => {
    function buildApp(env: Record<string, unknown>) {
        const registry = createPremiumRegistry<Record<string, unknown>>({
            packages: PREMIUM_PACKAGES as never,
            getStore: () => createMemoryStateStore(),
            cacheTtlMs: 0,
        });
        const app = new Router<Record<string, unknown>>();
        const mounted = mountPremiumPackages(app, registry);
        return { app, mounted, env };
    }

    it('mounts every installed package that contributes routes', () => {
        expect(buildApp({}).mounted).toContain(WEBHOOKS_BASE_PATH);
    });

    it('refuses an unauthenticated caller before it advertises anything about the plan', async () => {
        const { app } = buildApp({});
        // No session in this environment, so the package's own resolver declines.
        const response = await app.handle(new Request(`https://app.test${WEBHOOKS_BASE_PATH}/`), {});
        expect(response?.status).toBe(401);
    });

    it('serves the free event catalog with no license installed', async () => {
        const { app } = buildApp({});
        const response = await app.handle(new Request(`https://app.test${WEBHOOKS_BASE_PATH}/events`), {});

        // `gate: 'entitlements'` — the namespace stays reachable so the free tier works.
        expect(response?.status).toBe(200);
    });

    it('accepts the demo license that ships with the example package', async () => {
        const registry = createPremiumRegistry<Record<string, unknown>>({
            packages: PREMIUM_PACKAGES as never,
            getStore: () => createMemoryStateStore(),
            cacheTtlMs: 0,
        });
        const status = await registry.status({ PREMIUM_LICENSE_WEBHOOKS: DEMO_PRO_LICENSE }, WEBHOOKS_PACKAGE_KEY);

        // If this fails, the key printed in the README no longer unlocks anything, and every
        // "try it in five minutes" walkthrough in the docs is broken.
        expect(status?.state).toBe('active');
        expect(status?.plan).toBe('pro');
        expect(status?.limits).toMatchObject({ endpoints: 25 });
    });

    it('closes the whole namespace when the operator disables the package', async () => {
        const registry = createPremiumRegistry<Record<string, unknown>>({
            packages: PREMIUM_PACKAGES as never,
            disabled: [WEBHOOKS_PACKAGE_KEY],
            getStore: () => createMemoryStateStore(),
            cacheTtlMs: 0,
        });
        const app = new Router<Record<string, unknown>>();
        mountPremiumPackages(app, registry);

        const response = await app.handle(new Request(`https://app.test${WEBHOOKS_BASE_PATH}/events`), {
            PREMIUM_LICENSE_WEBHOOKS: DEMO_PRO_LICENSE,
        });
        expect(response?.status).toBe(403);
    });
});
