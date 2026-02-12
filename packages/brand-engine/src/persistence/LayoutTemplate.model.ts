// ---------------------------------------------------------------------------
// Brand Engine – LayoutTemplate OttaORM Model
// ---------------------------------------------------------------------------

import { BaseModel, type PackageType } from '@ottabase/ottaorm';
import { layoutTemplatesTable } from './schema';
import type { LayoutConfig } from '../layout';
import { isValidLayoutConfig } from '../validators';
import { DEFAULT_LAYOUT } from '../layout';

export class LayoutTemplate extends BaseModel {
    static entity = 'layout_templates';
    static table = layoutTemplatesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/brand-engine';
    static packageType: PackageType = 'package' as PackageType;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    /** Parse configJson to LayoutConfig with validation */
    getConfig(): LayoutConfig {
        const raw = this.get('configJson');
        if (!raw || typeof raw !== 'string') {
            return DEFAULT_LAYOUT;
        }
        try {
            const parsed = JSON.parse(raw);
            if (isValidLayoutConfig(parsed)) {
                return parsed;
            }
            console.warn(`Invalid layout config for template ${this.get('id')}, using defaults`);
            return DEFAULT_LAYOUT;
        } catch (error) {
            console.warn(`Failed to parse layout config for template ${this.get('id')}, using defaults`);
            return DEFAULT_LAYOUT;
        }
    }
}
