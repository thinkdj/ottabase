// ============================================================
// Payport Admin — Entity Registry (config-driven CRUD)
// ============================================================
//
// One ModelConfig per Payport entity. ModelCrud consumes these
// directly. Field metadata flows from each model's `static fields`
// declaration, so adding a new field anywhere in the package
// automatically surfaces it in the admin UI.
//
// All entries route through `/api/ottaorm/{entity}` (the generic
// secure CRUD endpoint registered by the app). Mark sensitive
// entities (events, license keys) `readOnly` so the UI hides
// create / edit / delete actions even though the API would allow
// them for super-admins.
// ============================================================

import { createModelConfig, type ModelConfig } from '@ottabase/forms';
import {
    PaymentCheckout,
    PaymentCustomer,
    PaymentDiscount,
    PaymentEntitlement,
    PaymentEvent,
    PaymentLicenseActivation,
    PaymentLicenseKey,
    PaymentMeter,
    PaymentMeterEvent,
    PaymentPlan,
    PaymentProduct,
    PaymentRefund,
    PaymentSubscription,
} from '../models';

/** Augmented entity descriptor used by the Payport admin pages + nav. */
export interface PayportEntityDescriptor {
    /** Entity slug, also used as URL segment under /admin/billing/. */
    key: string;
    /** Generated CRUD config consumed by `<ModelCrud />`. */
    config: ModelConfig;
    /** Plain English display name. */
    title: string;
    /** Card / page description. */
    description: string;
    /** When true, the admin UI hides create/edit/delete (audit-style data). */
    readOnly?: boolean;
    /**
     * When true, this entity is only shown to super-admins (the wildcard
     * `*:*` permission). Other admins see only the public-facing entities.
     */
    superAdminOnly?: boolean;
    /** Logical bucket used to group sidebar items. */
    section: 'catalog' | 'customers' | 'billing' | 'licensing' | 'audit';
}

const PAYPORT_API_PATH = '/api/ottaorm';

/**
 * All Payport admin entities. Order here = order in nav.
 *
 * NOTE: `displayNamePlural` overrides come from each model's static
 * properties (e.g. `static displayNamePlural`). Override here only when
 * the model definition is ambiguous.
 */
export const PAYPORT_ENTITIES: PayportEntityDescriptor[] = [
    {
        key: 'payment_plans',
        title: 'Plans',
        description: 'Local mirror of subscription plans surfaced to checkout and entitlements.',
        section: 'catalog',
        config: createModelConfig(PaymentPlan, { apiPath: PAYPORT_API_PATH }),
    },
    {
        key: 'payment_products',
        title: 'Products',
        description: 'One-time purchaseable products synced from the active provider.',
        section: 'catalog',
        config: createModelConfig(PaymentProduct, { apiPath: PAYPORT_API_PATH }),
    },
    {
        key: 'payment_discounts',
        title: 'Discounts',
        description: 'Coupons, promo codes, and percent / amount-off discounts.',
        section: 'catalog',
        config: createModelConfig(PaymentDiscount, { apiPath: PAYPORT_API_PATH }),
    },
    {
        key: 'payment_meters',
        title: 'Meters',
        description: 'Usage-based billing meters (tokens, requests, GB-hours, etc.).',
        section: 'catalog',
        config: createModelConfig(PaymentMeter, { apiPath: PAYPORT_API_PATH }),
    },
    {
        key: 'payment_customers',
        title: 'Customers',
        description: 'Billing customers linked to your platform users.',
        section: 'customers',
        config: createModelConfig(PaymentCustomer, { apiPath: PAYPORT_API_PATH }),
    },
    {
        key: 'payment_subscriptions',
        title: 'Subscriptions',
        description: 'Active, trialing, cancelled and past-due subscriptions across all plans.',
        section: 'customers',
        config: createModelConfig(PaymentSubscription, { apiPath: PAYPORT_API_PATH }),
    },
    {
        key: 'payment_entitlements',
        title: 'Entitlements',
        description: 'Resolved feature flags / quotas granted by an active subscription.',
        readOnly: true,
        section: 'customers',
        config: createModelConfig(PaymentEntitlement, { apiPath: PAYPORT_API_PATH }),
    },
    {
        key: 'payment_checkouts',
        title: 'Checkouts',
        description: 'Hosted checkout sessions and their conversion outcome.',
        readOnly: true,
        section: 'billing',
        config: createModelConfig(PaymentCheckout, { apiPath: PAYPORT_API_PATH }),
    },
    {
        key: 'payment_refunds',
        title: 'Refunds',
        description: 'Refunds issued against orders. Idempotent on (provider, externalRefundId).',
        section: 'billing',
        config: createModelConfig(PaymentRefund, { apiPath: PAYPORT_API_PATH }),
    },
    {
        key: 'payment_meter_events',
        title: 'Usage Events',
        description: 'Individual metered usage events (idempotent on externalEventId).',
        readOnly: true,
        section: 'billing',
        config: createModelConfig(PaymentMeterEvent, { apiPath: PAYPORT_API_PATH }),
    },
    {
        key: 'payment_license_keys',
        title: 'License Keys',
        description: 'Issued license keys. Raw key material is never stored — only a mask.',
        section: 'licensing',
        config: createModelConfig(PaymentLicenseKey, { apiPath: PAYPORT_API_PATH }),
    },
    {
        key: 'payment_license_activations',
        title: 'License Activations',
        description: 'Per-device / per-install activations against a license key.',
        readOnly: true,
        section: 'licensing',
        config: createModelConfig(PaymentLicenseActivation, { apiPath: PAYPORT_API_PATH }),
    },
    {
        key: 'payment_events',
        title: 'Webhook Events',
        description: 'Raw webhook event log. Replay supported via the admin actions menu.',
        readOnly: true,
        superAdminOnly: true,
        section: 'audit',
        config: createModelConfig(PaymentEvent, { apiPath: PAYPORT_API_PATH }),
    },
];

/** O(1) lookup by entity key. */
export const PAYPORT_ENTITIES_BY_KEY: Record<string, PayportEntityDescriptor> = Object.fromEntries(
    PAYPORT_ENTITIES.map((e) => [e.key, e]),
);

/** Convenience: get an entity descriptor or throw a helpful error. */
export function getPayportEntity(key: string): PayportEntityDescriptor {
    const entity = PAYPORT_ENTITIES_BY_KEY[key];
    if (!entity) throw new Error(`[payport/admin] Unknown entity '${key}'. Did you forget to register it?`);
    return entity;
}
