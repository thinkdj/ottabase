// ============================================================
// Homepage Display Settings table (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Single-row settings table storing the full homepage display state:
 * - Variant selections per slot (JSON matching HomepageConfig)
 * - Active theme preset name
 * - Fallback theme preset ID
 */
export const homepageDisplaySettingsTable = sqliteTable('homepage_display_settings', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => 'default'),
    /**
     * JSON object mapping slot names to active variant IDs.
     * Shape: Record<SlotName, string> e.g. { hero: 'centered', features: 'grid', ... }
     */
    variantBySlotJson: text('variant_by_slot_json', { mode: 'json' }).$type<Record<string, string>>(),
    /** Active theme preset name (e.g. 'default', 'neo', 'crisp') */
    themePreset: text('theme_preset').default('default'),
    /** Fallback theme preset ID for SSR */
    fallbackThemePresetId: text('fallback_theme_preset_id'),
    /** Multi-app identifier */
    appId: text('app_id'),
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
