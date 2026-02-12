// ---------------------------------------------------------------------------
// Brand Engine React – BrandProvider
// Single fetch GET /api/brand returns full config. Client resolves path locally.
// ---------------------------------------------------------------------------

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { CRITICAL_STYLE_ID, resolveRouteForPath } from '@ottabase/brand-engine';
import type { LayoutConfig } from '@ottabase/brand-engine';
import type { ResolvedBrandTheme } from '@ottabase/brand-engine';

/** Route mapping shape (expanded form) */
export type RouteMapping = { pathPattern: string; layoutTemplateId: string; brandKitId: string; priority: number };

/**
 * Full config from GET /api/brand – route mappings, layouts, all brand kits.
 * API may return compact form (kit + routes) when single brand kit.
 */
export interface FullBrandConfig {
    routeMappings?: RouteMapping[];
    kit?: string;
    routes?: [string, string, number][];
    layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }>;
    brandKitsMap: Record<
        string,
        {
            brandName: string;
            tagline?: string;
            logos: Record<string, string>;
            theme: ResolvedBrandTheme;
            themeBase: string;
            tenantTheme: unknown;
            defaultColorScheme: string;
            allowDarkModeToggle: boolean;
            customCss?: string;
            hideOttabaseBranding: boolean;
        }
    >;
    mode: 'light' | 'dark';
}

function expandCompactConfig(config: FullBrandConfig): RouteMapping[] {
    if (config.routeMappings?.length) return config.routeMappings;
    if (config.kit && config.routes) {
        return config.routes.map(([pathPattern, layoutTemplateId, priority]) => ({
            pathPattern,
            layoutTemplateId,
            brandKitId: config.kit!,
            priority,
        }));
    }
    return [];
}

/**
 * Path-resolved config (derived from FullBrandConfig + path).
 */
export interface BrandConfig {
    brandName: string;
    tagline?: string;
    logos: { primary?: string; dark?: string; icon?: string; ogImage?: string; emailLogo?: string };
    theme: ResolvedBrandTheme;
    themeBase: string;
    tenantTheme: unknown;
    defaultColorScheme: 'light' | 'dark' | 'system';
    allowDarkModeToggle: boolean;
    customCss?: string;
    hideOttabaseBranding: boolean;
    layoutTemplateId: string;
    layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }>;
    routeMappings: Array<{ pathPattern: string; layoutTemplateId: string; brandKitId: string; priority: number }>;
}

interface BrandContextValue {
    config: BrandConfig | null;
    isLoading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
}

const BrandContext = createContext<BrandContextValue | null>(null);
const BrandPathContext = createContext<((path: string) => void) | null>(null);

export interface BrandProviderProps {
    children: React.ReactNode;
    apiEndpoint?: string;
    initialConfig?: FullBrandConfig;
    organizationId?: string | null;
    appId?: string | null;
}

function resolveConfigForPath(full: FullBrandConfig, pathname: string): BrandConfig | null {
    const routeMappings = expandCompactConfig(full);
    const match = resolveRouteForPath(pathname, routeMappings);
    const kitId = match?.brandKitId ?? full.kit ?? Object.keys(full.brandKitsMap)[0];
    const layoutId = match?.layoutTemplateId ?? 'homepage';
    const kit = kitId ? full.brandKitsMap[kitId] : Object.values(full.brandKitsMap)[0];
    if (!kit) return null;
    return {
        ...kit,
        defaultColorScheme: kit.defaultColorScheme as 'light' | 'dark' | 'system',
        layoutTemplateId: layoutId,
        layoutTemplatesMap: full.layoutTemplatesMap,
        routeMappings,
    };
}

export function BrandProvider({
    children,
    apiEndpoint = '/api/brand',
    initialConfig,
    organizationId,
    appId,
}: BrandProviderProps) {
    const [fullConfig, setFullConfig] = useState<FullBrandConfig | null>(initialConfig ?? null);
    const [path, setPath] = useState('/');
    const [isLoading, setIsLoading] = useState(!initialConfig);
    const [error, setError] = useState<Error | null>(null);

    const fetchConfig = useCallback(async () => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams();
            const mode =
                typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                    ? 'dark'
                    : 'light';
            params.set('mode', mode);
            if (organizationId) params.set('organizationId', organizationId);
            if (appId) params.set('appId', appId);
            const url = `${apiEndpoint}?${params}`;

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch brand config');
            const data = (await response.json()) as FullBrandConfig;
            setFullConfig(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Unknown error'));
        } finally {
            setIsLoading(false);
        }
    }, [apiEndpoint, organizationId, appId]);

    useEffect(() => {
        if (!initialConfig) fetchConfig();
    }, [fetchConfig, initialConfig]);

    // Derive path-scoped config from full config + current path (no refetch on nav)
    const config = useMemo(() => {
        if (!fullConfig) return null;
        return resolveConfigForPath(fullConfig, path);
    }, [fullConfig, path]);

    useEffect(() => {
        if (!config) return;
        if (typeof document !== 'undefined') {
            const critical = document.getElementById(CRITICAL_STYLE_ID);
            if (critical) critical.remove();
        }
        if (config.customCss) injectCustomCss(config.customCss);
    }, [config]);

    return (
        <BrandContext.Provider value={{ config, isLoading, error, refresh: fetchConfig }}>
            <BrandPathContext.Provider value={setPath}>{children}</BrandPathContext.Provider>
        </BrandContext.Provider>
    );
}

/** Call inside router (e.g. RootLayout) to sync path for path-scoped brand fetch */
export function BrandPathSync({ pathname }: { pathname: string }) {
    const setPath = useContext(BrandPathContext);
    useEffect(() => {
        setPath?.(pathname);
    }, [pathname, setPath]);
    return null;
}

export function useBrand(): BrandContextValue {
    const context = useContext(BrandContext);
    if (!context) {
        throw new Error('useBrand must be used within a BrandProvider');
    }
    return context;
}

function injectCustomCss(css: string) {
    const id = 'brand-custom-css';
    let style = document.getElementById(id) as HTMLStyleElement | null;

    if (!style) {
        style = document.createElement('style');
        style.id = id;
        document.head.appendChild(style);
    }

    style.textContent = css;
}
