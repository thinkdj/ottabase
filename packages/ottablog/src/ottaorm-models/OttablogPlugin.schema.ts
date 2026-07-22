/**
 * OttablogPlugin table schema - plugin registry and state
 */
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
        config: text('config', { mode: 'json' }).$type<Record<string, unknown>>(),

        // App identifier for multi-app database sharing
        appId: text('app_id'),

        // Tenant scope for org-mode blogs (null = platform-owned). Only filtered when
        // features.ottablog.mode === 'org'; platform mode ignores this column entirely.
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
        // Unique plugin per appId
        // (org mode replaces this with org-aware partial indexes via ottablogOrgModeMigrations)
        uniqueIndex('ottablog_plugins_app_id_plugin_id_unique_idx').on(table.appId, table.pluginId),

        // Enabled plugins query
        index('ottablog_plugins_enabled_idx').on(table.enabled),

        // Multi-tenant filtering
        index('ottablog_plugins_app_id_enabled_idx').on(table.appId, table.enabled),

        // Org-mode filtering: organizationId + appId + enabled
        index('ottablog_plugins_org_app_enabled_idx').on(table.organizationId, table.appId, table.enabled),

        // Plugin lookup
        index('ottablog_plugins_plugin_id_idx').on(table.pluginId),
    ],
);

export type OttablogPluginType = typeof ottablogPluginsTable.$inferSelect;
export type NewOttablogPluginType = typeof ottablogPluginsTable.$inferInsert;
