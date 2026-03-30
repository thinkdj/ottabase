// ============================================================
// HomepageAction Model (App-specific fat model)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { homepageActionsTable } from './HomepageAction.schema';

export { homepageActionsTable, type HomepageActionRow, type NewHomepageActionRow } from './HomepageAction.schema';

/**
 * A call-to-action button belonging to a homepage section (hero, cta, about, etc.).
 */
export class HomepageAction extends BaseModel {
    static entity = 'homepage_actions';
    static table = homepageActionsTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        external: 'boolean' as const,
        sortOrder: 'number' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['sectionId', 'label', 'href', 'variant', 'external', 'sortOrder'],
        update: ['sectionId', 'label', 'href', 'variant', 'external', 'sortOrder'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        sectionId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Section', description: 'Parent section ID' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 200 },
            validation: { rules: 'required', messages: { required: 'Section is required' } },
        },
        label: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Label', placeholder: 'Button text' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
            validation: { rules: 'required', messages: { required: 'Label is required' } },
        },
        href: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'URL', placeholder: '/path or https://...' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 200 },
            validation: { rules: 'required', messages: { required: 'URL is required' } },
        },
        variant: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Style variant', description: 'default, secondary, outline, ghost' },
            formConfig: { visible: true, fieldType: 'select' },
            tableConfig: { visible: true, colWidth: 120 },
        },
        external: {
            type: 'boolean',
            editable: true,
            uiConfig: { label: 'External link', description: 'Opens in new tab' },
            formConfig: { visible: true, fieldType: 'checkbox' },
            tableConfig: { visible: true, colWidth: 100 },
        },
        sortOrder: {
            type: 'number',
            editable: true,
            sortable: true,
            uiConfig: { label: 'Sort Order' },
            formConfig: { visible: true, fieldType: 'number' },
            tableConfig: { visible: true, colWidth: 100 },
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
        sectionId: { rules: 'required', fieldName: 'Section', messages: { required: 'Section is required' } },
        label: { rules: 'required', fieldName: 'Label', messages: { required: 'Label is required' } },
        href: { rules: 'required', fieldName: 'URL', messages: { required: 'URL is required' } },
    };
}
