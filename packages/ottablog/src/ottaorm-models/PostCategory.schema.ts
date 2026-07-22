/**
 * PostCategory table schema - hierarchical content organization
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const categoriesTable = sqliteTable(
    'categories',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        // Category name
        name: text('name').notNull(),

        // URL-friendly slug
        slug: text('slug').notNull(),

        // Optional description
        description: text('description'),

        // Parent category for hierarchy (null = root category)
        parentId: text('parent_id'),

        // Display order within parent
        sortOrder: integer('sort_order').notNull().default(0),

        // App identifier for multi-app database sharing
        appId: text('app_id').notNull(),

        // Tenant scope for org-mode blogs (null = platform-owned). Only filtered when
        // features.ottablog.mode === 'org'; platform mode ignores this column entirely.
        organizationId: text('organization_id'),

        // Content type this category applies to (post, news, docs, etc.)
        type: text('type').notNull().default('post'),

        // Timestamps
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),

        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => [
        // Enforce unique category slugs per app + content type
        // (org mode replaces this with org-aware partial indexes via ottablogOrgModeMigrations)
        uniqueIndex('categories_app_id_type_slug_unique_idx').on(table.appId, table.type, table.slug),

        // Multi-tenant with type: appId + type for filtering categories by content type
        index('categories_app_id_type_idx').on(table.appId, table.type),

        // Org-mode filtering: organizationId + appId + type
        index('categories_org_app_type_idx').on(table.organizationId, table.appId, table.type),

        // Hierarchy traversal: parentId + sortOrder for getting children ordered
        index('categories_parent_id_sort_order_idx').on(table.parentId, table.sortOrder),

        // Root categories: parentId + appId + type + sortOrder
        index('categories_parent_id_app_id_type_idx').on(table.parentId, table.appId, table.type),

        // Type filtering single index for flexibility
        index('categories_type_idx').on(table.type),
    ],
);

export type Category = typeof categoriesTable.$inferSelect;
export type NewCategory = typeof categoriesTable.$inferInsert;
export type PostCategoryType = typeof categoriesTable.$inferSelect;
export type NewPostCategoryType = typeof categoriesTable.$inferInsert;
