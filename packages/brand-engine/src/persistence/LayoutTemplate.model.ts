// ---------------------------------------------------------------------------
// Brand Engine – LayoutTemplate OttaORM Model
// ---------------------------------------------------------------------------

import { BaseModel, type PackageType } from '@ottabase/ottaorm';
import { layoutTemplatesTable } from './schema';
import type { LayoutConfig } from '../layout';

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

    /** Parse configJson to LayoutConfig */
    getConfig(): LayoutConfig {
        const raw = this.get('configJson');
        if (!raw || typeof raw !== 'string') {
            return {
                header: 'topbar',
                navigation: 'sidebar',
                contentWidth: 'fluid',
                footer: true,
                density: 'comfy',
            };
        }
        try {
            return JSON.parse(raw) as LayoutConfig;
        } catch {
            return {
                header: 'topbar',
                navigation: 'sidebar',
                contentWidth: 'fluid',
                footer: true,
                density: 'comfy',
            };
        }
    }
}
