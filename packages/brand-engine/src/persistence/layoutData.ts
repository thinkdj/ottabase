// ---------------------------------------------------------------------------
// Brand Engine – Fetch layout templates and route mappings for app (v2: per-app)
// Route mappings include brandKitId per row.
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '@ottabase/ottalayout';
import { LAYOUT_PRESETS } from '@ottabase/ottalayout';
import { DEFAULT_ROUTE_MAPPINGS } from '../layouts';
import { BrandKit } from './BrandKit.model';
import { LayoutRouteMapping } from './LayoutRouteMapping.model';
import { LayoutTemplate } from './LayoutTemplate.model';

export interface RouteMappingRow {
    pathPattern: string;
    layoutTemplateId: string;
    brandKitId: string;
    priority: number;
    /** Optional per-route token overrides (partial DesignTokens JSON) */
    tokenOverridesJson?: string | null;
}

export interface LayoutData {
    routeMappings: RouteMappingRow[];
    layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }>;
}

/** Resolve the default Brand Kit ID for an app (or system default). */
async function resolveDefaultKitIdForApp(appId: string | null): Promise<string> {
    if (appId) {
        const appDefault = (await BrandKit.first({ appId, isDefault: true })) as BrandKit | null;
        if (appDefault) return appDefault.get('id') as string;

        const appAny = (await BrandKit.first({ appId })) as BrandKit | null;
        if (appAny) return appAny.get('id') as string;
    }

    const systemDefault = await BrandKit.getOrCreateDefault();
    return systemDefault.get('id') as string;
}

/**
 * Fetch layout templates and route mappings for an app.
 * Falls back to system defaults (appId=null) when no app-specific mappings exist.
 * When no mappings exist at all, creates default mappings using system default Brand Kit.
 */
export async function getLayoutData(appId?: string | null): Promise<LayoutData> {
    let mappings: InstanceType<typeof LayoutRouteMapping>[] = [];

    // Try app-specific mappings first
    if (appId) {
        mappings = (await LayoutRouteMapping.where({
            appId,
        })) as InstanceType<typeof LayoutRouteMapping>[];
    }

    // Fall back to system default mappings (appId=null)
    if (mappings.length === 0) {
        mappings = (await LayoutRouteMapping.where({
            appId: null,
        })) as InstanceType<typeof LayoutRouteMapping>[];
    }

    let routeMappings: RouteMappingRow[];

    if (mappings.length > 0) {
        routeMappings = (mappings as LayoutRouteMapping[]).map((m) => ({
            pathPattern: m.get('pathPattern') as string,
            layoutTemplateId: m.get('layoutTemplateId') as string,
            brandKitId: m.get('brandKitId') as string,
            priority: (m.get('priority') as number) ?? 0,
            tokenOverridesJson: (m.get('tokenOverridesJson') as string | null) ?? null,
        }));
    } else {
        const kitId = await resolveDefaultKitIdForApp(appId ?? null);
        routeMappings = DEFAULT_ROUTE_MAPPINGS.map((m) => ({ ...m, brandKitId: kitId }));
    }

    const templateIds = [...new Set(routeMappings.map((m) => m.layoutTemplateId))];
    const layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }> = {};

    // Built-in presets always available
    for (const [key, preset] of Object.entries(LAYOUT_PRESETS)) {
        layoutTemplatesMap[key] = { componentKey: key, config: preset.config };
    }

    // DB-stored custom templates
    const dbTemplates = await LayoutTemplate.whereIn('id', templateIds);
    for (const template of dbTemplates as LayoutTemplate[]) {
        const id = template.get('id') as string;
        if (!layoutTemplatesMap[id]) {
            layoutTemplatesMap[id] = {
                componentKey: template.get('componentKey') as string,
                config: template.getConfig(),
            };
        }
    }

    return { routeMappings, layoutTemplatesMap };
}
