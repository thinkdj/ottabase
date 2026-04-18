// ---------------------------------------------------------------------------
// Brand Engine React – LayoutResolver
// Resolves layout preset for the current path, renders the provided
// layout component with the preset's config. Merges page-level overrides
// from useLayoutMeta and wraps children in the slot + meta providers.
// ---------------------------------------------------------------------------

'use client';

import {
    LAYOUT_PRESETS,
    mergeLayoutConfig,
    resolveLayoutForPath,
    type LayoutConfig,
    type LayoutPresetId,
} from '@ottabase/ottalayout';
import { LayoutMetaProvider, LayoutSlotsProvider, useResolvedLayoutMeta } from '@ottabase/ottalayout/react';
import React, { useMemo } from 'react';
import { useBrand } from './BrandProvider';

/** Props accepted by a layout component (the "shell" renderer) */
export interface LayoutComponentProps {
    config: LayoutConfig;
    children: React.ReactNode;
}

/** Router adapter: provide usePathname from your router */
export interface RouterAdapter {
    usePathname: () => string;
}

export interface LayoutResolverProps {
    children: React.ReactNode;
    /** Router adapter (e.g. tanstackRouterAdapter) */
    router?: RouterAdapter;
    /** The layout component that renders the app shell from LayoutConfig */
    layoutComponent: React.ComponentType<LayoutComponentProps>;
}

/**
 * Inner component that resolves layout and merges page-level meta.
 * Must be rendered inside LayoutMetaProvider to read overrides.
 */
function LayoutResolverInner({ children, router, layoutComponent: LayoutComponent }: LayoutResolverProps) {
    const { config } = useBrand();
    const usePathname = router?.usePathname ?? usePathnameFallback;
    const pathname = usePathname();
    const pageMeta = useResolvedLayoutMeta();

    // Resolve preset ID: explicit from config → route-mapping match → fallback
    const presetId = useMemo(
        () =>
            config?.layoutTemplateId ??
            (config?.routeMappings && config.routeMappings.length > 0
                ? resolveLayoutForPath(
                      pathname,
                      config.routeMappings.map((m) => ({
                          pathPattern: m.pathPattern,
                          layoutTemplateId: m.layoutTemplateId,
                          priority: m.priority,
                      })),
                  )
                : null) ??
            'homepage',
        [config?.layoutTemplateId, config?.routeMappings, pathname],
    );

    // Resolve config: DB template map → built-in preset → fallback to homepage
    const baseConfig = useMemo(
        () =>
            config?.layoutTemplatesMap?.[presetId]?.config ??
            (presetId in LAYOUT_PRESETS
                ? LAYOUT_PRESETS[presetId as LayoutPresetId].config
                : LAYOUT_PRESETS.homepage.config),
        [config?.layoutTemplatesMap, presetId],
    );

    // Merge page-level overrides from useLayoutMeta (if any)
    const layoutConfig = useMemo(
        () => (pageMeta ? mergeLayoutConfig({ ...baseConfig, ...pageMeta }, baseConfig) : baseConfig),
        [baseConfig, pageMeta],
    );

    return <LayoutComponent config={layoutConfig}>{children}</LayoutComponent>;
}

/**
 * Top-level LayoutResolver wraps the inner resolver with providers
 * for layout slots and page-level meta overrides.
 */
export function LayoutResolver({ children, router, layoutComponent }: LayoutResolverProps) {
    return (
        <LayoutMetaProvider>
            <LayoutSlotsProvider>
                <LayoutResolverInner router={router} layoutComponent={layoutComponent}>
                    {children}
                </LayoutResolverInner>
            </LayoutSlotsProvider>
        </LayoutMetaProvider>
    );
}

function usePathnameFallback(): string {
    const [path, setPath] = React.useState(() => (typeof window !== 'undefined' ? window.location.pathname : '/'));
    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        const handler = () => setPath(window.location.pathname);
        window.addEventListener('popstate', handler);
        return () => window.removeEventListener('popstate', handler);
    }, []);
    return path;
}
