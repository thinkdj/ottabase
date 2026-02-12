// ---------------------------------------------------------------------------
// Brand Engine React – LayoutResolver
// Resolves layout by path from config.routeMappings, renders registered layout
// ---------------------------------------------------------------------------

'use client';

import React from 'react';
import { useBrand } from './BrandProvider';
import { getLayoutComponent } from './registry';
import { resolveLayoutForPath } from '@ottabase/brand-engine';
import {
    HOMEPAGE_LAYOUT,
    APP_SHELL_LAYOUT,
    DOCS_LAYOUT,
    MINIMAL_LAYOUT,
    type LayoutComponentKey,
} from '@ottabase/brand-engine';

/** Router adapter: provide usePathname from your router */
export interface RouterAdapter {
    usePathname: () => string;
}

/** Default route mappings when none from API */
const DEFAULT_MAPPINGS = [
    { pathPattern: '/demo/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/admin/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/dashboard', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/profile', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/shortlinks', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/referrals', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/organizations/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/blog/**', layoutTemplateId: 'homepage', priority: 10 },
    { pathPattern: '/*', layoutTemplateId: 'homepage', priority: 0 },
];

const PRESETS: Record<string, { componentKey: LayoutComponentKey; config: object }> = {
    homepage: HOMEPAGE_LAYOUT,
    'app-shell': APP_SHELL_LAYOUT,
    docs: DOCS_LAYOUT,
    minimal: MINIMAL_LAYOUT,
};

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

    const layoutTemplate =
        config?.layoutTemplatesMap?.[layoutTemplateId] ?? PRESETS[layoutTemplateId] ?? HOMEPAGE_LAYOUT;
    const LayoutComponent = getLayoutComponent(layoutTemplate.componentKey as LayoutComponentKey);

    if (!LayoutComponent) return <>{children}</>;
    return <LayoutComponent config={layoutTemplate.config as any}>{children}</LayoutComponent>;
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
