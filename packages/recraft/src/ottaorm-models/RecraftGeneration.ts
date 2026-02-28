// ============================================================
// RecraftGeneration Model (Fat Model)
// ============================================================

import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { ASSET_TYPES } from '../types';
import { recraftGenerationsTable } from './RecraftGeneration.schema';

export { recraftGenerationsTable, type NewRecraftGenerationRecord, type RecraftGenerationRecord } from './RecraftGeneration.schema';

export class RecraftGeneration extends BaseModel {
    static entity = 'recraft_generations';
    static table = recraftGenerationsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/recraft';
    static packageType: PackageType = 'package';

    static casts = {
        styleSnapshotJson: 'json' as const,
        metadataJson: 'json' as const,
        isFavorite: 'boolean' as const,
        createdAt: 'date' as const,
    };

    static writable = {
        create: [
            'setId',
            'prompt',
            'negativePrompt',
            'assetType',
            'styleSnapshotJson',
            'imageKey',
            'thumbnailKey',
            'metadataJson',
            'status',
            'errorMessage',
            'isFavorite',
            'userId',
            'appId',
        ],
        update: ['isFavorite', 'imageKey', 'thumbnailKey', 'metadataJson', 'status', 'errorMessage'],
    };

    protected static defaults = {
        status: 'pending',
        isFavorite: false,
        assetType: 'logo',
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        setId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Set' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        prompt: {
            type: 'string',
            editable: false,
            searchable: true,
            uiConfig: { label: 'Prompt' },
            tableConfig: { visible: true, colWidth: 'auto' },
        },
        assetType: {
            type: 'string',
            editable: false,
            filterable: true,
            sortable: true,
            uiConfig: { label: 'Asset Type' },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: Object.entries(ASSET_TYPES).map(([id, name]) => ({ id, name })),
            },
            tableConfig: { visible: true, colWidth: 120 },
        },
        status: {
            type: 'string',
            editable: false,
            filterable: true,
            sortable: true,
            uiConfig: { label: 'Status' },
            tableConfig: { visible: true, colWidth: 100 },
        },
        isFavorite: {
            type: 'boolean',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Favorite' },
            tableConfig: { visible: true, colWidth: 90 },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: true, colWidth: 150 },
        },
    };

    // ============================================================
    // RELATIONSHIPS
    // ============================================================

    /** Get the parent set */
    async set() {
        const { RecraftSet } = await import('./RecraftSet');
        return this.belongsTo(RecraftSet, 'setId');
    }

    // ============================================================
    // QUERY HELPERS
    // ============================================================

    /** Get all generations for a set */
    static async forSet(
        setId: string,
        options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number },
    ) {
        return this.where(
            { setId },
            {
                orderBy: options?.orderBy || 'createdAt',
                orderDirection: options?.orderDirection || 'desc',
                limit: options?.limit,
            },
        );
    }

    /** Get favorites for a set */
    static async favoritesForSet(setId: string) {
        return this.where({ setId, isFavorite: true }, { orderBy: 'createdAt', orderDirection: 'desc' });
    }

    /** Get completed generations for a set */
    static async completedForSet(setId: string) {
        return this.where({ setId, status: 'completed' }, { orderBy: 'createdAt', orderDirection: 'desc' });
    }

    /** Get generations by asset type for a set */
    static async forSetByType(setId: string, assetType: string) {
        return this.where({ setId, assetType }, { orderBy: 'createdAt', orderDirection: 'desc' });
    }

    // ============================================================
    // INSTANCE METHODS
    // ============================================================

    /** Toggle favorite status */
    async toggleFavorite() {
        this.set('isFavorite', !this.get('isFavorite'));
        return this.save();
    }

    /** Mark as completed with image data */
    async markCompleted(imageKey: string, metadata: Record<string, unknown>) {
        this.set('status', 'completed');
        this.set('imageKey', imageKey);
        this.set('metadataJson', metadata);
        return this.save();
    }

    /** Mark as failed */
    async markFailed(errorMessage: string) {
        this.set('status', 'failed');
        this.set('errorMessage', errorMessage);
        return this.save();
    }

    /** Check if generation is complete */
    isCompleted(): boolean {
        return this.get('status') === 'completed';
    }

    /** Check if generation failed */
    isFailed(): boolean {
        return this.get('status') === 'failed';
    }

    /** Get parsed metadata */
    getMetadata(): Record<string, unknown> {
        const raw = this.get('metadataJson');
        if (!raw) return {};
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
}
