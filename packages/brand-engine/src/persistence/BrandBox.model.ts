// ---------------------------------------------------------------------------
// Brand Engine – BrandBox OttaORM Model
// Unified preset: layout + theme + logos + config
// ---------------------------------------------------------------------------

import { BaseModel, type PackageType } from '@ottabase/ottaorm';
import { brandBoxesTable } from './schema';
import type { LayoutConfig } from '../layout';
import { LayoutTemplate } from './LayoutTemplate.model';
import { LAYOUT_PRESETS } from '../layouts/presets';

export interface RouteMappingRow {
    pathPattern: string;
    layoutTemplateId: string;
    priority: number;
}

export class BrandBox extends BaseModel {
    static entity = 'brand_boxes';
    static table = brandBoxesTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/brand-engine';
    static packageType: PackageType = 'package' as PackageType;

    static casts = {
        isActive: 'boolean' as const,
        hideOttabaseBranding: 'boolean' as const,
        activeFrom: 'date' as const,
        activeUntil: 'date' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    /** Parse routeMappingsJson */
    getRouteMappings(): RouteMappingRow[] {
        const raw = this.get('routeMappingsJson');
        if (!raw || typeof raw !== 'string') return [];
        try {
            return JSON.parse(raw) as RouteMappingRow[];
        } catch {
            return [];
        }
    }

    /** Parse identityJson */
    getIdentity(): { brandName?: string; tagline?: string } {
        const raw = this.get('identityJson');
        if (!raw || typeof raw !== 'string') return {};
        try {
            return JSON.parse(raw) as { brandName?: string; tagline?: string };
        } catch {
            return {};
        }
    }

    /** Parse logosJson (R2 keys) */
    getLogos(): {
        logoKey?: string;
        logoDarkKey?: string;
        iconKey?: string;
        ogImageKey?: string;
        emailLogoKey?: string;
    } {
        const raw = this.get('logosJson');
        if (!raw || typeof raw !== 'string') return {};
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    }

    /** Parse layoutTemplatesSnapshotJson */
    getLayoutTemplatesSnapshot(): Record<string, { componentKey: string; config: LayoutConfig }> {
        const raw = this.get('layoutTemplatesSnapshotJson');
        if (!raw || typeof raw !== 'string') return {};
        try {
            return JSON.parse(raw) as Record<string, { componentKey: string; config: LayoutConfig }>;
        } catch {
            return {};
        }
    }

    /**
     * Deactivate all BrandBoxes for org/app
     */
    static async deactivateAll(organizationId: string | null, appId?: string | null): Promise<void> {
        const boxes = (await this.where({
            organizationId: organizationId ?? null,
            appId: appId ?? null,
        })) as BrandBox[];
        for (const box of boxes) {
            if (box.get('isActive')) {
                box.set('isActive', false);
                await box.save();
            }
        }
    }

    /**
     * Activate this BrandBox for its org/app.
     * Deactivates all others first, then sets this one active.
     */
    async activate(): Promise<void> {
        const orgId = this.get('organizationId') as string | null;
        const appId = this.get('appId') as string | null;
        await BrandBox.deactivateAll(orgId, appId);
        this.set('isActive', true);
        await this.save();
    }

    /**
     * Capture current layout templates (from route mappings) into snapshot.
     * Uses template IDs from this box's routeMappingsJson.
     */
    async snapshot(): Promise<void> {
        const routeMappings = this.getRouteMappings();
        const templateIds = [...new Set(routeMappings.map((m) => m.layoutTemplateId))];
        const snapshotMap: Record<string, { componentKey: string; config: LayoutConfig }> = {};

        // Start with presets
        for (const [key, preset] of Object.entries(LAYOUT_PRESETS)) {
            snapshotMap[key] = { componentKey: preset.componentKey, config: preset.config };
        }

        // Override with DB templates
        for (const id of templateIds) {
            const template = (await LayoutTemplate.find(id)) as InstanceType<typeof LayoutTemplate> | null;
            if (template) {
                snapshotMap[id] = {
                    componentKey: template.get('componentKey') as string,
                    config: template.getConfig(),
                };
            }
        }

        this.set('layoutTemplatesSnapshotJson', JSON.stringify(snapshotMap));
        await this.save();
    }

    /**
     * Find active BrandBox for org/app
     */
    static async findActive(organizationId: string | null, appId?: string | null): Promise<BrandBox | null> {
        // app-level first
        if (appId && organizationId) {
            const appBox = (await this.first({
                organizationId,
                appId,
                isActive: true,
            })) as BrandBox | null;
            if (appBox) return appBox;
        }
        // org-level
        if (organizationId) {
            const orgBox = (await this.first({
                organizationId,
                appId: null,
                isActive: true,
            })) as BrandBox | null;
            if (orgBox) return orgBox;
        }
        // system default
        return (await this.first({
            organizationId: null,
            appId: null,
            isActive: true,
        })) as BrandBox | null;
    }
}
