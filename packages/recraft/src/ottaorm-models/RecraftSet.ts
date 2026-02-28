// ============================================================
// RecraftSet Model (Fat Model)
// ============================================================

import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import type { StyleConfig } from './RecraftStylePreset';
import { recraftSetsTable } from './RecraftSet.schema';

export { recraftSetsTable, type NewRecraftSetRecord, type RecraftSetRecord } from './RecraftSet.schema';

export type SetSettings = {
    defaultWidth?: number;
    defaultHeight?: number;
    defaultAssetType?: string;
    brandKeywords?: string[];
};

export class RecraftSet extends BaseModel {
    static entity = 'recraft_sets';
    static table = recraftSetsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/recraft';
    static packageType: PackageType = 'package';

    static casts = {
        customStyleJson: 'json' as const,
        settingsJson: 'json' as const,
        generationCount: 'number' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: [
            'name',
            'description',
            'stylePresetId',
            'customStyleJson',
            'settingsJson',
            'userId',
            'appId',
            'coverImageKey',
        ],
        update: ['name', 'description', 'stylePresetId', 'customStyleJson', 'settingsJson', 'coverImageKey'],
    };

    protected static defaults = {
        generationCount: 0,
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: { label: 'Set Name', placeholder: 'My Brand Assets' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
            validation: { rules: 'required|min:2', messages: { required: 'Name is required' } },
        },
        description: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Description', placeholder: 'Assets for my brand launch' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
        },
        stylePresetId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Style Preset' },
            formConfig: {
                visible: true,
                fieldType: 'select',
                relationship: {
                    entity: 'recraft_style_presets',
                    labelField: 'name',
                    valueField: 'id',
                },
            },
            tableConfig: { visible: true, colWidth: 150 },
        },
        generationCount: {
            type: 'number',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Generations' },
            tableConfig: { visible: true, colWidth: 110 },
        },
        userId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Owner' },
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

    // ============================================================
    // RELATIONSHIPS
    // ============================================================

    /** Get the style preset for this set */
    async stylePreset() {
        const presetId = this.get('stylePresetId');
        if (!presetId) return null;
        const { RecraftStylePreset } = await import('./RecraftStylePreset');
        return RecraftStylePreset.find(presetId as string);
    }

    /** Get all generations in this set */
    async generations(options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number }) {
        const { RecraftGeneration } = await import('./RecraftGeneration');
        return RecraftGeneration.where(
            { setId: this.get('id') },
            {
                orderBy: options?.orderBy || 'createdAt',
                orderDirection: options?.orderDirection || 'desc',
                limit: options?.limit,
            },
        );
    }

    // ============================================================
    // QUERY HELPERS
    // ============================================================

    /** Get sets for a specific user */
    static async forUser(userId: string, options?: { orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        return this.where(
            { userId },
            { orderBy: options?.orderBy || 'updatedAt', orderDirection: options?.orderDirection || 'desc' },
        );
    }

    /** Get sets for a specific app */
    static async forApp(appId: string, options?: { orderBy?: string; orderDirection?: 'asc' | 'desc' }) {
        return this.where(
            { appId },
            { orderBy: options?.orderBy || 'updatedAt', orderDirection: options?.orderDirection || 'desc' },
        );
    }

    // ============================================================
    // INSTANCE METHODS
    // ============================================================

    /** Get the resolved style config (preset merged with custom overrides) */
    async getResolvedStyle(): Promise<StyleConfig> {
        const preset = await this.stylePreset();
        const presetConfig: StyleConfig = preset
            ? preset.getStyleConfig()
            : { promptSuffix: '' };

        const customOverrides = this.getCustomStyle();

        return {
            promptSuffix: customOverrides.promptSuffix ?? presetConfig.promptSuffix,
            negativePrompt: customOverrides.negativePrompt ?? presetConfig.negativePrompt,
            guidanceScale: customOverrides.guidanceScale ?? presetConfig.guidanceScale,
            steps: customOverrides.steps ?? presetConfig.steps,
            preferredModel: customOverrides.preferredModel ?? presetConfig.preferredModel,
            modelParams: { ...presetConfig.modelParams, ...customOverrides.modelParams },
        };
    }

    /** Get the custom style overrides */
    getCustomStyle(): Partial<StyleConfig> {
        const raw = this.get('customStyleJson');
        if (!raw) return {};
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }

    /** Get generation settings */
    getSettings(): SetSettings {
        const raw = this.get('settingsJson');
        if (!raw) return {};
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }

    /** Increment generation count */
    async incrementGenerationCount() {
        const current = (this.get('generationCount') as number) || 0;
        this.set('generationCount', current + 1);
        return this.save();
    }
}
