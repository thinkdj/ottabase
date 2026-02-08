/**
 * OttablogTheme table schema - theme registry and state
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const ottablogThemesTable = sqliteTable(
    'ottablog_themes',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        // Theme identifier (matches registry theme.metadata.id)
        themeId: text('theme_id').notNull(),

        // Theme metadata (from registry)
        name: text('name').notNull(),
        description: text('description'),
        version: text('version'),
        author: text('author'),
        url: text('url'),
        screenshot: text('screenshot'),

        // Active status (only one theme can be active per appId)
        isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),

        // Theme configuration (flexible JSON meta)
        config: text('config', { mode: 'json' }).$type<Record<string, unknown>>(),

        // App identifier for multi-app database sharing
        appId: text('app_id'),

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
        // Unique theme per appId
        uniqueIndex('ottablog_themes_app_id_theme_id_unique_idx').on(table.appId, table.themeId),

        // Active theme query (only one should be active per appId)
        index('ottablog_themes_is_active_idx').on(table.isActive),

        // Multi-tenant filtering
        index('ottablog_themes_app_id_is_active_idx').on(table.appId, table.isActive),

        // Theme lookup
        index('ottablog_themes_theme_id_idx').on(table.themeId),
    ],
);

export type OttablogThemeType = typeof ottablogThemesTable.$inferSelect;
export type NewOttablogThemeType = typeof ottablogThemesTable.$inferInsert;
