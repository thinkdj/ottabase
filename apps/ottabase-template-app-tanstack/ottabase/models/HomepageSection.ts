// ============================================================
// HomepageSection Model (App-specific fat model)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { homepageSectionsTable } from './HomepageSection.schema';

export { homepageSectionsTable, type HomepageSectionRow, type NewHomepageSectionRow } from './HomepageSection.schema';

/**
 * A homepage section maps to a SlotRenderer slot (navbar, hero, features, cta, footer, about).
 * Contains the title/subtitle/body for that slot plus display options (icon, enabled, cssClasses, metadata).
 * Features and actions are stored in child tables (HomepageFeature, HomepageAction).
 */
export class HomepageSection extends BaseModel {
    static entity = 'homepage_sections';
    static table = homepageSectionsTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        enabled: 'boolean' as const,
        metadata: 'json' as const,
        sortOrder: 'number' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: [
            'slot',
            'title',
            'subtitle',
            'body',
            'githubUrl',
            'icon',
            'enabled',
            'cssClasses',
            'metadata',
            'sortOrder',
            'appId',
        ],
        update: [
            'slot',
            'title',
            'subtitle',
            'body',
            'githubUrl',
            'icon',
            'enabled',
            'cssClasses',
            'metadata',
            'sortOrder',
            'appId',
        ],
    };

    protected static defaults = {
        enabled: true,
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        slot: {
            type: 'string',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: { label: 'Slot', description: 'Homepage slot name (hero, features, cta, etc.)' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 120 },
            validation: { rules: 'required', messages: { required: 'Slot is required' } },
        },
        title: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Title', placeholder: 'Section heading' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
        },
        subtitle: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Subtitle' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 200 },
        },
        body: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Body text' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        githubUrl: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'GitHub URL' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: false },
        },
        icon: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Icon', description: 'Lucide icon name (e.g. Sparkles, Shield, Zap)' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: false },
        },
        enabled: {
            type: 'boolean',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Enabled', description: 'Show this section on the homepage' },
            formConfig: { visible: true, fieldType: 'checkbox' },
            tableConfig: { visible: true, colWidth: 80 },
        },
        cssClasses: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'CSS Classes', description: 'Custom Tailwind CSS classes' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: false },
        },
        metadata: {
            type: 'json',
            editable: true,
            uiConfig: { label: 'Metadata', description: 'Arbitrary JSON key-value data' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        sortOrder: {
            type: 'number',
            editable: true,
            sortable: true,
            uiConfig: { label: 'Sort Order' },
            formConfig: { visible: true, fieldType: 'number' },
            tableConfig: { visible: true, colWidth: 100 },
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

    protected static validationRules = {
        slot: { rules: 'required', fieldName: 'Slot', messages: { required: 'Slot is required' } },
    };
}
