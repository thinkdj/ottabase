// ============================================================
// HomepageFeature Model (App-specific fat model)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { homepageFeaturesTable } from './HomepageFeature.schema';

export { homepageFeaturesTable, type HomepageFeatureRow, type NewHomepageFeatureRow } from './HomepageFeature.schema';

/**
 * A feature item belonging to a homepage section (typically the "features" slot).
 */
export class HomepageFeature extends BaseModel {
    static entity = 'homepage_features';
    static table = homepageFeaturesTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        sortOrder: 'number' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['sectionId', 'title', 'description', 'sortOrder'],
        update: ['sectionId', 'title', 'description', 'sortOrder'],
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
        title: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Title', placeholder: 'Feature name' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 'auto' },
            validation: { rules: 'required', messages: { required: 'Title is required' } },
        },
        description: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Description' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: true, colWidth: 'auto' },
            validation: { rules: 'required', messages: { required: 'Description is required' } },
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
        title: { rules: 'required', fieldName: 'Title', messages: { required: 'Title is required' } },
        description: {
            rules: 'required',
            fieldName: 'Description',
            messages: { required: 'Description is required' },
        },
    };
}
