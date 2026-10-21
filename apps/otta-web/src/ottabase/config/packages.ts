/**
 * Packages installed in this app — the CLIENT half.
 *
 * The authoritative list is `ottabase/packages.ts`, which cannot be imported here: a
 * manifest carries server wiring (session resolution, route factories, model classes) that
 * has no place in a browser bundle. So each package also has a small client descriptor:
 * its key, the admin pages it renders and its other pages. The router mounts them and the
 * account menu links the pages that carry a `menu` entry, so `otta add` writes this file
 * and nothing else in `src/`. `ottabase/__tests__/packages-registration.test.ts` fails if
 * the two lists drift, which is what keeps the duplication honest.
 *
 * INSTALLED, NOT LICENSED: a Premium Package's page stays reachable with its license
 * lapsed, rendering its upsell, because the operator needs a route to the screen that
 * fixes it. The server refuses the data either way.
 */
import { definePackageClient, installedPackages, packageAdminPages, packageRoutes } from '@ottabase/kernel/client';
import { WEBHOOKS_PACKAGE_KEY } from '@ottabase/webhooks';
import { Archive, Gift, Webhook } from 'lucide-react';

export const CLIENT_PACKAGES = [
    definePackageClient({ key: 'core' }),
    definePackageClient({ key: 'app' }),
    definePackageClient({ key: 'brand-engine' }),
    definePackageClient({ key: 'ottablog' }),
    definePackageClient({ key: 'comments' }),
    definePackageClient({ key: 'ottalanding' }),
    definePackageClient({ key: 'shortlinks' }),
    definePackageClient({
        key: 'referrals',
        routes: [
            {
                path: '/referrals',
                load: () => import('@/pages/referrals/ReferralsPage'),
                exportName: 'ReferralsPage',
                menu: { title: 'Referrals', icon: Gift },
            },
        ],
    }),
    definePackageClient({ key: 'ottaai' }),
    definePackageClient({ key: 'flags' }),
    definePackageClient({ key: 'meter' }),
    definePackageClient({ key: 'apikeys' }),
    definePackageClient({ key: 'postmaster' }),
    definePackageClient({ key: 'fleet' }),
    definePackageClient({ key: 'legal' }),
    definePackageClient({ key: 'screenshot' }),
    definePackageClient({
        key: 'vault',
        adminPages: [
            {
                path: '/admin/infrastructure/vault',
                title: 'Vault',
                description: 'Backups to R2, restore, and per-tenant export.',
                icon: Archive,
                group: 'infrastructure',
                scope: 'platform',
                premium: true,
                load: () => import('@/pages/admin/infrastructure/VaultPage'),
                exportName: 'VaultPage',
            },
        ],
    }),
    definePackageClient({
        key: WEBHOOKS_PACKAGE_KEY,
        adminPages: [
            {
                path: '/admin/growth/webhooks',
                title: 'Webhooks',
                description: 'Outbound event delivery with signed payloads, endpoint health, and a delivery log.',
                icon: Webhook,
                group: 'growth',
                scope: 'org',
                premium: true,
                load: () => import('@/pages/admin/growth/WebhooksPage'),
                exportName: 'WebhooksPage',
            },
        ],
    }),
];

/** `{ [key]: true }` for every installed package: gates routes, nav and layout chrome. */
export const PACKAGES_ENABLED: Record<string, boolean> = installedPackages(CLIENT_PACKAGES);

export function isPackageInstalled(key: string): boolean {
    return PACKAGES_ENABLED[key] === true;
}

/** Every admin page a package renders, tagged with its package key. Drives the router and the nav. */
export const PACKAGE_ADMIN_PAGES = packageAdminPages(CLIENT_PACKAGES);

/** Every other page a package renders. Drives the router. */
export const PACKAGE_ROUTES = packageRoutes(CLIENT_PACKAGES);

/** The package pages linked from the signed-in account menu, in list order. */
export const PACKAGE_ACCOUNT_LINKS = PACKAGE_ROUTES.flatMap((route) =>
    route.menu ? [{ path: route.path, title: route.menu.title, icon: route.menu.icon, pkg: route.pkg }] : [],
);
