// ============================================================
// Feature Flags table schema
// ============================================================

import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Feature flags table schema.
 *
 * Supports targeting by:
 * - Global on/off toggle
 * - Organization plan (free, pro, enterprise)
 * - Specific organization IDs
 * - Specific user IDs
 * - Percentage rollout (0-100)
 */
export const featureFlagsTable = sqliteTable('feature_flags', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    // Unique key used in code: e.g. "billing.invoices", "editor.ai-assist"
    key: text('key').notNull().unique(),

    // Human-readable name
    name: text('name').notNull(),

    // Optional description
    description: text('description'),

    // Master toggle
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),

    // Targeting rules stored as JSON
    // { plans: ["pro","enterprise"], orgIds: ["org-xxx"], userIds: ["uid-xxx"], percentage: 50 }
    rules: text('rules', { mode: 'json' })
        .$type<FlagRules>()
        .default({} as FlagRules),

    // Metadata
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),

    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`)
        .$onUpdate(() => new Date()),
});

export interface FlagRules {
    /** Enable for these plans (e.g. ["pro", "enterprise"]) */
    plans?: string[];
    /** Enable for these specific organization IDs */
    orgIds?: string[];
    /** Enable for these specific user IDs */
    userIds?: string[];
    /** Percentage rollout (0-100). Uses deterministic hashing on userId. */
    percentage?: number;
}

export type FeatureFlagRecord = typeof featureFlagsTable.$inferSelect;
export type NewFeatureFlagRecord = typeof featureFlagsTable.$inferInsert;
