// ============================================================
// Payport Admin — Sidebar Navigation
// ============================================================
//
// Exports a single nav-group object that is *structurally* compatible
// with the app's `AdminNavGroup` shape (apps/otta-web/src/ottabase/
// config/admin-nav.ts). Apps add it to their ADMIN_NAV_GROUPS array:
//
//     import { PAYPORT_ADMIN_NAV } from '@ottabase/payport/admin';
//     export const ADMIN_NAV_GROUPS = [...EXISTING, PAYPORT_ADMIN_NAV];
//
// We deliberately don't import `AdminNavGroup` from otta-web (would
// invert the dependency direction). Instead we define the matching
// shape locally and rely on structural typing.
// ============================================================

import type { LucideIcon } from 'lucide-react';
import {
    Activity,
    BarChart3,
    CreditCard,
    Gauge,
    KeyRound,
    Package,
    Receipt,
    ServerCog,
    Tag as TagIcon,
    Users,
    Wallet,
    Zap,
} from 'lucide-react';
import { PAYPORT_ENTITIES } from './entities';

export interface PayportAdminNavItem {
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
    /** When true, only visible to users with the `*:*` wildcard permission. */
    superAdminOnly?: boolean;
}

export interface PayportAdminNavGroup {
    id: 'billing';
    label: string;
    icon: LucideIcon;
    items: PayportAdminNavItem[];
}

/** Icon override per entity key (entities.ts stays UI-agnostic). */
const ENTITY_ICONS: Record<string, LucideIcon> = {
    payment_plans: Package,
    payment_products: Package,
    payment_discounts: TagIcon,
    payment_meters: Gauge,
    payment_customers: Users,
    payment_subscriptions: CreditCard,
    payment_entitlements: Zap,
    payment_checkouts: Wallet,
    payment_refunds: Receipt,
    payment_meter_events: Activity,
    payment_license_keys: KeyRound,
    payment_license_activations: KeyRound,
    payment_events: Activity,
};

/**
 * The single Payport admin nav group. The first two items
 * (Dashboard + Providers) are bespoke pages; the rest are
 * config-driven CRUD views generated from `PAYPORT_ENTITIES`.
 */
export const PAYPORT_ADMIN_NAV: PayportAdminNavGroup = {
    id: 'billing',
    label: 'Billing',
    icon: CreditCard,
    items: [
        {
            title: 'Dashboard',
            description: 'Revenue, active subscriptions, churn signals, and recent webhook events.',
            href: '/admin/billing',
            icon: BarChart3,
        },
        {
            title: 'Providers',
            description: 'Active payment provider, capability matrix, and webhook health.',
            href: '/admin/billing/providers',
            icon: ServerCog,
            superAdminOnly: true,
        },
        ...PAYPORT_ENTITIES.map((entity) => ({
            title: entity.title,
            description: entity.description,
            href: `/admin/billing/${entity.key.replace(/^payment_/, '')}`,
            icon: ENTITY_ICONS[entity.key] ?? Package,
            superAdminOnly: entity.superAdminOnly,
        })),
    ],
};
