/**
 * PostTag table schema - blog-specific tags with color and type support
 */
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

        // Tenant scope for org-mode blogs (null = platform-owned). Only filtered when
        // features.ottablog.mode === 'org'; platform mode ignores this column entirely.
        organizationId: text('organization_id'),

        // Content type this tag applies to (post, news, docs, etc.)
        type: text('type').notNull().default('post'),

        // Timestamps
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
    },
    (table) => [
        // Enforce unique tag slugs per app + content type
        // (org mode replaces this with org-aware partial indexes via ottablogOrgModeMigrations)
        uniqueIndex('post_tags_app_id_type_slug_unique_idx').on(table.appId, table.type, table.slug),

        // Multi-tenant with type: appId + type for filtering tags by content type
        index('post_tags_app_id_type_idx').on(table.appId, table.type),

        // Org-mode filtering: organizationId + appId + type
        index('post_tags_org_app_type_idx').on(table.organizationId, table.appId, table.type),

        // Type filtering single index for flexibility
        index('post_tags_type_idx').on(table.type),
    ],
);

export type PostTagType = typeof postTagsTable.$inferSelect;
export type NewPostTagType = typeof postTagsTable.$inferInsert;
