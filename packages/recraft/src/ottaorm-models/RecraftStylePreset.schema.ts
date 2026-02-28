// ============================================================
// RecraftStylePreset table schema
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Style presets for AI image generation.
 * Each preset defines prompt modifiers, model parameters, and visual characteristics
 * that produce a consistent art style (e.g., hand-drawn, retro, watercolor).
 *
 * Built-in presets are seeded on init; users can create custom presets per-app.
 */
export const recraftStylePresetsTable = sqliteTable('recraft_style_presets', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    // Identity
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    category: text('category').notNull().default('illustration'),

    // Style configuration — prompt engineering + model params
    styleConfigJson: text('style_config_json', { mode: 'json' }).$type<{
        /** Appended to every prompt for this style */
        promptSuffix: string;
        /** Negative prompt to steer away from unwanted features */
        negativePrompt?: string;
        /** Guidance scale (CFG) — higher = more prompt-adherent */
        guidanceScale?: number;
        /** Number of inference steps */
        steps?: number;
        /** Preferred model identifier */
        preferredModel?: string;
        /** Extra model-specific parameters */
        modelParams?: Record<string, unknown>;
    }>(),

    // Preview thumbnail (R2 key or data URI)
    thumbnailUrl: text('thumbnail_url'),

    // Whether this is a framework-provided preset (not deletable)
    isBuiltIn: integer('is_built_in', { mode: 'boolean' }).notNull().default(true),

    // Multi-app scoping (null = system-level / shared)
    appId: text('app_id'),

    // Metadata
    createdAt: integer('created_at')
        .notNull()
        .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
        .notNull()
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now()),
});

export type RecraftStylePresetRecord = typeof recraftStylePresetsTable.$inferSelect;
export type NewRecraftStylePresetRecord = typeof recraftStylePresetsTable.$inferInsert;
