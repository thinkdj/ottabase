/**
 * OttablogTheme table schema - theme registry and state
 */
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { tolerantJsonText } from './tolerant-json-column';

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
        config: tolerantJsonText<Record<string, unknown>>('config'),

        // Sparse brand-token overrides for the blog "room": CSS custom properties
        // applied under [data-brand-scope="blog"], split by palette. Null renders
        // pixel-identical to the unthemed baseline (fallback-chain law).
        tokens: tolerantJsonText<{
            light?: Record<string, string>;
            dark?: Record<string, string>;
        }>('tokens'),

        // App identifier for multi-app database sharing
        appId: text('app_id'),

        // The blog this belongs to: an organization's blog, or null for the site blog.
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
        // Unique theme rows per blog. SQLite treats NULLs as distinct in a unique index, so the site
        // blog (null org) needs its own partial index.
        uniqueIndex('ottablog_themes_org_app_theme_unique_idx')
            .on(table.organizationId, table.appId, table.themeId)
            .where(sql`${table.organizationId} IS NOT NULL`),
        uniqueIndex('ottablog_themes_app_theme_unique_no_org_idx')
            .on(table.appId, table.themeId)
            .where(sql`${table.organizationId} IS NULL`),

        // Active theme query (only one should be active per appId)
        index('ottablog_themes_is_active_idx').on(table.isActive),

        // Multi-tenant filtering
        index('ottablog_themes_app_id_is_active_idx').on(table.appId, table.isActive),

        // Blog filtering: organizationId + appId + isActive
        index('ottablog_themes_org_app_active_idx').on(table.organizationId, table.appId, table.isActive),

        // Theme lookup
        index('ottablog_themes_theme_id_idx').on(table.themeId),
    ],
);

export type OttablogThemeType = typeof ottablogThemesTable.$inferSelect;
export type NewOttablogThemeType = typeof ottablogThemesTable.$inferInsert;
