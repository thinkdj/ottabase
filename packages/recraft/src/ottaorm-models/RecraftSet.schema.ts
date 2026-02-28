// ============================================================
// RecraftSet table schema
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * A Recraft Set is a persistent collection of brand assets sharing a consistent
 * art style. Think of it as a "project" or "brand kit" for AI-generated visuals.
 *
 * Each set references a style preset (or stores custom overrides) so that all
 * generated logos, illustrations, and graphics maintain the same visual identity.
 */
export const recraftSetsTable = sqliteTable('recraft_sets', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    // Identity
    name: text('name').notNull(),
    description: text('description'),

    // Style configuration
    /** FK to recraft_style_presets — the base style for this set */
    stylePresetId: text('style_preset_id'),

    /** Custom overrides on top of the preset (partial StyleConfig) */
    customStyleJson: text('custom_style_json', { mode: 'json' }).$type<{
        promptSuffix?: string;
        negativePrompt?: string;
        guidanceScale?: number;
        steps?: number;
        preferredModel?: string;
        modelParams?: Record<string, unknown>;
    }>(),

    /** Generation defaults for this set */
    settingsJson: text('settings_json', { mode: 'json' }).$type<{
        defaultWidth?: number;
        defaultHeight?: number;
        defaultAssetType?: string;
        /** Custom brand keywords always included in prompts */
        brandKeywords?: string[];
    }>(),

    // Ownership & multi-app
    userId: text('user_id'),
    appId: text('app_id'),

    // Metadata
    generationCount: integer('generation_count').notNull().default(0),
    coverImageKey: text('cover_image_key'),

    createdAt: integer('created_at')
        .notNull()
        .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
        .notNull()
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now()),
});

export type RecraftSetRecord = typeof recraftSetsTable.$inferSelect;
export type NewRecraftSetRecord = typeof recraftSetsTable.$inferInsert;
