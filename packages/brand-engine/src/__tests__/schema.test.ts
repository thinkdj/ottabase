// ---------------------------------------------------------------------------
// Brand Engine – Schema & Model structure tests
// Validates table definitions, model metadata, and multitenancy fields
// ---------------------------------------------------------------------------

import { describe, expect, it } from 'vitest';
import { BrandKit } from '../persistence/BrandKit.model';
import { LayoutRouteMapping } from '../persistence/LayoutRouteMapping.model';
import { LayoutTemplate } from '../persistence/LayoutTemplate.model';
import { brandKitsTable, layoutRouteMappingsTable, layoutTemplatesTable } from '../persistence/schema';

// ===========================================================================
// Schema table definitions
// ===========================================================================

describe('Schema tables', () => {
    it('brandKitsTable has organizationId column for multitenancy', () => {
        const columns = Object.keys(brandKitsTable);
        expect(columns).toContain('organizationId');
    });

    it('brandKitsTable has audit trail columns', () => {
        const columns = Object.keys(brandKitsTable);
        expect(columns).toContain('createdBy');
        expect(columns).toContain('updatedBy');
        expect(columns).toContain('createdAt');
        expect(columns).toContain('updatedAt');
    });

    it('layoutTemplatesTable has organizationId and appId for multitenancy', () => {
        const columns = Object.keys(layoutTemplatesTable);
        expect(columns).toContain('organizationId');
        expect(columns).toContain('appId');
    });

    it('layoutTemplatesTable has audit trail columns', () => {
        const columns = Object.keys(layoutTemplatesTable);
        expect(columns).toContain('createdBy');
        expect(columns).toContain('updatedBy');
    });

    it('layoutRouteMappingsTable has organizationId and appId for multitenancy', () => {
        const columns = Object.keys(layoutRouteMappingsTable);
        expect(columns).toContain('organizationId');
        expect(columns).toContain('appId');
    });

    it('layoutRouteMappingsTable has createdBy for audit trail', () => {
        const columns = Object.keys(layoutRouteMappingsTable);
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
        expect(BrandKit.writable.create).toContain('organizationId');
        expect(BrandKit.writable.update).not.toContain('organizationId');
    });

    it('LayoutTemplate has required static properties', () => {
        expect(LayoutTemplate.entity).toBe('layout_templates');
        expect(LayoutTemplate.primaryKey).toBe('id');
        expect(LayoutTemplate.packageName).toBe('@ottabase/brand-engine');
        expect(LayoutTemplate.displayName).toBe('Layout Template');
        expect(LayoutTemplate.writable).toBeDefined();
        expect(LayoutTemplate.writable.create).toContain('organizationId');
        expect(LayoutTemplate.writable.create).toContain('appId');
    });

    it('LayoutRouteMapping has required static properties', () => {
        expect(LayoutRouteMapping.entity).toBe('layout_route_mappings');
        expect(LayoutRouteMapping.primaryKey).toBe('id');
        expect(LayoutRouteMapping.packageName).toBe('@ottabase/brand-engine');
        expect(LayoutRouteMapping.displayName).toBe('Route Mapping');
        expect(LayoutRouteMapping.writable).toBeDefined();
        expect(LayoutRouteMapping.writable.create).toContain('organizationId');
    });

    it('all models have packageType set to package', () => {
        expect(BrandKit.packageType).toBe('package');
        expect(LayoutTemplate.packageType).toBe('package');
        expect(LayoutRouteMapping.packageType).toBe('package');
    });

    it('all models have casts for date fields', () => {
        expect(BrandKit.casts.createdAt).toBe('date');
        expect(BrandKit.casts.updatedAt).toBe('date');
        expect(LayoutTemplate.casts.createdAt).toBe('date');
        expect(LayoutTemplate.casts.updatedAt).toBe('date');
        expect(LayoutRouteMapping.casts.createdAt).toBe('date');
    });
});
