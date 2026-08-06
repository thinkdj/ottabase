/**
 * Premium Packages installed in this app — CLIENT-side mirror.
 *
 * The authoritative list is `ottabase/config.premium.ts`, which cannot be imported here:
 * a manifest carries server-side wiring (session resolution, route factories) that has no
 * place in a browser bundle.
 *
 * So this is a deliberate, MINIMAL duplicate — keys only, no behaviour — used to decide
 * which admin nav entries exist. `__tests__/premium-registration.test.ts` fails if the two
 * lists drift, which is what keeps the duplication honest.
 *
 * INSTALLED, NOT LICENSED: a page whose license has lapsed must stay reachable, or the
 * operator has no way to get to the screen that would fix it.
 */

import { WEBHOOKS_PACKAGE_KEY } from '@ottabase/premium-webhooks';
import type { LucideIcon } from 'lucide-react';
import { Webhook } from 'lucide-react';
import type { ComponentType } from 'react';

export const PREMIUM_PACKAGES_INSTALLED: readonly string[] = [WEBHOOKS_PACKAGE_KEY];

/** Is a Premium Package installed in this deployment? Says nothing about its license. */
export function isPremiumPackageInstalled(key: string): boolean {
    return PREMIUM_PACKAGES_INSTALLED.includes(key);
}

/**
 * A Premium Package's admin page, registered once here.
 *
 * `router.tsx` derives its route (`makeAdminRoute(path, load, exportName, { scope })`) from
 * this list, and `admin-nav.ts` derives the matching sidebar/card entry from it — so wiring a
 * new Premium Package's UI touches THIS FILE ONLY, not router.tsx and admin-nav.ts by hand.
 * (Server-side wiring — tables, migrations, worker routes — still goes through
 * `ottabase/config.premium.ts`; this is the client-side counterpart, same split as
 * `PREMIUM_PACKAGES_INSTALLED` above.)
 */
export interface PremiumAdminPage {
    /** Manifest key from `ottabase/config.premium.ts`. Gates both route and nav visibility. */
    pkg: string;
    /** Route path, e.g. `/admin/growth/webhooks`. */
    path: string;
    title: string;
    description: string;
    icon: LucideIcon;
    /** `org` = own-tenant admins may see it; `platform` (default) = platform admins only. */
    scope?: 'platform' | 'org';
    /** Lazy import of the page module; the named export `exportName` is rendered. */
    load: () => Promise<Record<string, ComponentType>>;
    exportName: string;
}

export const PREMIUM_ADMIN_PAGES: PremiumAdminPage[] = [
    {
        pkg: WEBHOOKS_PACKAGE_KEY,
        path: '/admin/growth/webhooks',
        title: 'Webhooks',
        description: 'Outbound event delivery with signed payloads, endpoint health, and a delivery log.',
        icon: Webhook,
        scope: 'org',
        load: () => import('@/pages/admin/growth/WebhooksPage'),
        exportName: 'WebhooksPage',
    },
];
