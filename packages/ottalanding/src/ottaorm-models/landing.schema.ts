// ============================================================
// Landing site tables — app-global, platform-owned content (scoped by appId, like brand data)
// ============================================================

import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** One row per app: name, theme, navigation and footer (validated JSON). */
export const landingSitesTable = sqliteTable('landing_sites', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    appId: text('app_id').notNull().unique(),
    settings: text('settings').notNull(),
    createdAt: integer('created_at')
        .notNull()
        .$defaultFn(() => Date.now()),
    updatedAt: integer('updated_at')
        .notNull()
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now()),
});

/** One row per page: its path, metadata and ordered sections (validated JSON). */
export const landingPagesTable = sqliteTable(
    'landing_pages',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        appId: text('app_id').notNull(),
        path: text('path').notNull(),
        title: text('title').notNull(),
        description: text('description').notNull().default(''),
        published: integer('published', { mode: 'boolean' }).notNull().default(false),
        sections: text('sections').notNull().default('[]'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => [uniqueIndex('landing_pages_app_path_idx').on(table.appId, table.path)],
);

export type LandingSiteRecord = typeof landingSitesTable.$inferSelect;
export type LandingPageRecord = typeof landingPagesTable.$inferSelect;
