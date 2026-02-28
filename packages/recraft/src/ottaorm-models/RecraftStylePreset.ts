// ============================================================
// RecraftStylePreset Model (Fat Model)
// ============================================================

import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { BUILT_IN_PRESETS } from '../presets';
import { recraftStylePresetsTable } from './RecraftStylePreset.schema';

export { recraftStylePresetsTable, type NewRecraftStylePresetRecord, type RecraftStylePresetRecord } from './RecraftStylePreset.schema';

export type StyleConfig = {
    promptSuffix: string;
    negativePrompt?: string;
    guidanceScale?: number;
    steps?: number;
    preferredModel?: string;
    modelParams?: Record<string, unknown>;
};

export class RecraftStylePreset extends BaseModel {
    static entity = 'recraft_style_presets';
    static table = recraftStylePresetsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/recraft';
    static packageType: PackageType = 'package';

    static casts = {
        styleConfigJson: 'json' as const,
        isBuiltIn: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['name', 'slug', 'description', 'category', 'styleConfigJson', 'thumbnailUrl', 'isBuiltIn', 'appId'],
        update: ['name', 'slug', 'description', 'category', 'styleConfigJson', 'thumbnailUrl'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: { label: 'Name', placeholder: 'Hand-drawn Sketch' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
            validation: { rules: 'required|min:2', messages: { required: 'Name is required' } },
        },
        slug: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Slug', placeholder: 'hand-drawn-sketch' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 160 },
            validation: { rules: 'required|alpha_dash', messages: { required: 'Slug is required' } },
        },
        description: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Description' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
        },
        category: {
            type: 'string',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: { label: 'Category', defaultValue: 'illustration' },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: [
                    { id: 'illustration', name: 'Illustration' },
                    { id: 'logo', name: 'Logo' },
                    { id: 'icon', name: 'Icon' },
                    { id: 'pattern', name: 'Pattern' },
                    { id: 'photo', name: 'Photo-realistic' },
                ],
            },
            tableConfig: { visible: true, colWidth: 130 },
        },
        isBuiltIn: {
            type: 'boolean',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Built-in' },
            tableConfig: { visible: true, colWidth: 90 },
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

    // ============================================================
    // QUERY HELPERS
    // ============================================================

    /** Find a preset by its slug */
    static async findBySlug(slug: string) {
        const results = await this.where({ slug });
        return results.length > 0 ? (results[0] as RecraftStylePreset) : null;
    }

    /** Get all built-in presets */
    static async builtIn() {
        return this.where({ isBuiltIn: true }, { orderBy: 'name', orderDirection: 'asc' });
    }

    /** Get presets for a specific category */
    static async forCategory(category: string) {
        return this.where({ category }, { orderBy: 'name', orderDirection: 'asc' });
    }

    /** Get presets scoped to an app (includes system-level) */
    static async forApp(appId: string) {
        const systemPresets = await this.where({ appId: null });
        const appPresets = await this.where({ appId });
        return [...systemPresets, ...appPresets];
    }

    // ============================================================
    // INSTANCE METHODS
    // ============================================================

    /** Get the parsed style configuration */
    getStyleConfig(): StyleConfig {
        const raw = this.get('styleConfigJson');
        if (!raw) return { promptSuffix: '' };
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }

    // ============================================================
    // SEED
    // ============================================================

    /** Seed all built-in presets (idempotent — skips existing slugs) */
    static async seedBuiltInPresets() {
        const existing = await this.where({ isBuiltIn: true });
        const existingSlugs = new Set(existing.map((p) => p.get('slug')));

        const created: string[] = [];
        for (const preset of BUILT_IN_PRESETS) {
            if (existingSlugs.has(preset.slug)) continue;
            await this.create({
                name: preset.name,
                slug: preset.slug,
                description: preset.description,
                category: preset.category,
                styleConfigJson: JSON.stringify(preset.styleConfig),
                thumbnailUrl: preset.thumbnailUrl ?? null,
                isBuiltIn: true,
                appId: null,
            });
            created.push(preset.slug);
        }
        return created;
    }
}
