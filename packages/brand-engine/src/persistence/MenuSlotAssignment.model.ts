// ---------------------------------------------------------------------------
// Brand Engine – MenuSlotAssignment OttaORM Model
// Maps named layout slots to menus with a specific render type.
// ---------------------------------------------------------------------------

import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { menuSlotAssignmentsTable } from './schema';

export class MenuSlotAssignment extends BaseModel {
    static entity = 'menu_slot_assignments';
    static table = menuSlotAssignmentsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/brand-engine';
    static packageType: PackageType = 'package' as PackageType;

    static displayName = 'Menu Slot';
    static displayNamePlural = 'Menu Slots';
    static defaultSort = 'slotName';
    static defaultSortDirection = 'asc' as const;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: ['appId', 'slotName', 'menuId', 'renderType', 'sortOrder'],
        update: ['slotName', 'menuId', 'renderType', 'sortOrder'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        appId: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'App' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        slotName: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Slot Name' },
            tableConfig: { visible: true },
        },
        menuId: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Menu' },
            tableConfig: { visible: true },
        },
        renderType: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Render Type' },
            tableConfig: { visible: true },
        },
        sortOrder: {
            type: 'number',
            editable: true,
            uiConfig: { label: 'Sort Order' },
            tableConfig: { visible: true },
        },
        createdAt: {
            type: 'date',
            editable: false,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: true },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            uiConfig: { label: 'Updated' },
            tableConfig: { visible: false },
        },
    };
}
