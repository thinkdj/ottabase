/**
 * LandingTheme table schema — persists theme registry state
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const landingThemesTable = sqliteTable(
    'ottalanding_themes',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        /** Theme identifier (matches registry theme.metadata.id) */
        themeId: text('theme_id').notNull(),

        /** Theme metadata (from registry) */
        name: text('name').notNull(),
        description: text('description'),
        version: text('version'),
        author: text('author'),
        screenshot: text('screenshot'),

        /** Active status (only one theme active per appId) */
        isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),

        /** Theme configuration overrides (JSON) */
        config: text('config', { mode: 'json' }).$type<Record<string, unknown>>(),

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
        uniqueIndex('ottalanding_themes_app_theme_unique_idx').on(table.appId, table.themeId),
        index('ottalanding_themes_is_active_idx').on(table.isActive),
        index('ottalanding_themes_app_active_idx').on(table.appId, table.isActive),
        index('ottalanding_themes_theme_id_idx').on(table.themeId),
    ],
);

export type LandingThemeType = typeof landingThemesTable.$inferSelect;
export type NewLandingThemeType = typeof landingThemesTable.$inferInsert;
