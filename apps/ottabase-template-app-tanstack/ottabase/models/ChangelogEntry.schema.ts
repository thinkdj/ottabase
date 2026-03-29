// ============================================================
// Changelog entry table (App-specific)
// ============================================================

import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** OttaEditor / EditorJS output stored as JSON */
export type ChangelogEditorContent = {
    time?: number;
    blocks: Array<{
        id?: string;
        type: string;
        data: Record<string, unknown>;
    }>;
    version?: string;
};

export type ChangelogHeroMedia =
    | {
          kind: 'image';
          url: string;
          alt?: string;
          caption?: string;
          cfImageId?: string;
          width?: number;
          height?: number;
      }
    | {
          kind: 'video';
          url: string;
          mimeType?: string;
          caption?: string;
      };

export const changelogEntriesTable = sqliteTable(
    'changelog_entries',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        title: text('title').notNull(),
        slug: text('slug').notNull(),
        summary: text('summary'),
        content: text('content', { mode: 'json' }).$type<ChangelogEditorContent>(),
        heroMedia: text('hero_media', { mode: 'json' }).$type<ChangelogHeroMedia | null>(),
        status: text('status').notNull().default('draft'),
        authorId: text('author_id'),
        authorName: text('author_name'),
        authorAvatar: text('author_avatar'),
        highlight: integer('highlight', { mode: 'boolean' }).default(false),
        autoplayMedia: integer('autoplay_media', { mode: 'boolean' }).default(true),
        showAuthor: integer('show_author', { mode: 'boolean' }).default(true),
        readingTimeMinutes: integer('reading_time_minutes'),
        wordCount: integer('word_count'),
        publishedAt: integer('published_at'),
        appId: text('app_id'),
        organizationId: text('organization_id'),
        userId: text('user_id'),
        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (table) => [
        uniqueIndex('changelog_entries_app_slug_idx')
            .on(table.appId, table.slug)
            .where(sql`${table.organizationId} IS NULL`),
        uniqueIndex('changelog_entries_org_app_slug_idx').on(table.organizationId, table.appId, table.slug),
        uniqueIndex('changelog_entries_slug_no_app_idx')
            .on(table.slug)
            .where(sql`${table.appId} IS NULL AND ${table.organizationId} IS NULL`),
        index('changelog_entries_status_published_at_idx').on(table.status, table.publishedAt),
        index('changelog_entries_app_status_published_at_idx').on(table.appId, table.status, table.publishedAt),
    ],
);

export type ChangelogEntryRow = typeof changelogEntriesTable.$inferSelect;
export type NewChangelogEntryRow = typeof changelogEntriesTable.$inferInsert;
