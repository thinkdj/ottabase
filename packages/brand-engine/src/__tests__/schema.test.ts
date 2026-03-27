// ---------------------------------------------------------------------------
// Brand Engine – Schema & Model structure tests
// Validates table definitions, model metadata, and multitenancy fields
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { BrandKit } from '../persistence/BrandKit.model';
import { LayoutRouteMapping } from '../persistence/LayoutRouteMapping.model';
import { LayoutTemplate } from '../persistence/LayoutTemplate.model';
import { Menu } from '../persistence/Menu.model';
import { MenuItem } from '../persistence/MenuItem.model';
import { MenuSlotAssignment } from '../persistence/MenuSlotAssignment.model';
import {
    brandKitsTable,
    layoutRouteMappingsTable,
    layoutTemplatesTable,
    menuItemsTable,
    menuSlotAssignmentsTable,
    menusTable,
} from '../persistence/schema';

// ===========================================================================
// Schema table definitions
// ===========================================================================

describe('Schema tables', () => {
    it('brandKitsTable has appId column for per-app scoping', () => {
        const columns = Object.keys(brandKitsTable);
        expect(columns).toContain('appId');
    });

    it('brandKitsTable has audit trail columns', () => {
        const columns = Object.keys(brandKitsTable);
        expect(columns).toContain('createdBy');
        expect(columns).toContain('updatedBy');
        expect(columns).toContain('createdAt');
        expect(columns).toContain('updatedAt');
    });

    it('layoutTemplatesTable has appId for per-app scoping', () => {
        const columns = Object.keys(layoutTemplatesTable);
        expect(columns).toContain('appId');
    });

    it('layoutTemplatesTable has audit trail columns', () => {
        const columns = Object.keys(layoutTemplatesTable);
        expect(columns).toContain('createdBy');
        expect(columns).toContain('updatedBy');
    });

    it('layoutRouteMappingsTable has appId for per-app scoping', () => {
        const columns = Object.keys(layoutRouteMappingsTable);
        expect(columns).toContain('appId');
    });

    it('layoutRouteMappingsTable has createdBy for audit trail', () => {
        const columns = Object.keys(layoutRouteMappingsTable);
        expect(columns).toContain('createdBy');
    });

    it('menuSlotAssignmentsTable has required columns', () => {
        const columns = Object.keys(menuSlotAssignmentsTable);
        expect(columns).toContain('appId');
        expect(columns).toContain('slotName');
        expect(columns).toContain('menuId');
        expect(columns).toContain('renderType');
        expect(columns).toContain('sortOrder');
        expect(columns).toContain('createdAt');
        expect(columns).toContain('updatedAt');
    });

    it('menuSlotAssignmentsTable has audit trail column', () => {
        const columns = Object.keys(menuSlotAssignmentsTable);
        expect(columns).toContain('createdBy');
    });
});

// ===========================================================================
// Model metadata (OttaORM conventions)
// ===========================================================================

describe('Model metadata', () => {
    it('BrandKit has required static properties', () => {
        expect(BrandKit.entity).toBe('brand_kits');
        expect(BrandKit.primaryKey).toBe('id');
        expect(BrandKit.packageName).toBe('@ottabase/brand-engine');
        expect(BrandKit.displayName).toBe('Brand Kit');
        expect(BrandKit.displayNamePlural).toBe('Brand Kits');
        expect(BrandKit.defaultSort).toBe('updatedAt');
        expect(BrandKit.writable).toBeDefined();
        expect(BrandKit.writable.create).toContain('appId');
        expect(BrandKit.writable.update).not.toContain('appId');
    });

    it('LayoutTemplate has required static properties', () => {
        expect(LayoutTemplate.entity).toBe('layout_templates');
        expect(LayoutTemplate.primaryKey).toBe('id');
        expect(LayoutTemplate.packageName).toBe('@ottabase/brand-engine');
        expect(LayoutTemplate.displayName).toBe('Layout Template');
        expect(LayoutTemplate.writable).toBeDefined();
        expect(LayoutTemplate.writable.create).toContain('appId');
    });

    it('LayoutRouteMapping has required static properties', () => {
        expect(LayoutRouteMapping.entity).toBe('layout_route_mappings');
        expect(LayoutRouteMapping.primaryKey).toBe('id');
        expect(LayoutRouteMapping.packageName).toBe('@ottabase/brand-engine');
        expect(LayoutRouteMapping.displayName).toBe('Route Mapping');
        expect(LayoutRouteMapping.writable).toBeDefined();
        expect(LayoutRouteMapping.writable.create).toContain('appId');
    });

    it('all models have packageType set to package', () => {
        expect(BrandKit.packageType).toBe('package');
        expect(LayoutTemplate.packageType).toBe('package');
        expect(LayoutRouteMapping.packageType).toBe('package');
        expect(MenuSlotAssignment.packageType).toBe('package');
    });

    it('all models have casts for date fields', () => {
        expect(BrandKit.casts.createdAt).toBe('date');
        expect(BrandKit.casts.updatedAt).toBe('date');
        expect(LayoutTemplate.casts.createdAt).toBe('date');
        expect(LayoutTemplate.casts.updatedAt).toBe('date');
        expect(LayoutRouteMapping.casts.createdAt).toBe('date');
        expect(MenuSlotAssignment.casts.createdAt).toBe('date');
        expect(MenuSlotAssignment.casts.updatedAt).toBe('date');
    });

    it('MenuSlotAssignment has required static properties', () => {
        expect(MenuSlotAssignment.entity).toBe('menu_slot_assignments');
        expect(MenuSlotAssignment.primaryKey).toBe('id');
        expect(MenuSlotAssignment.packageName).toBe('@ottabase/brand-engine');
        expect(MenuSlotAssignment.displayName).toBe('Menu Slot');
        expect(MenuSlotAssignment.displayNamePlural).toBe('Menu Slots');
        expect(MenuSlotAssignment.writable).toBeDefined();
        expect(MenuSlotAssignment.writable.create).toContain('appId');
        expect(MenuSlotAssignment.writable.create).toContain('slotName');
        expect(MenuSlotAssignment.writable.create).toContain('menuId');
        expect(MenuSlotAssignment.writable.create).toContain('renderType');
        expect(MenuSlotAssignment.writable.update).toContain('slotName');
        expect(MenuSlotAssignment.writable.update).toContain('menuId');
        expect(MenuSlotAssignment.writable.update).toContain('renderType');
        expect(MenuSlotAssignment.writable.update).not.toContain('appId');
    });
});

// ===========================================================================
// Menu & MenuItem models (moved from ottamenu to brand-engine)
// ===========================================================================

describe('Menu model metadata', () => {
    it('Menu has required static properties', () => {
        expect(Menu.entity).toBe('menus');
        expect(Menu.primaryKey).toBe('id');
        expect(Menu.packageName).toBe('@ottabase/brand-engine');
        expect(Menu.displayName).toBe('Menu');
        expect(Menu.displayNamePlural).toBe('Menus');
        expect(Menu.packageType).toBe('package');
    });

    it('Menu has writable fields', () => {
        expect(Menu.writable).toBeDefined();
        expect(Menu.writable.create).toContain('appId');
        expect(Menu.writable.create).toContain('name');
        expect(Menu.writable.create).toContain('slug');
        expect(Menu.writable.create).toContain('type');
    });

    it('Menu has date casts', () => {
        expect(Menu.casts.createdAt).toBe('date');
        expect(Menu.casts.updatedAt).toBe('date');
    });

    it('menusTable has appId column for per-app scoping', () => {
        const columns = Object.keys(menusTable);
        expect(columns).toContain('appId');
        expect(columns).toContain('name');
        expect(columns).toContain('slug');
        expect(columns).toContain('type');
    });
});

describe('MenuItem model metadata', () => {
    it('MenuItem has required static properties', () => {
        expect(MenuItem.entity).toBe('menu_items');
        expect(MenuItem.primaryKey).toBe('id');
        expect(MenuItem.packageName).toBe('@ottabase/brand-engine');
        expect(MenuItem.displayName).toBe('Menu Item');
        expect(MenuItem.displayNamePlural).toBe('Menu Items');
        expect(MenuItem.packageType).toBe('package');
    });

    it('MenuItem has writable fields', () => {
        expect(MenuItem.writable).toBeDefined();
        expect(MenuItem.writable.create).toContain('menuId');
        expect(MenuItem.writable.create).toContain('name');
        expect(MenuItem.writable.create).toContain('link');
        expect(MenuItem.writable.create).toContain('parentId');
    });

    it('MenuItem has date casts and boolean casts', () => {
        expect(MenuItem.casts.createdAt).toBe('date');
        expect(MenuItem.casts.updatedAt).toBe('date');
        expect(MenuItem.casts.newTab).toBe('boolean');
        expect(MenuItem.casts.authRequired).toBe('boolean');
    });

    it('menuItemsTable has required columns', () => {
        const columns = Object.keys(menuItemsTable);
        expect(columns).toContain('menuId');
        expect(columns).toContain('appId');
        expect(columns).toContain('parentId');
        expect(columns).toContain('name');
        expect(columns).toContain('link');
        expect(columns).toContain('newTab');
        expect(columns).toContain('authRequired');
        expect(columns).toContain('sortOrder');
    });
});
