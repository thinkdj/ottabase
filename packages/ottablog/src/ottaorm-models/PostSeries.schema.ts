/**
 * PostSeries table schema - group related posts into a series
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const seriesTable = sqliteTable(
    'series',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        // Series title
        title: text('title').notNull(),

        // URL-friendly slug
        slug: text('slug').notNull(),

        // Series description
        description: text('description'),

        // Cover image for the series
        coverImage: text('cover_image', { mode: 'json' }).$type<{
            url: string;
            alt?: string;
        }>(),

        // Whether the series is complete or ongoing
        isComplete: integer('is_complete', { mode: 'boolean' }).notNull().default(false),

        // Display order in series listings
        sortOrder: integer('sort_order').notNull().default(0),

        // App identifier for multi-app database sharing
        appId: text('app_id').notNull(),

        // Tenant scope for org-mode blogs (null = platform-owned). Only filtered when
        // features.ottablog.mode === 'org'; platform mode ignores this column entirely.
        organizationId: text('organization_id'),

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
        // Enforce unique series slugs per app
        // (org mode replaces this with org-aware partial indexes via ottablogOrgModeMigrations)
        uniqueIndex('series_app_id_slug_unique_idx').on(table.appId, table.slug),

        // List series by app ordered: appId + isComplete + sortOrder
        index('series_app_id_complete_order_idx').on(table.appId, table.isComplete, table.sortOrder),

        // Org-mode filtering: organizationId + appId
        index('series_org_app_idx').on(table.organizationId, table.appId),

        // Find complete/incomplete series: isComplete + sortOrder
        index('series_is_complete_sort_order_idx').on(table.isComplete, table.sortOrder),

        // App ID single index for other filtering
        index('series_app_id_idx').on(table.appId),
    ],
);

export type Series = typeof seriesTable.$inferSelect;
export type NewSeries = typeof seriesTable.$inferInsert;
export type PostSeriesType = typeof seriesTable.$inferSelect;
export type NewPostSeriesType = typeof seriesTable.$inferInsert;
