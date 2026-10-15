// ============================================================
// Package wiring for otta-web.
//
// A package can be listed in `ottabase/packages.ts` and STILL be invisible: its tables
// missing from auto-init, its nav entry hidden, its routes unmounted, with no error
// anywhere. The symptom is always the same: an empty screen that sends people to debug
// the wrong layer. These assertions are cheap and they are what stands between "I added
// the manifest" and "the feature exists".
// ============================================================
import { Router } from '@ottabase/ottarouter';
import { createMemoryStateStore, createPremiumRegistry, isPremiumPackage } from '@ottabase/premium';
import { mountPremiumPackages } from '@ottabase/premium/server';
import { DEMO_PRO_LICENSE, WEBHOOKS_BASE_PATH, WEBHOOKS_PACKAGE_KEY } from '@ottabase/premium-webhooks';
import { describe, expect, it } from 'vitest';
import { getAllSchemas, getSchemaSummary } from '../db/schemas-helper';
import * as drizzleSchema from '../db/schema';
import { packages } from '../packages';
import { ADMIN_NAV_GROUPS, getEnabledAdminNav } from '../../src/ottabase/config/admin-nav';
import { CLIENT_PACKAGES, PACKAGE_ADMIN_PAGES, PACKAGES_ENABLED } from '../../src/ottabase/config/packages';

const WEBHOOK_TABLE_KEYS = ['webhookEndpointsTable', 'webhookDeliveriesTable'];

describe('the client list mirrors the server list', () => {
    // `src/ottabase/config/packages.ts` cannot import the manifests (they carry server
    // wiring), so it duplicates the KEYS. This is the assertion that keeps the duplicate
    // honest: without it, removing a package leaves a nav entry pointing at a route whose
    // API is gone, or hides the pages of one that is installed.
    it('lists exactly the installed package keys', () => {
        expect(CLIENT_PACKAGES.map((client) => client.key).sort()).toEqual(packages.keys().sort());
        expect(PACKAGES_ENABLED).toEqual(packages.installed());
    });

    it('registers a client admin page for every nav entry a manifest declares', () => {
        const manifestHrefs = packages
            .nav()
            .map((item) => item.href)
            .sort();
        const clientPaths = PACKAGE_ADMIN_PAGES.map((page) => page.path).sort();
        expect(clientPaths).toEqual(manifestHrefs);
    });
});

describe('package tables reach auto-init', () => {
    it('appear in getAllSchemas() under keys the migrator will collect', () => {
        const schemas = Object.keys(getAllSchemas());
        for (const key of Object.keys(packages.tables())) {
            expect(schemas).toContain(key);
            // `collectTableSchemas` picks up entries whose KEY ends in `Table`; a correctly
            // shaped table exported under any other key is invisible to it.
            expect(key.endsWith('Table')).toBe(true);
        }
        expect(getSchemaSummary().packages).toEqual(expect.arrayContaining(WEBHOOK_TABLE_KEYS));
    });

    it('exports every package table from db/schema.ts for drizzle-kit, as the same object', () => {
        const schemaExports = drizzleSchema as unknown as Record<string, unknown>;
        for (const pkg of packages.packages) {
            for (const [tableName, table] of Object.entries(pkg.tables ?? {})) {
                expect(schemaExports[tableName], `${pkg.key}.${tableName}`).toBe(table);
            }
        }
    });

    it('premium tables are contributed regardless of license — activating a key must not need a migration run', () => {
        expect(Object.keys(packages.tables())).toEqual(expect.arrayContaining(WEBHOOK_TABLE_KEYS));
    });
});

describe('what the packages contribute', () => {
    it('every package with tables also registers models, and premium policies fail closed', () => {
        for (const pkg of packages.packages) {
            if (Object.keys(pkg.tables ?? {}).length > 0) {
                expect(pkg.models?.length, `${pkg.key} has tables but no models`).toBeGreaterThan(0);
            }
        }
        const policies = packages.policies().map((policy) => policy.model);
        expect(policies).toEqual(
            expect.arrayContaining([
                'premium_webhook_deliveries',
                'premium_webhook_endpoints',
                'landing_sites',
                'landing_pages',
                'landing_leads',
            ]),
        );
    });

    it('collects every cron handler and seeds the housekeeping ones', () => {
        const cron = packages.cron();
        expect(Object.keys(cron)).toEqual(
            expect.arrayContaining(['audit:prune', 'landing:notify-leads', 'queue:send-email']),
        );
        expect(cron['audit:prune'].schedule).toBe('17 3 * * *');
        expect(cron['landing:notify-leads'].schedule).toBeUndefined();
    });

    it('collects the queue handlers, including the event bus consumer', () => {
        expect(Object.keys(packages.queue())).toEqual(
            expect.arrayContaining(['send-email', 'process-order', 'events:deliver']),
        );
    });

    it('declares the D1 binding as required by core', () => {
        expect(packages.env().required).toContain('OBCF_D1');
    });
});

describe('admin navigation', () => {
    const caps = { isPlatformAdmin: true, isOrgAdmin: true };

    it('shows the premium control plane even with nothing licensed', () => {
        const growth = getEnabledAdminNav(caps).find((group) => group.id === 'growth');
        expect(growth?.items.map((item) => item.href)).toContain('/admin/growth/premium');
    });

    it('shows an installed package page and gates it on the package key', () => {
        const growth = getEnabledAdminNav(caps).find((group) => group.id === 'growth');
        const webhooks = growth?.items.find((item) => item.href === '/admin/growth/webhooks');
        expect(webhooks?.requiresPackage).toBe(WEBHOOKS_PACKAGE_KEY);
    });

    it('every package-gated nav item names an installed package', () => {
        const gated = ADMIN_NAV_GROUPS.flatMap((group) => group.items).filter((item) => item.requiresPackage);
        expect(gated.length).toBeGreaterThan(0);
        for (const item of gated) {
            expect(PACKAGES_ENABLED[item.requiresPackage!], `${item.href} requires ${item.requiresPackage}`).toBe(true);
        }
    });
});

describe('mounted routes', () => {
    function buildApp(env: Record<string, unknown>) {
        const registry = createPremiumRegistry<Record<string, unknown>>({
            packages: packages.packages.filter(isPremiumPackage) as never,
            getStore: () => createMemoryStateStore(),
            cacheTtlMs: 0,
        });
        const app = new Router<Record<string, unknown>>();
        const mounted = mountPremiumPackages(app, registry);
        return { app, mounted, env };
    }

    it('mounts the webhooks namespace and serves its free tier without a license', async () => {
        const { app, mounted, env } = buildApp({});
        expect([...mounted].sort()).toEqual(['/api/vault', WEBHOOKS_BASE_PATH]);
        const response = await app.handle(new Request(`https://app.test${WEBHOOKS_BASE_PATH}/events`), env);
        // The free path answers (401 from the caller resolver, since there is no session),
        // never 402: `entitlements` gating keeps the namespace reachable.
        expect(response?.status).not.toBe(402);
        expect(response?.status).not.toBe(404);
    });

    it('still reaches the namespace with the demo license', async () => {
        const { app, env } = buildApp({ [`PREMIUM_LICENSE_${WEBHOOKS_PACKAGE_KEY.toUpperCase()}`]: DEMO_PRO_LICENSE });
        const response = await app.handle(new Request(`https://app.test${WEBHOOKS_BASE_PATH}/events`), env);
        expect(response?.status).not.toBe(402);
    });
});
