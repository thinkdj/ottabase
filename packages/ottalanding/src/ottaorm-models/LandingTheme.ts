/**
 * LandingTheme Model
 *
 * OttaORM fat model for managing landing page themes.
 * Stores theme registry state, active status, and config overrides.
 * Follows the same pattern as OttablogTheme.
 */
import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { landingThemesTable, type LandingThemeType, type NewLandingThemeType } from './LandingTheme.schema';

export { landingThemesTable, type LandingThemeType, type NewLandingThemeType } from './LandingTheme.schema';

export class LandingTheme extends BaseModel {
    static entity = 'ottalanding_themes';
    static table = landingThemesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottalanding';
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
            uiConfig: { label: 'ID' },
        },
        themeId: {
            type: 'string',
            editable: false,
            searchable: true,
            sortable: true,
            uiConfig: { label: 'Theme ID', description: 'Unique theme identifier' },
            tableConfig: { visible: true, colWidth: 200 },
        },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: { label: 'Name', description: 'Theme name' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
        },
        description: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Description' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: true, colWidth: 300 },
        },
        version: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Version' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 100 },
        },
        author: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Author' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        screenshot: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Screenshot', description: 'Theme preview image URL' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: false },
        },
        isActive: {
            type: 'boolean',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: { label: 'Active', defaultValue: false },
            formConfig: { visible: true, fieldType: 'boolean' },
            tableConfig: { visible: true, colWidth: 100 },
        },
        config: {
            type: 'json',
            editable: true,
            uiConfig: { label: 'Configuration', description: 'Theme config overrides (JSON)' },
            formConfig: { visible: true, fieldType: 'json' },
            tableConfig: { visible: false },
        },
        appId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'App ID' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Updated' },
            tableConfig: { visible: false },
        },
    };

    protected static validationRules = {
        themeId: {
            rules: 'required|min:1|max:100',
            fieldName: 'Theme ID',
            messages: { required: 'Theme ID is required' },
        },
        name: {
            rules: 'required|min:1|max:200',
            fieldName: 'Name',
            messages: { required: 'Theme name is required' },
        },
    };

    // ─── Query helpers ───────────────────────────────────────────────

    /** Find by themeId */
    static async findByThemeId(themeId: string, options?: { appId?: string }): Promise<LandingTheme | null> {
        const query: Record<string, unknown> = { themeId };
        if (options?.appId) query.appId = options.appId;
        const results = await this.where(query);
        return results.length > 0 ? (results[0] as LandingTheme) : null;
    }

    /** Get active theme */
    static async active(options?: { appId?: string }): Promise<LandingTheme | null> {
        const query: Record<string, unknown> = { isActive: true };
        if (options?.appId) query.appId = options.appId;
        const results = await this.where(query);
        return results.length > 0 ? (results[0] as LandingTheme) : null;
    }

    // ─── Instance methods ────────────────────────────────────────────

    /** Activate this theme (deactivates others for the same appId) */
    async activate(options?: { appId?: string }) {
        const appId = options?.appId || this.get('appId');
        const query: Record<string, unknown> = { isActive: true };
        if (appId) query.appId = appId;

        const otherThemes = await LandingTheme.where(query);
        for (const theme of otherThemes) {
            if (theme.get('id') !== this.get('id')) {
                theme.set('isActive', false);
                await theme.save();
            }
        }

        this.set('isActive', true);
        return this.save();
    }

    /** Deactivate */
    async deactivate() {
        this.set('isActive', false);
        return this.save();
    }

    /** Update config overrides */
    async updateConfig(config: Record<string, unknown>) {
        this.set('config', config);
        return this.save();
    }

    /** Merge config (preserves existing keys) */
    async mergeConfig(config: Record<string, unknown>) {
        const current = (this.get('config') as Record<string, unknown>) || {};
        this.set('config', { ...current, ...config });
        return this.save();
    }
}
