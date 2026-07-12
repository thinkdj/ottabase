# @ottabase/ottalayout — agent notes

Pure layout system: config types, presets, route-to-layout resolver, validators, React slots. Full docs: ./README.md

## Use when

- Defining or resolving page layouts: `LayoutConfig`, presets, route-pattern-to-layout mapping.
- Getting Tailwind layout classes (`contentWidthClass`, `sidebarWidthClass`, ...) or injecting React slot content / page-level layout hints.
- NOT for rendering or persistence — brand-engine(-react) stores/renders layout templates; ottamenu renders menus.

## Imports

    import { DEFAULT_LAYOUT, LAYOUT_PRESETS, LAYOUT_PRESET_IDS, BUILT_IN_MENU_SLOTS, createDefaultRouteMappings } from '@ottabase/ottalayout';
    import { resolveLayoutForPath, resolveRouteForPath, pathPatternToRegex } from '@ottabase/ottalayout';
    import { mergeLayoutConfig, isValidLayoutConfig, isValidPathPattern } from '@ottabase/ottalayout';
    import { contentWidthClass, containerPaddingClass, densityPadding, sidebarWidthClass } from '@ottabase/ottalayout';
    import type { LayoutConfig, RouteMapping, MenuSlotConfig, LayoutPresetId } from '@ottabase/ottalayout';
    import { LayoutSlotsProvider, LayoutSlot, SlotContent, useLayoutSlots } from '@ottabase/ottalayout/react';
    import { LayoutMetaProvider, useLayoutMeta, useResolvedLayoutMeta } from '@ottabase/ottalayout/react';

## Canonical usage

    // Resolve layout + brand kit for a URL path (higher priority checked first)
    const match = resolveRouteForPath('/docs/getting-started', routeMappings);
    // -> { layoutTemplateId, brandKitId, tokenOverridesJson? } | null

    // Merge a stored partial config against defaults (invalid values fall back)
    const config = mergeLayoutConfig(partialFromDb, DEFAULT_LAYOUT);

    // Slots: layout renders the hole, page fills it
    <LayoutSlot name='toolbar' fallback={<DefaultToolbar />} />
    <SlotContent name='toolbar'><MyToolbar /></SlotContent>

    // Page-level layout hints, read by the shell via useResolvedLayoutMeta()
    useLayoutMeta({ navigation: 'none', centerContent: true, contentWidth: 'xs' });

## Gotchas

- React is an optional peer dep — import slots/meta only from `@ottabase/ottalayout/react`; the root entry is React-free.
- Path patterns: `*` = one segment, `**` = any depth; `/blog/**` also matches `/blog` itself. Higher `priority` number wins.
- `mergeLayoutConfig` silently replaces invalid field values with defaults — validate with `isValidLayoutConfig` if you need to reject bad input.
- 10 presets total (`LAYOUT_PRESETS` / `LAYOUT_PRESET_IDS`), incl. `APP_SHELL_LAYOUT`, `DOCS_LAYOUT`, `DASHBOARD_LAYOUT`, `AUTH_LAYOUT`, `MARKETING_LAYOUT`.
- No persistence here: menu slot assignments and layout templates live in `@ottabase/brand-engine`.
