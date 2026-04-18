// ============================================================
// @ottabase/ottaorm - Media table schema
// ============================================================
//
// Core table for tracking all uploaded media (images, videos,
// audio, documents) across the platform. Supports R2 and
// Cloudflare Images providers, RLS-aware with tenant/user scoping.
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Media table — single source of truth for all uploaded files.
 */
export const mediaTable = sqliteTable('media', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    // Storage
    provider: text('provider').notNull().default('r2'),
    storageKey: text('storage_key').notNull(),
    url: text('url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    previewUrl: text('preview_url'),

    // Classification
    mimeType: text('mime_type').notNull().default('application/octet-stream'),
    mediaKind: text('media_kind').notNull().default('other'),
    status: text('status').notNull().default('active'),

    // File info
    originalName: text('original_name').notNull(),
    title: text('title'),
    altText: text('alt_text'),
    caption: text('caption'),
    extension: text('extension'),

    // Dimensions / size
    fileSize: integer('file_size').notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),

    // Extensible JSON fields
    variants: text('variants', { mode: 'json' }),
    metadata: text('metadata', { mode: 'json' }),

    // Ownership / multi-tenant
    appId: text('app_id'),
    organizationId: text('organization_id'),
    userId: text('user_id'),

    // Timestamps
    createdAt: integer('created_at')
        .notNull()
        .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
        .notNull()
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now()),
    deletedAt: integer('deleted_at'),
});

export type MediaType = typeof mediaTable.$inferSelect;
export type NewMediaType = typeof mediaTable.$inferInsert;
