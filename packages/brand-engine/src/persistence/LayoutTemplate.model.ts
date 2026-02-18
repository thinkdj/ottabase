// ---------------------------------------------------------------------------
// Brand Engine – LayoutTemplate OttaORM Model (v2: per-app scoping)
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '@ottabase/ottalayout';
import { mergeLayoutConfig } from '@ottabase/ottalayout';
import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { layoutTemplatesTable } from './schema';

export class LayoutTemplate extends BaseModel {
    static entity = 'layout_templates';
    static table = layoutTemplatesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/brand-engine';
    static packageType: PackageType = 'package' as PackageType;

    // UI/Forms metadata
    static displayName = 'Layout Template';
    static displayNamePlural = 'Layout Templates';
    static defaultSort = 'name';
    static defaultSortDirection = 'asc' as const;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['appId', 'name', 'componentKey', 'configJson', 'description'],
        update: ['name', 'componentKey', 'configJson', 'description'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        appId: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'App' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Name' },
            tableConfig: { visible: true },
        },
        componentKey: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Component Key' },
            tableConfig: { visible: true },
        },
        description: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Description' },
            tableConfig: { visible: true },
        },
        createdAt: {
            type: 'date',
            editable: false,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: true },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            uiConfig: { label: 'Updated' },
            tableConfig: { visible: false },
        },
    };

    /** Parse configJson to LayoutConfig, merging partial values with defaults */
    getConfig(): LayoutConfig {
        const raw = this.get('configJson');
        if (!raw || typeof raw !== 'string') {
            return mergeLayoutConfig(null);
        }
        try {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            return mergeLayoutConfig(parsed);
        } catch {
            return mergeLayoutConfig(null);
        }
    }
}
