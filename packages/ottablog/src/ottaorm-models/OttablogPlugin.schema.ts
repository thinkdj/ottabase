/**
 * OttablogPlugin table schema - plugin registry and state
 */
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { tolerantJsonText } from './tolerant-json-column';

export const ottablogPluginsTable = sqliteTable(
    'ottablog_plugins',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        // Plugin identifier (matches registry plugin.metadata.id)
        pluginId: text('plugin_id').notNull(),

        // Plugin metadata (from registry)
        name: text('name').notNull(),
        description: text('description'),
        version: text('version'),
        author: text('author'),
        url: text('url'),

        // Enabled/active status
        enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),

        // Plugin configuration (flexible JSON meta)
        config: tolerantJsonText<Record<string, unknown>>('config'),

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
        // Unique plugin rows per blog. SQLite treats NULLs as distinct in a unique index, so the site
        // blog (null org) needs its own partial index.
        uniqueIndex('ottablog_plugins_org_app_plugin_unique_idx')
            .on(table.organizationId, table.appId, table.pluginId)
            .where(sql`${table.organizationId} IS NOT NULL`),
        uniqueIndex('ottablog_plugins_app_plugin_unique_no_org_idx')
            .on(table.appId, table.pluginId)
            .where(sql`${table.organizationId} IS NULL`),

        // Enabled plugins query
        index('ottablog_plugins_enabled_idx').on(table.enabled),

        // Multi-tenant filtering
        index('ottablog_plugins_app_id_enabled_idx').on(table.appId, table.enabled),

        // Blog filtering: organizationId + appId + enabled
        index('ottablog_plugins_org_app_enabled_idx').on(table.organizationId, table.appId, table.enabled),

        // Plugin lookup
        index('ottablog_plugins_plugin_id_idx').on(table.pluginId),
    ],
);

export type OttablogPluginType = typeof ottablogPluginsTable.$inferSelect;
export type NewOttablogPluginType = typeof ottablogPluginsTable.$inferInsert;
