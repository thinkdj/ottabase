/**
 * PageAction Schema
 *
 * Actions are CTA buttons within a section (e.g., "Get Started", "Learn More").
 */
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { pageSectionsTable } from './PageSection.schema';

// Button variants
export type ActionVariant = 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';

export const pageActionsTable = sqliteTable('page_actions', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    // Reference to parent section
    sectionId: text('section_id')
        .notNull()
        .references(() => pageSectionsTable.id, { onDelete: 'cascade' }),

    // Button content
    label: text('label').notNull(),
    href: text('href').notNull(),

    // Styling
    variant: text('variant').$type<ActionVariant>().default('default'),
    icon: text('icon'), // Lucide icon name

    // Behavior
    external: integer('external', { mode: 'boolean' }).default(false),

    // Sort order
    sortOrder: integer('sort_order').notNull().default(0),

    // Timestamps
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type PageActionRow = typeof pageActionsTable.$inferSelect;
export type NewPageActionRow = typeof pageActionsTable.$inferInsert;
