// ---------------------------------------------------------------------------
// Brand Engine – LayoutTemplate OttaORM Model
// ---------------------------------------------------------------------------

import { BaseModel, type PackageType } from '@ottabase/ottaorm';
import { layoutTemplatesTable } from './schema';
import type { LayoutConfig } from '../layout';
import { mergeLayoutConfig } from '../validators';

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
