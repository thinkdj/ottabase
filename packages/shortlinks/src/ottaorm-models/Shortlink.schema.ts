// ============================================================
// Shortlink table schema
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Shortlinks table schema for URL shortening service
 *
 * Supports multiple apps using the same database via appId field
 * Enables custom short codes and optional expiry dates
 */
export const shortlinksTable = sqliteTable('shortlinks', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    // The full destination URL
    fullUrl: text('full_url').notNull(),

    // The short identifier (e.g., "gh" in go.example.com/gh)
    shortCode: text('short_code').notNull().unique(),

    // Type of link (e.g., "redirect", "tracking", "internal")
    type: text('type').notNull().default('redirect'),

    // App identifier for multi-app database sharing (nullable, opt-in)
    appId: text('app_id'),

    // Optional expiry timestamp
    expiryDate: integer('expiry_date'),

    // Interstitial redirect settings
    interstitialEnabled: integer('interstitial_enabled', {
        mode: 'boolean',
    })
        .notNull()
        .default(false),
    interstitialSeconds: integer('interstitial_seconds').default(10),

    // Metadata
    createdAt: integer('created_at')
        .notNull()
        .$defaultFn(() => Date.now()),

    updatedAt: integer('updated_at')
        .notNull()
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now()),
});

export type ShortlinkRecord = typeof shortlinksTable.$inferSelect;
export type NewShortlinkRecord = typeof shortlinksTable.$inferInsert;
