// ============================================================
// Single-row homepage UI: slot variants + theme preset id
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Maps slot name → variant id (matches Next.js HomepageConfig) */
export type HomepageVariantBySlotJson = Record<string, string>;

export const homepageDisplaySettingsTable = sqliteTable('homepage_display_settings', {
    id: text('id').primaryKey(),
    variantBySlotJson: text('variant_by_slot_json', { mode: 'json' }).$type<HomepageVariantBySlotJson>().notNull(),
    themePresetId: text('theme_preset_id').notNull(),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type HomepageDisplaySettingsRow = typeof homepageDisplaySettingsTable.$inferSelect;
export type NewHomepageDisplaySettingsRow = typeof homepageDisplaySettingsTable.$inferInsert;
