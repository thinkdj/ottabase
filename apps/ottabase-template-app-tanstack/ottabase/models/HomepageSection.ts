// ============================================================
// HomepageSection model
// ============================================================

import { homepageFooterContentJsonSchema, homepageNavbarContentJsonSchema } from '@ottabase/homepage-contract';
import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { homepageSectionsTable, type NewHomepageSectionRow, type HomepageSectionRow } from './HomepageSection.schema';

export { homepageSectionsTable, type NewHomepageSectionRow, type HomepageSectionRow } from './HomepageSection.schema';

export type HomepageSlot = 'navbar' | 'hero' | 'features' | 'cta' | 'footer' | 'about';

export class HomepageSection extends BaseModel {
    static entity = 'homepage_sections';
    static table = homepageSectionsTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        isActive: 'boolean' as const,
        contentJson: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static defaults = {
        isActive: true,
        sortOrder: 0,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        slot: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: { label: 'Slot', description: 'navbar | hero | features | cta | footer | about' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 120 },
            validation: { rules: 'required' },
        },
        title: { type: 'string', editable: true, searchable: true, uiConfig: { label: 'Title' } },
        subtitle: { type: 'string', editable: true, uiConfig: { label: 'Subtitle' } },
        description: { type: 'string', editable: true, uiConfig: { label: 'Description' } },
        body: { type: 'string', editable: true, uiConfig: { label: 'Body', description: 'Long HTML/text for about' } },
        contentJson: { type: 'json', editable: true, uiConfig: { label: 'Extra JSON' } },
        isActive: {
            type: 'boolean',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Active' },
            formConfig: { visible: true, fieldType: 'boolean' },
        },
        sortOrder: { type: 'number', editable: true, sortable: true, uiConfig: { label: 'Sort order' } },
        createdAt: { type: 'date', editable: false, uiConfig: { label: 'Created' } },
        updatedAt: { type: 'date', editable: false, uiConfig: { label: 'Updated' } },
    };

    static async getAllActive() {
        return this.where({ isActive: true }, { orderBy: 'sortOrder', orderDirection: 'asc' });
    }

    static async bySlot(slot: HomepageSlot) {
        return this.first({ slot });
    }

    /**
     * Validate navbar/footer `content_json` against the shared contract (throws ZodError if invalid).
     */
    static validateContentJsonForSlot(slot: HomepageSlot, raw: unknown): void {
        if (raw == null) return;
        if (slot === 'navbar') homepageNavbarContentJsonSchema.parse(raw);
        if (slot === 'footer') homepageFooterContentJsonSchema.parse(raw);
    }
}
