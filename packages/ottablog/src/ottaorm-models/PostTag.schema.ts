/**
 * PostTag table schema - blog-specific tags with color and type support
 */
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const postTagsTable = sqliteTable(
    'post_tags',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        // Tag name
        name: text('name').notNull(),

        // URL-friendly slug
        slug: text('slug').notNull(),

        // Optional color for UI display (hex)
        color: text('color'),

        // App identifier for multi-app database sharing
        appId: text('app_id').notNull(),

        // The blog this belongs to: an organization's blog, or null for the site blog.
        organizationId: text('organization_id'),

        // Content type this tag applies to (post, news, docs, etc.)
        type: text('type').notNull().default('post'),

        // Timestamps
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
    },
    (table) => [
        // Unique tag slugs per content type per blog. SQLite treats NULLs as distinct in a unique index, so the site
        // blog (null org) needs its own partial index.
        uniqueIndex('post_tags_org_app_type_slug_unique_idx')
            .on(table.organizationId, table.appId, table.type, table.slug)
            .where(sql`${table.organizationId} IS NOT NULL`),
        uniqueIndex('post_tags_app_type_slug_unique_no_org_idx')
            .on(table.appId, table.type, table.slug)
            .where(sql`${table.organizationId} IS NULL`),

        // Multi-tenant with type: appId + type for filtering tags by content type
        index('post_tags_app_id_type_idx').on(table.appId, table.type),

        // Blog filtering: organizationId + appId + type
        index('post_tags_org_app_type_idx').on(table.organizationId, table.appId, table.type),

        // Type filtering single index for flexibility
        index('post_tags_type_idx').on(table.type),
    ],
);

export type PostTagType = typeof postTagsTable.$inferSelect;
export type NewPostTagType = typeof postTagsTable.$inferInsert;
