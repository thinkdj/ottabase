// ============================================================
// FeatureFlag Model (Fat Model)
// ============================================================

import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { featureFlagsTable, type FlagRules } from './schema';

export { featureFlagsTable } from './schema';
export type { FeatureFlagRecord, NewFeatureFlagRecord, FlagRules } from './schema';

export class FeatureFlag extends BaseModel {
    static entity = 'feature_flags';
    static table = featureFlagsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/flags';
    static packageType: PackageType = 'package';

    static casts = {
        enabled: 'boolean' as const,
        rules: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        enabled: false,
        rules: {} as FlagRules,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        key: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Flag Key',
                description: 'Unique identifier used in code (e.g. "billing.invoices")',
                placeholder: 'feature.name',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 200 },
            validation: {
                rules: 'required|alpha_dash|min:2|max:100',
                messages: {
                    required: 'Flag key is required',
                    alpha_dash: 'Only letters, numbers, dashes, underscores, and dots allowed',
                },
            },
        },
        name: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Name',
                description: 'Human-readable flag name',
                placeholder: 'Invoice Generation',
            },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 200 },
            validation: { rules: 'required|min:2|max:100' },
        },
        description: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Description',
                description: 'What this flag controls',
            },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        enabled: {
            type: 'boolean',
            editable: true,
            sortable: true,
            uiConfig: { label: 'Enabled' },
            formConfig: { visible: true, fieldType: 'boolean' },
            tableConfig: { visible: true, colWidth: 100 },
        },
        rules: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Targeting Rules',
                description: 'JSON targeting rules for plans, orgs, users, percentage',
            },
            formConfig: { visible: true, fieldType: 'textarea' },
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
            tableConfig: { visible: true, colWidth: 150 },
        },
    };

    // ============================================================
    // QUERY HELPERS
    // ============================================================

    static async findByKey(key: string): Promise<FeatureFlag | null> {
        const results = await this.where({ key });
        return results.length > 0 ? (results[0] as FeatureFlag) : null;
    }

    static async allEnabled(): Promise<FeatureFlag[]> {
        return (await this.where({ enabled: true })) as FeatureFlag[];
    }

    // ============================================================
    // INSTANCE HELPERS
    // ============================================================

    getRules(): FlagRules {
        const rules = this.get('rules');
        if (!rules || typeof rules !== 'object') return {};
        return rules as FlagRules;
    }

    toggle(): void {
        this.set('enabled', !this.get('enabled'));
    }
}
