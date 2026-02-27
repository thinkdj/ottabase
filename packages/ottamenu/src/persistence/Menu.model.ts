// ---------------------------------------------------------------------------
// Menu Manager – Menu OttaORM Model
// ---------------------------------------------------------------------------

import { BaseModel, type ModelFields } from '@ottabase/ottaorm';
import { menusTable } from './schema';

export class Menu extends BaseModel {
    static entity = 'menus';
    static table = menusTable;
    static primaryKey = 'id';

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
