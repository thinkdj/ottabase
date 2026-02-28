// ============================================================
// RecraftGeneration table schema
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Individual AI-generated images belonging to a RecraftSet.
 * Stores the prompt, style snapshot, and output image reference.
 *
 * The styleSnapshot captures the exact style config used at generation time
 * so results are reproducible even if the set's style is later modified.
 */
export const recraftGenerationsTable = sqliteTable('recraft_generations', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    // Parent set
    setId: text('set_id').notNull(),

    // Generation input
    prompt: text('prompt').notNull(),
    negativePrompt: text('negative_prompt'),

    // Asset classification
    assetType: text('asset_type').notNull().default('logo'),

    // Style snapshot — frozen copy of merged preset + custom style at generation time
    styleSnapshotJson: text('style_snapshot_json', { mode: 'json' }).$type<{
        promptSuffix: string;
        negativePrompt?: string;
        guidanceScale?: number;
        steps?: number;
        model: string;
        modelParams?: Record<string, unknown>;
    }>(),

    // Output
    imageKey: text('image_key'),
    thumbnailKey: text('thumbnail_key'),
    /** Image dimensions and provider metadata */
    metadataJson: text('metadata_json', { mode: 'json' }).$type<{
        width: number;
        height: number;
        model: string;
        provider: string;
        seed?: number;
        durationMs?: number;
        format?: string;
    }>(),

    // Status
    status: text('status').notNull().default('pending'),
    errorMessage: text('error_message'),

    // User interaction
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),

    // Ownership
    userId: text('user_id'),
    appId: text('app_id'),

    // Metadata
    createdAt: integer('created_at')
        .notNull()
        .$defaultFn(() => Date.now()),
});

export type RecraftGenerationRecord = typeof recraftGenerationsTable.$inferSelect;
export type NewRecraftGenerationRecord = typeof recraftGenerationsTable.$inferInsert;
