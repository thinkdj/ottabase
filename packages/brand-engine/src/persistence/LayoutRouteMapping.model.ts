// ---------------------------------------------------------------------------
// Brand Engine – LayoutRouteMapping OttaORM Model
// ---------------------------------------------------------------------------

import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { layoutRouteMappingsTable } from './schema';

export class LayoutRouteMapping extends BaseModel {
    static entity = 'layout_route_mappings';
    static table = layoutRouteMappingsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/brand-engine';
    static packageType: PackageType = 'package' as PackageType;

    // UI/Forms metadata
    static displayName = 'Route Mapping';
    static displayNamePlural = 'Route Mappings';
    static defaultSort = 'priority';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        createdAt: 'date' as const,
    };

    static writable = {
        create: [
            'organizationId',
            'appId',
            'pathPattern',
            'priority',
            'layoutTemplateId',
            'brandKitId',
            'tokenOverridesJson',
        ],
        update: ['pathPattern', 'priority', 'layoutTemplateId', 'brandKitId', 'tokenOverridesJson'],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        organizationId: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Organization' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        appId: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'App' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        pathPattern: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Path Pattern' },
            tableConfig: { visible: true },
        },
        priority: {
            type: 'number',
            editable: true,
            uiConfig: { label: 'Priority' },
            tableConfig: { visible: true },
        },
        layoutTemplateId: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Layout Template' },
            tableConfig: { visible: true },
        },
        brandKitId: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Brand Kit' },
            tableConfig: { visible: true },
        },
        tokenOverridesJson: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Token Overrides' },
            tableConfig: { visible: false },
        },
        createdAt: {
            type: 'date',
            editable: false,
            uiConfig: { label: 'Created' },
            tableConfig: { visible: true },
        },
    };
}
