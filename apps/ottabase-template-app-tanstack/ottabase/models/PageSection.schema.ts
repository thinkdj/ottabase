/**
 * PageSection Schema
 *
 * Sections are the building blocks of block-type pages.
 * Examples: hero, features, cta, footer, navbar, testimonials, pricing, etc.
 *
 * Each section has a slot type (determines rendering) and belongs to a page.
 */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { pagesTable } from './Page.schema';

// Built-in slot types (extensible via metadata)
export type SlotType =
    | 'navbar'
    | 'hero'
    | 'features'
    | 'cta'
    | 'footer'
    | 'about'
    | 'pricing'
    | 'testimonials'
    | 'faq'
    | 'contact'
    | 'custom';

export const pageSectionsTable = sqliteTable(
    'page_sections',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        // Reference to parent page
        pageId: text('page_id')
            .notNull()
            .references(() => pagesTable.id, { onDelete: 'cascade' }),

        // Slot type determines the component used to render
        slot: text('slot').$type<SlotType>().notNull(),

        // Content fields
        title: text('title'),
        subtitle: text('subtitle'),
        body: text('body'), // Markdown content

        // Visual customization
        icon: text('icon'), // Lucide icon name
        imageUrl: text('image_url'), // Background or hero image
        videoUrl: text('video_url'), // Background video

        // Navigation-specific (for navbar/footer)
        githubUrl: text('github_url'),
        logoUrl: text('logo_url'),

        // Variant for this section (e.g., "centered", "split", "grid")
        variant: text('variant'),

        // Layout/styling
        cssClasses: text('css_classes'),
        backgroundColor: text('background_color'),

        // Enabled/disabled toggle
        enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),

        // Sort order within page
        sortOrder: integer('sort_order').notNull().default(0),

        // Extensible metadata
        metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>(),

        // Timestamps
        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (table) => [
        index('page_sections_page_idx').on(table.pageId),
        index('page_sections_slot_idx').on(table.slot),
        index('page_sections_order_idx').on(table.pageId, table.sortOrder),
    ],
);

export type PageSectionRow = typeof pageSectionsTable.$inferSelect;
export type NewPageSectionRow = typeof pageSectionsTable.$inferInsert;
