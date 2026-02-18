/**
 * LandingPage table schema — a page within a landing site
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { landingSitesTable } from './LandingSite.schema';

export const landingPagesTable = sqliteTable(
    'landing_pages',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        /** Parent site */
        siteId: text('site_id')
            .notNull()
            .references(() => landingSitesTable.id, { onDelete: 'cascade' }),

        /** URL slug (e.g. "home", "about", "contact") */
        slug: text('slug').notNull(),

        /** Page title (for <title> and <h1>) */
        title: text('title').notNull(),

        /** Meta description for SEO */
        metaDescription: text('meta_description'),

        /** OG image URL */
        ogImage: text('og_image'),

        /** Display order in site nav (lower = first) */
        order: integer('order').notNull().default(0),

        /** Published / draft flag */
        isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(true),

        /** Multi-app scoping */
        appId: text('app_id'),

        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),

        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => [
        // Unique slug per site
        uniqueIndex('landing_pages_site_slug_unique_idx').on(table.siteId, table.slug),
        index('landing_pages_site_id_idx').on(table.siteId),
        index('landing_pages_site_order_idx').on(table.siteId, table.order),
        index('landing_pages_app_id_idx').on(table.appId),
    ],
);

export type LandingPageType = typeof landingPagesTable.$inferSelect;
export type NewLandingPageType = typeof landingPagesTable.$inferInsert;
