// Brand Engine persistence: brand kits, layouts and menus. Core to every Ottabase app, so it is
// always in the list; its routes (/api/brand) stay in the router because they predate the
// package contract and serve the browser's first paint.
import {
    BrandKit,
    brandEngineMigrations,
    brandKitsTable,
    LayoutRouteMapping,
    layoutRouteMappingsTable,
    LayoutTemplate,
    layoutTemplatesTable,
    menuItemsTable,
    MenuSlotAssignment,
    menuSlotAssignmentsTable,
    menusTable,
} from '@ottabase/brand-engine/persistence';
import { definePackage } from '@ottabase/kernel';
import type { Migration } from '@ottabase/ottaorm';

export const brandEnginePackage = definePackage<CloudflareEnv>({
    key: 'brand-engine',
    name: 'Brand Engine',
    version: '1.0.0',
    description: 'Design tokens, brand kits, layouts and menus, persisted in D1 and applied at runtime.',
    tables: {
        brandKitsTable,
        layoutTemplatesTable,
        layoutRouteMappingsTable,
        menuSlotAssignmentsTable,
        menusTable,
        menuItemsTable,
    },
    migrations: brandEngineMigrations as Migration[],
    models: [BrandKit, LayoutTemplate, LayoutRouteMapping, MenuSlotAssignment],
});
