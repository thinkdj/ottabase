// ============================================================
// HomepageAction model
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { homepageActionsTable, type HomepageActionRow, type NewHomepageActionRow } from './HomepageAction.schema';

export { homepageActionsTable, type HomepageActionRow, type NewHomepageActionRow } from './HomepageAction.schema';

export class HomepageAction extends BaseModel {
    static entity = 'homepage_actions';
    static table = homepageActionsTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        isExternal: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        variant: 'default',
        isExternal: false,
        sortOrder: 0,
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
        label: { type: 'string', editable: true, searchable: true, uiConfig: { label: 'Label' } },
        href: { type: 'string', editable: true, uiConfig: { label: 'URL / path' } },
        variant: { type: 'string', editable: true, uiConfig: { label: 'Variant' } },
        icon: { type: 'string', editable: true, uiConfig: { label: 'Icon slug' } },
        isExternal: { type: 'boolean', editable: true, uiConfig: { label: 'External link' } },
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
