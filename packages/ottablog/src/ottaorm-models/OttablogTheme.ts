/**
 * OttablogTheme Model
 *
 * OttaORM model for managing blog themes.
 * Stores theme registry state, active status, and configuration.
 */
import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { ottablogThemesTable, type NewOttablogThemeType, type OttablogThemeType } from './OttablogTheme.schema';

export { ottablogThemesTable, type NewOttablogThemeType, type OttablogThemeType } from './OttablogTheme.schema';

export class OttablogTheme extends BaseModel {
    static entity = 'ottablog_themes';
    static table = ottablogThemesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    static casts = {
        isActive: 'boolean' as const,
        config: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        isActive: false,
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
        themeId: {
            type: 'string',
            editable: false,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Theme ID',
                description: 'Unique theme identifier',
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
                description: 'Theme name',
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
                description: 'Theme description',
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
                description: 'Theme version',
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
                description: 'Theme author',
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
                description: 'Theme URL',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: false,
            },
        },
        screenshot: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Screenshot',
                description: 'Theme screenshot URL',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: false,
            },
        },
        isActive: {
            type: 'boolean',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: {
                label: 'Active',
                description: 'Theme active status',
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
                description: 'Theme configuration (JSON)',
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
        themeId: {
            rules: 'required|min:1|max:100',
            fieldName: 'Theme ID',
            messages: {
                required: 'Theme ID is required',
            },
        },
        name: {
            rules: 'required|min:1|max:200',
            fieldName: 'Name',
            messages: {
                required: 'Theme name is required',
            },
        },
    };

    // ============================================================
    // QUERY HELPERS
    // ============================================================

    /**
     * Find theme by themeId
     */
    static async findByThemeId(
        themeId: string,
        options?: { appId?: string; organizationId?: string | null },
    ): Promise<OttablogTheme | null> {
        const query: Record<string, unknown> = { themeId };
        if (options?.appId) query.appId = options.appId;
        // Org-mode scoping: null filters platform-owned rows (IS NULL); undefined = no filter.
        if (options?.organizationId !== undefined) query.organizationId = options.organizationId;

        const results = await this.where(query);
        return results.length > 0 ? (results[0] as OttablogTheme) : null;
    }

    /**
     * Get active theme
     */
    static async active(options?: { appId?: string; organizationId?: string | null }): Promise<OttablogTheme | null> {
        const query: Record<string, unknown> = { isActive: true };
        if (options?.appId) query.appId = options.appId;
        if (options?.organizationId !== undefined) query.organizationId = options.organizationId;

        const results = await this.where(query);
        return results.length > 0 ? (results[0] as OttablogTheme) : null;
    }

    /**
     * Get all inactive themes
     */
    static async inactive(options?: { appId?: string; organizationId?: string | null }) {
        const query: Record<string, unknown> = { isActive: false };
        if (options?.appId) query.appId = options.appId;
        if (options?.organizationId !== undefined) query.organizationId = options.organizationId;

        return this.where(query, {
            orderBy: 'name',
            orderDirection: 'asc',
        });
    }

    // ==================== Instance Methods ====================

    /**
     * Activate the theme (deactivates others in the same scope).
     * Scope is (appId) in platform mode; pass organizationId (id or null) to
     * scope deactivation to a single tenant's blog in org mode.
     */
    async activate(options?: { appId?: string; organizationId?: string | null }) {
        const appId = options?.appId || this.get('appId');
        const orgScoped = options?.organizationId !== undefined;

        // Deactivate all other themes within the activation scope
        const scopeQuery: Record<string, unknown> = { isActive: true };
        if (appId) scopeQuery.appId = appId;
        if (orgScoped) scopeQuery.organizationId = options?.organizationId;

        const otherThemes = await OttablogTheme.where(scopeQuery);
        for (const theme of otherThemes) {
            if (theme.get('id') !== this.get('id')) {
                theme.set('isActive', false);
                await theme.save();
            }
        }

        this.set('isActive', true);
        return this.save();
    }

    /**
     * Deactivate the theme
     */
    async deactivate() {
        this.set('isActive', false);
        return this.save();
    }

    /**
     * Update theme configuration
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
