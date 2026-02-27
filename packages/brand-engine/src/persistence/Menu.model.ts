// ---------------------------------------------------------------------------
// Brand Engine – Menu OttaORM Model
// Menus container (e.g. sidebar, header, footer). Slug identifies usage.
// ---------------------------------------------------------------------------

import { BaseModel, type ModelFields } from '@ottabase/ottaorm';
import { menusTable } from './schema';

export class Menu extends BaseModel {
    static entity = 'menus';
    static table = menusTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/brand-engine';
    static packageType = 'package' as const;
    static displayName = 'Menu';
    static displayNamePlural = 'Menus';

    static casts = {
        isDefault: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['appId', 'name', 'slug', 'type', 'isDefault'],
        update: ['name', 'slug', 'type', 'isDefault'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false },
        appId: { type: 'string', editable: false },
        name: { type: 'string', editable: true },
        slug: { type: 'string', editable: true },
        type: { type: 'string', editable: true },
        isDefault: { type: 'boolean', editable: true },
        createdAt: { type: 'number', editable: false },
        updatedAt: { type: 'number', editable: false },
    };
}
