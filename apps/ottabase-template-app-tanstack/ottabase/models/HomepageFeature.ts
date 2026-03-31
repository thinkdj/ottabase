// ============================================================
// HomepageFeature model
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { homepageFeaturesTable, type HomepageFeatureRow, type NewHomepageFeatureRow } from './HomepageFeature.schema';

export { homepageFeaturesTable, type HomepageFeatureRow, type NewHomepageFeatureRow } from './HomepageFeature.schema';

export class HomepageFeature extends BaseModel {
    static entity = 'homepage_features';
    static table = homepageFeaturesTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        sectionId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Section ID' },
            validation: { rules: 'required' },
        },
        title: { type: 'string', editable: true, searchable: true, uiConfig: { label: 'Title' } },
        description: { type: 'string', editable: true, uiConfig: { label: 'Description' } },
        icon: { type: 'string', editable: true, uiConfig: { label: 'Icon slug' } },
        sortOrder: { type: 'number', editable: true, sortable: true, uiConfig: { label: 'Sort order' } },
        createdAt: { type: 'date', editable: false, uiConfig: { label: 'Created' } },
        updatedAt: { type: 'date', editable: false, uiConfig: { label: 'Updated' } },
    };

    static async forSection(sectionId: string) {
        return this.where({ sectionId }, { orderBy: 'sortOrder', orderDirection: 'asc' });
    }

    async section() {
        const { HomepageSection } = await import('./HomepageSection');
        return this.belongsTo(HomepageSection, 'sectionId');
    }
}
