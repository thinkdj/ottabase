// ---------------------------------------------------------------------------
// Brand Engine – Fetch layout templates and route mappings for org/app
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

/**
 * Fetch layout templates and route mappings for org/app.
 * When no mappings exist, creates default mappings using system default Brand Kit.
 */
export async function getLayoutData(organizationId: string | null, appId?: string | null): Promise<LayoutData> {
    let mappings: InstanceType<typeof LayoutRouteMapping>[] = [];

    if (appId && organizationId) {
        mappings = (await LayoutRouteMapping.where({
            organizationId,
            appId,
        })) as InstanceType<typeof LayoutRouteMapping>[];
    }
    if (mappings.length === 0 && organizationId) {
        mappings = (await LayoutRouteMapping.where({
            organizationId,
            appId: null,
        })) as InstanceType<typeof LayoutRouteMapping>[];
    }
    if (mappings.length === 0) {
        mappings = (await LayoutRouteMapping.where({
            organizationId: null,
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
        const defaultKit = await BrandKit.getOrCreateDefault();
        const kitId = defaultKit.get('id') as string;
        routeMappings = DEFAULT_ROUTE_MAPPINGS.map((m) => ({ ...m, brandKitId: kitId }));
    }

    const templateIds = [...new Set(routeMappings.map((m) => m.layoutTemplateId))];
    const layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }> = {};

    for (const [key, preset] of Object.entries(LAYOUT_PRESETS)) {
        layoutTemplatesMap[key] = { componentKey: key, config: preset.config };
    }

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
