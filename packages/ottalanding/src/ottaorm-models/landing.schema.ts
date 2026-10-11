// ============================================================
// Landing site tables — app-global, platform-owned content (scoped by appId, like brand data)
// ============================================================

import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
        /** The page's own social image (JSON), or null to use the site's. */
        share: text('share'),
        /** Secret for the draft's shareable preview link (`?preview=`); null until one is made. */
        previewToken: text('preview_token'),
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

/** What visitors send through contact and signup sections. Read in otta-web's inbox. */
export const landingLeadsTable = sqliteTable(
    'landing_leads',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        appId: text('app_id').notNull(),
        kind: text('kind').notNull(),
        email: text('email').notNull(),
        name: text('name').notNull().default(''),
        message: text('message').notNull().default(''),
        pagePath: text('page_path').notNull().default('/'),
        /** SHA-256 of app + IP, for rate limiting without keeping the address. */
        ipHash: text('ip_hash'),
        readAt: integer('read_at'),
        notifiedAt: integer('notified_at'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
    },
    (table) => [
        index('landing_leads_app_created_idx').on(table.appId, table.createdAt),
        index('landing_leads_app_ip_idx').on(table.appId, table.ipHash, table.createdAt),
        index('landing_leads_app_notified_idx').on(table.appId, table.notifiedAt),
    ],
);

export type LandingSiteRecord = typeof landingSitesTable.$inferSelect;
export type LandingPageRecord = typeof landingPagesTable.$inferSelect;
export type LandingLeadRecord = typeof landingLeadsTable.$inferSelect;
