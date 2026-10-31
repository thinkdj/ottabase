// ============================================================
// @ottabase/ottaorm - Media table schema
// ============================================================
//
// One row per stored file, written only by the files service
// (`createFiles` in @ottabase/ottaupload). The row holds what the
// object cannot: who owns it, which purpose and audience it was
// stored under, the original filename and the variants made from it.
// URLs are never stored: they are computed from the key and the
// audience wherever a view is built, so a change of public domain
// changes no row. Deletes are real (the objects go with the row).
// ============================================================

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** One rendition: `<appId>/<purpose>/<id>/<variant>.webp`. */
export interface MediaVariantInfo {
    key: string;
    width: number;
    height: number;
    size: number;
}

/**
 * Media table — single source of truth for all uploaded files.
 */
export const mediaTable = sqliteTable(
    'media',
    {
        // 32 hex chars; the same id is in the storage key.
        id: text('id').primaryKey(),

        // Ownership / multi-tenant
        appId: text('app_id').notNull(),
        organizationId: text('organization_id'),
        userId: text('user_id'),

        // What it is for and who may read it: 'public' | 'members' | 'owner'
        purpose: text('purpose').notNull(),
        audience: text('audience').notNull(),

        // Storage: `<appId>/<purpose>/<id>.<ext>`, in the audience's bucket
        storageKey: text('storage_key').notNull().unique(),

        // Classification (the type is sniffed from the bytes)
        mimeType: text('mime_type').notNull(),
        mediaKind: text('media_kind').notNull().default('other'),
        // 'ready' | 'quarantined'
        status: text('status').notNull().default('ready'),

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

        // Record<'thumb' | 'card' | 'full', MediaVariantInfo>
        variants: text('variants', { mode: 'json' }).$type<Partial<Record<string, MediaVariantInfo>>>(),
        metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),

        // Timestamps
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    // The quota is one SUM over an organization's (or a user's) rows; an erase walks a user's.
    (table) => [
        index('media_org_idx').on(table.appId, table.organizationId),
        index('media_user_idx').on(table.appId, table.userId),
    ],
);

export type MediaType = typeof mediaTable.$inferSelect;
export type NewMediaType = typeof mediaTable.$inferInsert;
