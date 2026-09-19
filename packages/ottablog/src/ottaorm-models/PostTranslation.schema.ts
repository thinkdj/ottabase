/** Localized content belonging to one canonical post. */
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { tolerantJsonText } from './tolerant-json-column';
import type { EditorJSData, HeroImage, PhotoJournalItem, SeoMeta } from '../types';
import { postsTable } from './Post.schema';

export const postTranslationsTable = sqliteTable(
    'post_translations',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        postId: text('post_id')
            .notNull()
            .references(() => postsTable.id, { onDelete: 'cascade' }),
        language: text('language').notNull(),
        title: text('title').notNull(),
        slug: text('slug').notNull(),
        excerpt: text('excerpt'),
        blurbText: text('blurb_text'),
        photoNote: text('photo_note'),
        photoAlbum: tolerantJsonText<PhotoJournalItem[]>('photo_album'),
        content: tolerantJsonText<EditorJSData>('content'),
        heroImage: tolerantJsonText<HeroImage>('hero_image'),
        seoMeta: tolerantJsonText<SeoMeta>('seo_meta'),
        footnotes: tolerantJsonText<EditorJSData>('footnotes'),
        status: text('status').notNull().default('draft'),
        readingTimeMinutes: integer('reading_time_minutes'),
        wordCount: integer('word_count'),
        publishAt: integer('publish_at'),
        publishedAt: integer('published_at'),
        postedAt: integer('posted_at'),
        appId: text('app_id'),
        organizationId: text('organization_id'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => [
        uniqueIndex('post_translations_post_language_unique_idx').on(table.postId, table.language),
        uniqueIndex('post_translations_scope_slug_unique_idx').on(
            sql`coalesce(${table.organizationId}, '')`,
            sql`coalesce(${table.appId}, '')`,
            table.slug,
        ),
        index('post_translations_post_id_idx').on(table.postId),
        index('post_translations_language_status_idx').on(table.language, table.status),
        index('post_translations_app_status_published_idx').on(table.appId, table.status, table.publishedAt),
        index('post_translations_org_app_status_idx').on(table.organizationId, table.appId, table.status),
    ],
);

export type PostTranslationType = typeof postTranslationsTable.$inferSelect;
export type NewPostTranslationType = typeof postTranslationsTable.$inferInsert;
