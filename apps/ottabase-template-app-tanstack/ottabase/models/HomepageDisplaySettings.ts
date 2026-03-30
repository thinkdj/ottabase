// ============================================================
// HomepageDisplaySettings Model (App-specific fat model)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { homepageDisplaySettingsTable } from './HomepageDisplaySettings.schema';

export {
    homepageDisplaySettingsTable,
    type HomepageDisplaySettingsRow,
    type NewHomepageDisplaySettingsRow,
} from './HomepageDisplaySettings.schema';

/**
 * Single-row settings model for the homepage display state.
 * Stores variant selections per slot, the active theme preset,
 * custom CSS, and SEO metadata.
 */
export class HomepageDisplaySettings extends BaseModel {
    static entity = 'homepage_display_settings';
    static table = homepageDisplaySettingsTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        variantBySlotJson: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['id', 'variantBySlotJson', 'themePreset', 'fallbackThemePresetId', 'customCss', 'seoTitle', 'seoDescription', 'appId'],
        update: ['variantBySlotJson', 'themePreset', 'fallbackThemePresetId', 'customCss', 'seoTitle', 'seoDescription', 'appId'],
    };

    protected static defaults = {
        themePreset: 'default',
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        variantBySlotJson: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Variant selections',
                description: 'JSON mapping slot names to variant IDs',
            },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        themePreset: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Theme preset', description: 'Active theme preset name' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 150 },
        },
        fallbackThemePresetId: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Fallback theme', description: 'Theme preset for SSR fallback' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: false },
        },
        customCss: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Custom CSS', description: 'Injected into the homepage <style> tag' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        seoTitle: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'SEO Title', description: 'Page title for search engines' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: false },
        },
        seoDescription: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'SEO Description', description: 'Meta description for search engines' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        appId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: { label: 'App ID' },
            tableConfig: { visible: false },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: false },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Updated' },
            tableConfig: { visible: false },
        },
    };

    /**
     * Get or create the default settings row.
     */
    static async getOrCreateDefault(appId?: string | null): Promise<HomepageDisplaySettings> {
        const where: Record<string, unknown> = { id: 'default' };
        if (appId) where.appId = appId;

        const existing = await this.first(where);
        if (existing) return existing as HomepageDisplaySettings;

        return (await this.create({ id: 'default', appId: appId ?? undefined })) as HomepageDisplaySettings;
    }
}
