/**
 * OttablogTheme Model
 *
 * OttaORM model for managing blog themes.
 * Stores theme registry state, active status, and configuration.
 */
import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { ottablogThemesTable, type NewOttablogThemeType, type OttablogThemeType } from './OttablogTheme.schema';
import type { BlogScope } from '../types';

export { ottablogThemesTable, type NewOttablogThemeType, type OttablogThemeType } from './OttablogTheme.schema';

export class OttablogTheme extends BaseModel {
    static entity = 'ottablog_themes';
    static table = ottablogThemesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    static casts = {
        isActive: 'boolean' as const,
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

    // ============================================================
    // QUERY HELPERS
    // ============================================================

    /** A theme row of one blog. */
    static async findByThemeId(themeId: string, scope: BlogScope): Promise<OttablogTheme | null> {
        return (await this.first({ themeId, ...scope })) as OttablogTheme | null;
    }

    /** The blog's active theme. */
    static async active(scope: BlogScope): Promise<OttablogTheme | null> {
        return (await this.first({ isActive: true, ...scope })) as OttablogTheme | null;
    }

    // ==================== Instance Methods ====================

    /** Activate the theme, deactivating the rest of its own blog's themes. */
    async activate() {
        const others = await OttablogTheme.where({
            isActive: true,
            appId: this.get('appId'),
            organizationId: this.get('organizationId') ?? null,
        });
        for (const theme of others) {
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
