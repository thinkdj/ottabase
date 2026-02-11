// ---------------------------------------------------------------------------
// Brand Engine – LayoutRouteMapping OttaORM Model
// ---------------------------------------------------------------------------

import { BaseModel, type PackageType } from '@ottabase/ottaorm';
import { layoutRouteMappingsTable } from './schema';

export class LayoutRouteMapping extends BaseModel {
    static entity = 'layout_route_mappings';
    static table = layoutRouteMappingsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/brand-engine';
    static packageType: PackageType = 'package' as PackageType;

    static casts = {
        createdAt: 'date' as const,
    };
}
