/**
 * The site design draft: the live brand config with the workspace's unsaved
 * route mappings and menu slots laid over it, and the questions the preview
 * asks of it (which kit and layout a path gets).
 */
import {
    createRouteMatcher,
    resolveConfigForPath,
    type BrandConfig,
    type FullBrandConfig,
    type ResolvedMenuSlotData,
    type RouteMapping,
} from '@ottabase/brand-engine-react';
import { LAYOUT_PRESETS, type LayoutConfig, type LayoutPresetId } from '@ottabase/ottalayout';
import type { LayoutMappingItem, LayoutTemplateItem, MenuSlotAssignmentItem } from '../brand/brandApi';
import type { MenuWithItemsDto } from '../menus/menuApi';

/** A path the pattern matches, for the preview menu: "/blog/**" is "/blog", "/docs/*" is "/docs/page" */
export function samplePath(pattern: string): string {
    const path = pattern
        .trim()
        .replace(/\/\*\*$/, '')
        .replace(/\*+/g, 'page');
    return path.startsWith('/') ? path || '/' : `/${path}`;
}

/** Slot assignments joined with their menus, in the shape the site chrome reads */
export function resolveSlots(
    assignments: MenuSlotAssignmentItem[],
    menus: MenuWithItemsDto[],
): Record<string, ResolvedMenuSlotData[]> {
    const byId = new Map(menus.map((menu) => [menu.id, menu]));
    const slots: Record<string, ResolvedMenuSlotData[]> = {};
    for (const a of assignments) {
        const menu = byId.get(a.menuId);
        if (!a.slotName || !menu) continue;
        (slots[a.slotName] ??= []).push({
            slotName: a.slotName,
            menuId: a.menuId,
            renderType: a.renderType,
            sortOrder: a.sortOrder ?? 0,
            menu: { id: menu.id, name: menu.name, slug: menu.slug, type: menu.type, items: menu.items },
        });
    }
    for (const list of Object.values(slots)) list.sort((a, b) => a.sortOrder - b.sortOrder);
    return slots;
}

export const toRouteMappings = (mappings: LayoutMappingItem[]): RouteMapping[] =>
    mappings.map((m) => ({
        pathPattern: m.pathPattern,
        layoutTemplateId: m.layoutTemplateId,
        brandKitId: m.brandKitId,
        priority: m.priority ?? 0,
        tokenOverridesJson: m.tokenOverridesJson ?? null,
    }));

/** The live config with the draft laid over it */
export function withDraft(
    full: FullBrandConfig,
    draft: { mappings: LayoutMappingItem[]; menuSlots: Record<string, ResolvedMenuSlotData[]> },
): FullBrandConfig {
    return { ...full, routes: undefined, routeMappings: toRouteMappings(draft.mappings), menuSlots: draft.menuSlots };
}

/** The config a path renders with, as the site would resolve it */
export function configForPath(full: FullBrandConfig, path: string, mode: 'light' | 'dark'): BrandConfig | null {
    const mappings = full.routeMappings ?? [];
    return resolveConfigForPath(full, path, createRouteMatcher(mappings), mode, mappings);
}

/** The layout a resolved config asks for: a saved template, else a built-in preset */
export function layoutFor(config: BrandConfig | null): LayoutConfig {
    const id = config?.layoutTemplateId ?? 'homepage';
    return (
        config?.layoutTemplatesMap?.[id]?.config ??
        (id in LAYOUT_PRESETS ? LAYOUT_PRESETS[id as LayoutPresetId].config : LAYOUT_PRESETS.homepage.config)
    );
}

/** "Kit X, layout Y" for a path, by name */
export function describePath(
    full: FullBrandConfig,
    path: string,
    kits: { id: string; name: string }[],
    layouts: LayoutTemplateItem[],
): { kit: string; layout: string } {
    const mappings = full.routeMappings ?? [];
    const match = createRouteMatcher(mappings)(path);
    const kitId = match?.brandKitId ?? full.kit ?? Object.keys(full.brandKitsMap)[0];
    const layoutId = match?.layoutTemplateId ?? 'homepage';
    return {
        kit: kits.find((k) => k.id === kitId)?.name ?? full.brandKitsMap[kitId]?.brandName ?? 'Default kit',
        layout: layouts.find((l) => l.id === layoutId)?.name ?? layoutId,
    };
}
