// ---------------------------------------------------------------------------
// Brand Engine React – LayoutResolver
// Resolves layout by path from config.routeMappings, renders registered layout
// ---------------------------------------------------------------------------

'use client';

import {
    DEFAULT_ROUTE_MAPPINGS,
    LAYOUT_PRESETS,
    resolveLayoutForPath,
    type LayoutComponentKey,
} from '@ottabase/brand-engine';
import React from 'react';
import { useBrand } from './BrandProvider';
import { getLayoutComponent } from './registry';

/** Router adapter: provide usePathname from your router */
export interface RouterAdapter {
    usePathname: () => string;
}

/** Default route mappings when none from API (shared with server fallbacks) */
const DEFAULT_MAPPINGS = DEFAULT_ROUTE_MAPPINGS;

export interface LayoutResolverProps {
    children: React.ReactNode;
    /** Router adapter (e.g. tanstackRouterAdapter) */
    router?: RouterAdapter;
}

export function LayoutResolver({ children, router }: LayoutResolverProps) {
    const { config } = useBrand();
    const usePathname = router?.usePathname ?? usePathnameFallback;
    const pathname = usePathname();

    // Use layoutTemplateId from config (path-scoped) when available; else resolve from routeMappings
    const layoutTemplateId =
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
        'homepage';

    const configTemplate = config?.layoutTemplatesMap?.[layoutTemplateId];
    const layoutTemplate = configTemplate
        ? {
              componentKey: configTemplate.componentKey,
              config: configTemplate.config,
          }
        : layoutTemplateId in LAYOUT_PRESETS
          ? LAYOUT_PRESETS[layoutTemplateId as LayoutComponentKey]
          : LAYOUT_PRESETS.homepage;

    const componentKey = layoutTemplate.componentKey as LayoutComponentKey;
    const LayoutComponent = getLayoutComponent(componentKey);

    if (!LayoutComponent) return <>{children}</>;
    return <LayoutComponent config={layoutTemplate.config}>{children}</LayoutComponent>;
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
