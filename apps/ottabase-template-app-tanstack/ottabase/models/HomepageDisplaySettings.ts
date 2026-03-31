// ============================================================
// HomepageDisplaySettings (single row: default)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import {
    homepageDisplaySettingsTable,
    type HomepageDisplaySettingsRow,
    type HomepageVariantBySlotJson,
    type NewHomepageDisplaySettingsRow,
} from './HomepageDisplaySettings.schema';

export {
    homepageDisplaySettingsTable,
    type HomepageDisplaySettingsRow,
    type HomepageVariantBySlotJson,
    type NewHomepageDisplaySettingsRow,
} from './HomepageDisplaySettings.schema';

export class HomepageDisplaySettings extends BaseModel {
    static entity = 'homepage_display_settings';
    static table = homepageDisplaySettingsTable;
    static primaryKey = 'id';
    static packageName = 'app';
    static packageType: PackageType = 'app';

    static casts = {
        variantBySlotJson: 'json' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        variantBySlotJson: { type: 'json', editable: true, uiConfig: { label: 'Variants by slot' } },
        themePresetId: { type: 'string', editable: true, uiConfig: { label: 'Theme preset' } },
        createdAt: { type: 'date', editable: false, uiConfig: { label: 'Created' } },
        updatedAt: { type: 'date', editable: false, uiConfig: { label: 'Updated' } },
    };

    static async getDefault() {
        return this.first({ id: 'default' });
    }
}
