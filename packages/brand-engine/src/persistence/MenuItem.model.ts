// ---------------------------------------------------------------------------
// Brand Engine – MenuItem OttaORM Model
// Individual links/entries within a Menu. Supports nesting via parentId.
// ---------------------------------------------------------------------------

import { BaseModel, type ModelFields } from '@ottabase/ottaorm';
import { menuItemsTable } from './schema';

export class MenuItem extends BaseModel {
    static entity = 'menu_items';
    static table = menuItemsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/brand-engine';
    static packageType = 'package' as const;
    static displayName = 'Menu Item';
    static displayNamePlural = 'Menu Items';

    static casts = {
        newTab: 'boolean' as const,
        authRequired: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: [
            'menuId',
            'appId',
            'parentId',
            'name',
            'link',
            'newTab',
            'authRequired',
            'description',
            'image',
            'tooltip',
            'sortOrder',
        ],
        update: ['parentId', 'name', 'link', 'newTab', 'authRequired', 'description', 'image', 'tooltip', 'sortOrder'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false },
        menuId: { type: 'string', editable: true },
        appId: { type: 'string', editable: false },
        parentId: { type: 'string', editable: true },
        name: { type: 'string', editable: true },
        link: { type: 'string', editable: true },
        newTab: { type: 'boolean', editable: true },
        authRequired: { type: 'boolean', editable: true },
        description: { type: 'string', editable: true },
        image: { type: 'string', editable: true },
        tooltip: { type: 'string', editable: true },
        sortOrder: { type: 'number', editable: true },
        createdAt: { type: 'number', editable: false },
        updatedAt: { type: 'number', editable: false },
    };
}
