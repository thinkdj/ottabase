/**
 * OttablogPlugin Model
 *
 * OttaORM model for managing blog plugins.
 * Stores plugin registry state, enabled status, and configuration.
 */
import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Ottablog plugins table - plugin registry and state
 */
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

        // Timestamps
        createdAt: integer('created_at', { mode: 'timestamp' })
            .notNull()
            .default(sql`(unixepoch())`),

        updatedAt: integer('updated_at', { mode: 'timestamp' })
            .notNull()
            .default(sql`(unixepoch())`)
            .$onUpdate(() => new Date()),
    },
    (table) => [
        // Unique plugin per appId
        uniqueIndex('ottablog_plugins_app_id_plugin_id_unique_idx').on(table.appId, table.pluginId),

        // Enabled plugins query
        index('ottablog_plugins_enabled_idx').on(table.enabled),

        // Multi-tenant filtering
        index('ottablog_plugins_app_id_enabled_idx').on(table.appId, table.enabled),

        // Plugin lookup
        index('ottablog_plugins_plugin_id_idx').on(table.pluginId),
    ],
);

export type OttablogPluginType = typeof ottablogPluginsTable.$inferSelect;
export type NewOttablogPluginType = typeof ottablogPluginsTable.$inferInsert;

export class OttablogPlugin extends BaseModel {
    static entity = 'ottablog_plugins';
    static table = ottablogPluginsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    static casts = {
        enabled: 'boolean' as const,
        config: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        enabled: false,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'ID',
            },
        },
        pluginId: {
            type: 'string',
            editable: false,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Plugin ID',
                description: 'Unique plugin identifier',
            },
            tableConfig: {
                visible: true,
                colWidth: 200,
            },
        },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Name',
                description: 'Plugin name',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 'auto',
            },
        },
        description: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Description',
                description: 'Plugin description',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: true,
                colWidth: 300,
            },
        },
        version: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Version',
                description: 'Plugin version',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 100,
            },
        },
        author: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Author',
                description: 'Plugin author',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        url: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'URL',
                description: 'Plugin URL',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: false,
            },
        },
        enabled: {
            type: 'boolean',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: {
                label: 'Enabled',
                description: 'Plugin enabled status',
                defaultValue: false,
            },
            formConfig: {
                visible: true,
                fieldType: 'boolean',
            },
            tableConfig: {
                visible: true,
                colWidth: 100,
            },
        },
        config: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Configuration',
                description: 'Plugin configuration (JSON)',
            },
            formConfig: {
                visible: true,
                fieldType: 'json',
            },
            tableConfig: {
                visible: false,
            },
        },
        appId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: {
                label: 'App ID',
                description: 'Auto-set when scopeByAppId is enabled',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: false,
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Created',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Updated',
            },
            tableConfig: {
                visible: false,
            },
        },
    };

    protected static validationRules = {
        pluginId: {
            rules: 'required|min:1|max:100',
            fieldName: 'Plugin ID',
            messages: {
                required: 'Plugin ID is required',
            },
        },
        name: {
            rules: 'required|min:1|max:200',
            fieldName: 'Name',
            messages: {
                required: 'Plugin name is required',
            },
        },
    };

    // ============================================================
    // QUERY HELPERS
    // ============================================================

    /**
     * Find plugin by pluginId
     */
    static async findByPluginId(pluginId: string, options?: { appId?: string }): Promise<OttablogPlugin | null> {
        const query: Record<string, unknown> = { pluginId };
        if (options?.appId) query.appId = options.appId;

        const results = await this.where(query);
        return results.length > 0 ? (results[0] as OttablogPlugin) : null;
    }

    /**
     * Get all enabled plugins
     */
    static async enabled(options?: { appId?: string }) {
        const query: Record<string, unknown> = { enabled: true };
        if (options?.appId) query.appId = options.appId;

        return this.where(query, {
            orderBy: 'name',
            orderDirection: 'asc',
        });
    }

    /**
     * Get all disabled plugins
     */
    static async disabled(options?: { appId?: string }) {
        const query: Record<string, unknown> = { enabled: false };
        if (options?.appId) query.appId = options.appId;

        return this.where(query, {
            orderBy: 'name',
            orderDirection: 'asc',
        });
    }

    // ==================== Instance Methods ====================

    /**
     * Enable the plugin
     */
    async enable() {
        this.set('enabled', true);
        return this.save();
    }

    /**
     * Disable the plugin
     */
    async disable() {
        this.set('enabled', false);
        return this.save();
    }

    /**
     * Update plugin configuration
     */
    async updateConfig(config: Record<string, unknown>) {
        this.set('config', config);
        return this.save();
    }

    /**
     * Merge configuration (preserves existing keys)
     */
    async mergeConfig(config: Record<string, unknown>) {
        const currentConfig = (this.get('config') as Record<string, unknown>) || {};
        this.set('config', { ...currentConfig, ...config });
        return this.save();
    }
}
