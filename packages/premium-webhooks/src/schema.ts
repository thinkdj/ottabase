// ============================================================
// @ottabase/premium-webhooks — table schemas
// ============================================================
// UPGRADE CONTRACT (the same one every Ottabase package follows): migrations are
// ADDITIVE-ONLY across minors, and every new column is nullable or carries a default —
// the auto-init migrator cannot backfill, and a NOT NULL column with no default fails
// initialisation outright in every app that has already installed this package.
// ============================================================

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * A customer-registered destination for outbound events.
 *
 * TENANCY IS THREE-DIMENSIONAL FROM THE FIRST MIGRATION (`appId`, `organizationId`,
 * `userId`), because a package that ships single-dimension tenancy cannot grow into a
 * B2B product without a migration in every app that installed it.
 */
export const webhookEndpointsTable = sqliteTable(
    'premium_webhook_endpoints',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        /** Destination URL. HTTPS is enforced on write — see `assertDeliverableUrl`. */
        url: text('url').notNull(),
        /** Operator-facing label. */
        description: text('description'),

        /**
         * Subscribed event names, JSON array. `['*']` means every event.
         * Stored as JSON rather than a link table: the list is short, always read whole,
         * and never queried by member — a join table would be three tables of ceremony.
         */
        events: text('events', { mode: 'json' }).$type<string[]>().notNull(),

        /**
         * HMAC signing secret. Returned to the client EXACTLY ONCE, at creation.
         *
         * Not encrypted at rest, and that is a deliberate, stated limitation: it is a
         * per-endpoint shared secret whose blast radius is "someone can forge deliveries to
         * one customer endpoint", and it must be readable to sign. A package that needs
         * envelope encryption should follow `@ottabase/ottaai`'s credential store instead.
         */
        secret: text('secret').notNull(),

        /** Tenant pause switch. A disabled endpoint is skipped, never deleted. */
        enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),

        // ── Tenancy ───────────────────────────────────────────────
        organizationId: text('organization_id'),
        userId: text('user_id'),
        appId: text('app_id'),

        // ── Health: system-observed, never client-writable ─────────
        // "Our webhooks stopped arriving" is the most common support contact for this kind
        // of package, so the answer ships in the initial schema rather than a later minor.
        lastStatus: text('last_status'),
        lastStatusCode: integer('last_status_code'),
        lastDeliveryAt: integer('last_delivery_at'),
        consecutiveFailures: integer('consecutive_failures').notNull().default(0),

        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        // The dispatch path's only query: "enabled endpoints for this tenant".
        tenantIdx: index('premium_webhook_endpoints_tenant_idx').on(table.appId, table.organizationId),
    }),
);

/**
 * One delivery attempt. Written only when the `deliveries.log` entitlement is present —
 * retention is the thing being sold, so an unlicensed install keeps `lastStatus` on the
 * endpoint and nothing more.
 */
export const webhookDeliveriesTable = sqliteTable(
    'premium_webhook_deliveries',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        endpointId: text('endpoint_id').notNull(),
        event: text('event').notNull(),
        /** 'success' | 'failed'. Text, not a boolean, so 'skipped'/'retrying' can be added additively. */
        status: text('status').notNull(),
        statusCode: integer('status_code'),
        /** Bounded failure summary. Never the raw thrown value — see `summarizeDeliveryError`. */
        error: text('error'),
        durationMs: integer('duration_ms'),

        organizationId: text('organization_id'),
        appId: text('app_id'),

        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
    },
    (table) => ({
        endpointIdx: index('premium_webhook_deliveries_endpoint_idx').on(table.endpointId, table.createdAt),
    }),
);

export type WebhookEndpointRecord = typeof webhookEndpointsTable.$inferSelect;
export type NewWebhookEndpointRecord = typeof webhookEndpointsTable.$inferInsert;
export type WebhookDeliveryRecord = typeof webhookDeliveriesTable.$inferSelect;
export type NewWebhookDeliveryRecord = typeof webhookDeliveriesTable.$inferInsert;
