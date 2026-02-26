/**
 * LandingSection table schema — a content section within a page
 */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { landingPagesTable } from './LandingPage.schema';

export const landingSectionsTable = sqliteTable(
    'ottalanding_sections',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        /** Parent page */
        pageId: text('page_id')
            .notNull()
            .references(() => landingPagesTable.id, { onDelete: 'cascade' }),

        /**
         * Section type — determines the content shape.
         * One of: hero, features, pricing, testimonials, faq,
         *         logo-cloud, cta, stats, steps
         */
        sectionType: text('section_type').notNull(),

        /**
         * Section content (JSON).
         * Shape is determined by sectionType — see SectionContentMap.
         */
        content: text('content', { mode: 'json' })
            .notNull()
            .$type<Record<string, unknown>>()
            .default({}),

        /** Display order within the page (lower = first) */
        order: integer('order').notNull().default(0),

        /** Visibility toggle (hide without deleting) */
        visible: integer('visible', { mode: 'boolean' }).notNull().default(true),

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
        index('ottalanding_sections_page_id_idx').on(table.pageId),
        index('ottalanding_sections_page_order_idx').on(table.pageId, table.order),
        index('ottalanding_sections_type_idx').on(table.sectionType),
        index('ottalanding_sections_app_id_idx').on(table.appId),
    ],
);

export type LandingSectionType = typeof landingSectionsTable.$inferSelect;
export type NewLandingSectionType = typeof landingSectionsTable.$inferInsert;
