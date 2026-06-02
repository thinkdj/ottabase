// ============================================================
// Payport — Persistence Schemas (provider-neutral table names)
// ============================================================
//
// All tables are provider-neutral (`payment_*` prefix) so downstream
// queries and admin UIs do not have to change when a new provider
// adapter is registered.
// ============================================================

import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// ---------------- Customers ----------------

export const paymentCustomersTable = sqliteTable(
    'payment_customers',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        provider: text('provider').notNull(),
        externalCustomerId: text('external_customer_id').notNull(),
        userId: text('user_id').notNull(),
        email: text('email').notNull(),
        metadata: text('metadata'), // JSON-encoded string
        organizationId: text('organization_id'),
        appId: text('app_id'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        providerExternalIdx: uniqueIndex('payment_customers_provider_external_idx').on(
            table.provider,
            table.externalCustomerId,
        ),
        userIdx: index('payment_customers_user_idx').on(table.userId),
    }),
);

// ---------------- Plans (application-owned mapping) ----------------

export const paymentPlansTable = sqliteTable(
    'payment_plans',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        slug: text('slug').notNull(),
        name: text('name').notNull(),
        /** Optional human-readable description shown on pricing pages. */
        description: text('description'),
        provider: text('provider').notNull(),
        /** Empty string allowed for plans with no provider mapping (e.g. free plan). */
        providerProductId: text('provider_product_id').notNull().default(''),
        /** JSON array of feature flag strings. */
        features: text('features').notNull().default('[]'),
        priceLabel: text('price_label'),
        /** Numeric pricing in minor units (cents). 0 = free. */
        priceMonthly: integer('price_monthly').notNull().default(0),
        priceYearly: integer('price_yearly').notNull().default(0),
        currency: text('currency').notNull().default('USD'),
        /** Sort key for pricing pages and admin lists. Lower = first. */
        displayOrder: integer('display_order').notNull().default(0),
        /** Auto-assigned to new users when no subscription is active. Only one plan should be marked default. */
        isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
        /** Marketing visibility. False = internal/legacy plan hidden from public catalog. */
        isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(true),
        metadata: text('metadata'),
        active: integer('active', { mode: 'boolean' }).notNull().default(true),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        slugIdx: uniqueIndex('payment_plans_slug_idx').on(table.slug),
        providerProductIdx: index('payment_plans_provider_product_idx').on(table.provider, table.providerProductId),
    }),
);

// ---------------- Products (provider mirror) ----------------

export const paymentProductsTable = sqliteTable(
    'payment_products',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        provider: text('provider').notNull(),
        externalProductId: text('external_product_id').notNull(),
        name: text('name').notNull(),
        description: text('description'),
        metadata: text('metadata'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        providerExternalIdx: uniqueIndex('payment_products_provider_external_idx').on(
            table.provider,
            table.externalProductId,
        ),
    }),
);

// ---------------- Subscriptions ----------------

export const paymentSubscriptionsTable = sqliteTable(
    'payment_subscriptions',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        userId: text('user_id').notNull(),
        provider: text('provider').notNull(),
        externalSubscriptionId: text('external_subscription_id').notNull(),
        planSlug: text('plan_slug').notNull(),
        status: text('status').notNull(),
        currentPeriodStart: integer('current_period_start'),
        currentPeriodEnd: integer('current_period_end'),
        cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),
        trialEndsAt: integer('trial_ends_at'),
        organizationId: text('organization_id'),
        appId: text('app_id'),
        metadata: text('metadata'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        providerExternalIdx: uniqueIndex('payment_subscriptions_provider_external_idx').on(
            table.provider,
            table.externalSubscriptionId,
        ),
        userStatusIdx: index('payment_subscriptions_user_status_idx').on(table.userId, table.status),
    }),
);

// ---------------- Checkouts ----------------

export const paymentCheckoutsTable = sqliteTable(
    'payment_checkouts',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        userId: text('user_id').notNull(),
        provider: text('provider').notNull(),
        externalCheckoutId: text('external_checkout_id').notNull(),
        planSlug: text('plan_slug').notNull(),
        checkoutUrl: text('checkout_url').notNull(),
        status: text('status').notNull().default('open'),
        successUrl: text('success_url'),
        cancelUrl: text('cancel_url'),
        metadata: text('metadata'),
        appId: text('app_id'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        providerExternalIdx: uniqueIndex('payment_checkouts_provider_external_idx').on(
            table.provider,
            table.externalCheckoutId,
        ),
    }),
);

// ---------------- Entitlements ----------------

export const paymentEntitlementsTable = sqliteTable(
    'payment_entitlements',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        userId: text('user_id').notNull(),
        feature: text('feature').notNull(),
        source: text('source').notNull().default('subscription'),
        sourceId: text('source_id'),
        expiresAt: integer('expires_at'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        userFeatureIdx: uniqueIndex('payment_entitlements_user_feature_idx').on(table.userId, table.feature),
    }),
);

// ---------------- Events (webhook log + dead-letter) ----------------

export const paymentEventsTable = sqliteTable(
    'payment_events',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        provider: text('provider').notNull(),
        externalEventId: text('external_event_id').notNull(),
        eventType: text('event_type').notNull(),
        rawPayload: text('raw_payload').notNull(),
        normalizedPayload: text('normalized_payload'),
        status: text('status').notNull().default('pending'),
        attemptCount: integer('attempt_count').notNull().default(0),
        lastError: text('last_error'),
        processedAt: integer('processed_at'),
        receivedAt: integer('received_at')
            .notNull()
            .$defaultFn(() => Date.now()),
    },
    (table) => ({
        providerExternalIdx: uniqueIndex('payment_events_provider_external_idx').on(
            table.provider,
            table.externalEventId,
        ),
        statusIdx: index('payment_events_status_idx').on(table.status),
    }),
);

// ---------------- Discounts (provider mirror + local catalog) ----------------

export const paymentDiscountsTable = sqliteTable(
    'payment_discounts',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        provider: text('provider').notNull(),
        externalDiscountId: text('external_discount_id').notNull(),
        /** Optional app-defined slug for catalog lookups. */
        slug: text('slug'),
        /** Customer-facing redeemable code (may be null for auto-applied discounts). */
        code: text('code'),
        name: text('name').notNull(),
        type: text('type').notNull(), // 'percentage' | 'fixed'
        amount: integer('amount').notNull(),
        currency: text('currency'),
        duration: text('duration'), // 'once' | 'forever' | 'repeating'
        durationInMonths: integer('duration_in_months'),
        maxRedemptions: integer('max_redemptions'),
        redeemBy: integer('redeem_by'),
        active: integer('active', { mode: 'boolean' }).notNull().default(true),
        metadata: text('metadata'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        providerExternalIdx: uniqueIndex('payment_discounts_provider_external_idx').on(
            table.provider,
            table.externalDiscountId,
        ),
        codeIdx: index('payment_discounts_code_idx').on(table.code),
        slugIdx: index('payment_discounts_slug_idx').on(table.slug),
    }),
);

// ---------------- Meters (definitions) ----------------

export const paymentMetersTable = sqliteTable(
    'payment_meters',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        provider: text('provider').notNull(),
        externalMeterId: text('external_meter_id').notNull(),
        slug: text('slug').notNull(),
        name: text('name').notNull(),
        aggregation: text('aggregation').notNull().default('sum'),
        unit: text('unit'),
        metadata: text('metadata'),
        active: integer('active', { mode: 'boolean' }).notNull().default(true),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        providerExternalIdx: uniqueIndex('payment_meters_provider_external_idx').on(
            table.provider,
            table.externalMeterId,
        ),
        slugIdx: uniqueIndex('payment_meters_slug_idx').on(table.slug),
    }),
);

// ---------------- Meter usage events (audit log + idempotency) ----------------

export const paymentMeterEventsTable = sqliteTable(
    'payment_meter_events',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        provider: text('provider').notNull(),
        meterSlug: text('meter_slug').notNull(),
        externalMeterId: text('external_meter_id'),
        userId: text('user_id').notNull(),
        externalCustomerId: text('external_customer_id'),
        /** Idempotency key sent to the provider. */
        externalEventId: text('external_event_id').notNull(),
        value: integer('value').notNull(),
        metadata: text('metadata'),
        status: text('status').notNull().default('pending'), // 'pending' | 'sent' | 'failed'
        lastError: text('last_error'),
        occurredAt: integer('occurred_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        sentAt: integer('sent_at'),
    },
    (table) => ({
        providerExternalIdx: uniqueIndex('payment_meter_events_provider_external_idx').on(
            table.provider,
            table.externalEventId,
        ),
        userMeterIdx: index('payment_meter_events_user_meter_idx').on(table.userId, table.meterSlug),
    }),
);

// ---------------- Refunds ----------------

export const paymentRefundsTable = sqliteTable(
    'payment_refunds',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        provider: text('provider').notNull(),
        externalRefundId: text('external_refund_id').notNull(),
        externalOrderId: text('external_order_id'),
        externalSubscriptionId: text('external_subscription_id'),
        externalCustomerId: text('external_customer_id'),
        userId: text('user_id'),
        amount: integer('amount').notNull(),
        currency: text('currency').notNull(),
        reason: text('reason'),
        status: text('status').notNull().default('pending'),
        metadata: text('metadata'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        providerExternalIdx: uniqueIndex('payment_refunds_provider_external_idx').on(
            table.provider,
            table.externalRefundId,
        ),
        orderIdx: index('payment_refunds_order_idx').on(table.externalOrderId),
        userIdx: index('payment_refunds_user_idx').on(table.userId),
    }),
);

// ---------------- License Keys ----------------

export const paymentLicenseKeysTable = sqliteTable(
    'payment_license_keys',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        provider: text('provider').notNull(),
        externalLicenseKeyId: text('external_license_key_id').notNull(),
        /** Stored only if the app explicitly opts-in; otherwise mask via the application layer. */
        keyMasked: text('key_masked').notNull(),
        userId: text('user_id'),
        externalCustomerId: text('external_customer_id'),
        externalProductId: text('external_product_id'),
        status: text('status').notNull().default('granted'),
        activationsLimit: integer('activations_limit'),
        activationsCount: integer('activations_count').notNull().default(0),
        usageLimit: integer('usage_limit'),
        usage: integer('usage').notNull().default(0),
        validations: integer('validations').notNull().default(0),
        expiresAt: integer('expires_at'),
        metadata: text('metadata'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        providerExternalIdx: uniqueIndex('payment_license_keys_provider_external_idx').on(
            table.provider,
            table.externalLicenseKeyId,
        ),
        userIdx: index('payment_license_keys_user_idx').on(table.userId),
    }),
);

// ---------------- License Activations ----------------

export const paymentLicenseActivationsTable = sqliteTable(
    'payment_license_activations',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        provider: text('provider').notNull(),
        externalActivationId: text('external_activation_id').notNull(),
        licenseKeyId: text('license_key_id').notNull(),
        externalLicenseKeyId: text('external_license_key_id').notNull(),
        label: text('label'),
        metadata: text('metadata'),
        status: text('status').notNull().default('active'), // 'active' | 'deactivated'
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        providerExternalIdx: uniqueIndex('payment_license_activations_provider_external_idx').on(
            table.provider,
            table.externalActivationId,
        ),
        licenseIdx: index('payment_license_activations_license_idx').on(table.licenseKeyId),
    }),
);

// ---------------- Inferred types ----------------

export type PaymentCustomerRecord = typeof paymentCustomersTable.$inferSelect;
export type PaymentPlanRecord = typeof paymentPlansTable.$inferSelect;
export type PaymentProductRecord = typeof paymentProductsTable.$inferSelect;
export type PaymentSubscriptionRecord = typeof paymentSubscriptionsTable.$inferSelect;
export type PaymentCheckoutRecord = typeof paymentCheckoutsTable.$inferSelect;
export type PaymentEntitlementRecord = typeof paymentEntitlementsTable.$inferSelect;
export type PaymentEventRecord = typeof paymentEventsTable.$inferSelect;
export type PaymentDiscountRecord = typeof paymentDiscountsTable.$inferSelect;
export type PaymentMeterRecord = typeof paymentMetersTable.$inferSelect;
export type PaymentMeterEventRecord = typeof paymentMeterEventsTable.$inferSelect;
export type PaymentRefundRecord = typeof paymentRefundsTable.$inferSelect;
export type PaymentLicenseKeyRecord = typeof paymentLicenseKeysTable.$inferSelect;
export type PaymentLicenseActivationRecord = typeof paymentLicenseActivationsTable.$inferSelect;
