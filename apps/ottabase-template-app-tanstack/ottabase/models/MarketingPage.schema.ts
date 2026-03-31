import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const pagesTable = sqliteTable(
    'pages',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        appId: text('app_id').notNull(),
        organizationId: text('organization_id'),
        userId: text('user_id'),
        slug: text('slug').notNull(),
        title: text('title').notNull(),
        status: text('status').notNull().default('draft'),
        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (table) => [uniqueIndex('pages_app_slug_idx').on(table.appId, table.slug)],
);

export const pageSectionsTable = sqliteTable('page_sections', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    pageId: text('page_id').notNull(),
    appId: text('app_id').notNull(),
    organizationId: text('organization_id'),
    userId: text('user_id'),
    slot: text('slot').notNull(),
    variant: text('variant').notNull(),
    title: text('title'),
    subtitle: text('subtitle'),
    body: text('body'),
    enabled: integer('enabled', { mode: 'boolean' }).default(true).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export const pageFeaturesTable = sqliteTable('page_features', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    sectionId: text('section_id').notNull(),
    appId: text('app_id').notNull(),
    organizationId: text('organization_id'),
    userId: text('user_id'),
    title: text('title').notNull(),
    description: text('description'),
    icon: text('icon'),
    link: text('link'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
});

export const pageActionsTable = sqliteTable('page_actions', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    sectionId: text('section_id').notNull(),
    appId: text('app_id').notNull(),
    organizationId: text('organization_id'),
    userId: text('user_id'),
    label: text('label').notNull(),
    href: text('href').notNull(),
    variant: text('variant').notNull().default('primary'),
    icon: text('icon'),
    external: integer('external', { mode: 'boolean' }).default(false).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
});

export type MarketingPageRow = typeof pagesTable.$inferSelect;
export type MarketingPageSectionRow = typeof pageSectionsTable.$inferSelect;
export type MarketingPageFeatureRow = typeof pageFeaturesTable.$inferSelect;
export type MarketingPageActionRow = typeof pageActionsTable.$inferSelect;
