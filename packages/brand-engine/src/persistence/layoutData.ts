// ---------------------------------------------------------------------------
// Brand Engine – Fetch layout templates and route mappings for org/app
// ---------------------------------------------------------------------------

import type { LayoutConfig } from '../layout';
import { LayoutTemplate } from './LayoutTemplate.model';
import { LayoutRouteMapping } from './LayoutRouteMapping.model';
import { LAYOUT_PRESETS } from '../layouts/presets';

export interface RouteMappingRow {
    pathPattern: string;
    layoutTemplateId: string;
    priority: number;
}

export interface LayoutData {
    routeMappings: Array<{ pathPattern: string; layoutTemplateId: string; priority: number }>;
    layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }>;
}

/** Default route mappings when none in DB */
const DEFAULT_ROUTE_MAPPINGS: RouteMappingRow[] = [
    { pathPattern: '/demo/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/admin/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/dashboard', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/profile', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/shortlinks', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/referrals', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/blog/**', layoutTemplateId: 'homepage', priority: 10 },
    { pathPattern: '/organizations/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/*', layoutTemplateId: 'homepage', priority: 0 },
];

/**
 * Fetch layout templates and route mappings for org/app.
 * Resolves: app-level -> org-level -> system default.
 */
export async function getLayoutData(organizationId: string | null, appId?: string | null): Promise<LayoutData> {
    // 1. Fetch route mappings (app -> org -> default)
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

    const routeMappings =
        mappings.length > 0
            ? (mappings as LayoutRouteMapping[]).map((m) => ({
                  pathPattern: m.get('pathPattern') as string,
                  layoutTemplateId: m.get('layoutTemplateId') as string,
                  priority: (m.get('priority') as number) ?? 0,
              }))
            : DEFAULT_ROUTE_MAPPINGS;

    // 2. Batch-load layout templates by ID
    const templateIds = [...new Set(routeMappings.map((m) => m.layoutTemplateId))];
    const layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }> = {};

    for (const [key, preset] of Object.entries(LAYOUT_PRESETS)) {
        layoutTemplatesMap[key] = { componentKey: preset.componentKey, config: preset.config };
    }

    if (templateIds.length > 0) {
        const templates = (await LayoutTemplate.whereIn('id', templateIds)) as InstanceType<typeof LayoutTemplate>[];
        for (const template of templates) {
            const id = template.get('id') as string;
            layoutTemplatesMap[id] = {
                componentKey: template.get('componentKey') as string,
                config: template.getConfig(),
            };
        }
    }

    return { routeMappings, layoutTemplatesMap };
}
