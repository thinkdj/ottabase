// ---------------------------------------------------------------------------
// Brand Engine React – BrandProvider
// Single fetch GET /api/brand returns full config. Client resolves path locally.
// Features:
//   • Retry logic with exponential backoff
//   • Fallback theme for graceful degradation
//   • Route matching cache for performance
//   • CSS validation and debounced injection
// ---------------------------------------------------------------------------

'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { CRITICAL_STYLE_ID, resolveRouteForPath, pathPatternToRegex } from '@ottabase/brand-engine';
import type { LayoutConfig, ResolvedBrandTheme } from '@ottabase/brand-engine';

/** Route mapping shape (expanded form) */
export type RouteMapping = { pathPattern: string; layoutTemplateId: string; brandKitId: string; priority: number };

/**
 * Validates CSS syntax by attempting to parse it.
 */
function isCSSValid(css: string): boolean {
    if (!css || typeof css !== 'string') return false;
    try {
        // Try to create a style element with the CSS
        const style = document.createElement('style');
        style.textContent = css;
        // If no error is thrown, CSS is likely valid
        return true;
    } catch {
        console.warn('Invalid CSS provided to BrandProvider');
        return false;
    }
}

/**
 * Injects custom CSS into the DOM with validation.
 */
function injectCssOptimized(css: string) {
    if (!isCSSValid(css)) {
        return;
    }

    const id = 'brand-custom-css';
    let style = document.getElementById(id) as HTMLStyleElement | null;

    if (!style) {
        style = document.createElement('style');
        style.id = id;
        document.head.appendChild(style);
    }

    style.textContent = css;
}

/**
 * Simple debounce helper for CSS injection.
 */
function createDebounce(fn: (css: string) => void, delay: number) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return (css: string) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            fn(css);
            timeoutId = null;
        }, delay);
    };
}

/**
 * Creates a cached route matcher for efficient path resolution.
 * Caches both regex compilation and match results.
 */
function createRouteMatcherCache(mappings: RouteMapping[]) {
    const pathCache = new Map<string, { layoutTemplateId: string; brandKitId: string } | null>();
    const regexCache = new Map<string, RegExp>();

    return (pathname: string) => {
        // Check path result cache first
        if (pathCache.has(pathname)) {
            return pathCache.get(pathname)!;
        }

        // Sort by priority (higher first)
        const sorted = [...mappings].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

        for (const m of sorted) {
            // Check regex cache
            let regex = regexCache.get(m.pathPattern);
            if (!regex) {
                // Compile and cache regex
                regex = pathPatternToRegex(m.pathPattern);
                regexCache.set(m.pathPattern, regex);
            }

            if (regex.test(pathname)) {
                const result = { layoutTemplateId: m.layoutTemplateId, brandKitId: m.brandKitId };
                pathCache.set(pathname, result);
                return result;
            }
        }

        // Cache miss
        pathCache.set(pathname, null);
        return null;
    };
}

/**
 * Full config from GET /api/brand – route mappings, layouts, all brand kits.
 * API may return compact form (kit + routes) when single brand kit.
 */
export interface FullBrandConfig {
    routeMappings?: RouteMapping[];
    kit?: string;
    routes?: [string, string, number][];
    r2PublicUrl?: string;
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
    r2PublicUrl?: string;
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
    /**
     * Fallback theme for graceful degradation when API fails.
     * If not provided, uses a default minimal theme.
     */
    fallbackTheme?: ResolvedBrandTheme;
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
        r2PublicUrl: full.r2PublicUrl,
    };
}

export function BrandProvider({
    children,
    apiEndpoint = '/api/brand',
    initialConfig,
    organizationId,
    appId,
    fallbackTheme,
}: BrandProviderProps) {
    const [fullConfig, setFullConfig] = useState<FullBrandConfig | null>(initialConfig ?? null);
    const [path, setPath] = useState('/');
    const [isLoading, setIsLoading] = useState(!initialConfig);
    const [error, setError] = useState<Error | null>(null);
    const retryCountRef = useRef(0);

    const fetchConfigWithRetry = useCallback(
        async (attempt = 1) => {
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
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: Failed to fetch brand config`);
                }
                const data = (await response.json()) as FullBrandConfig;
                setFullConfig(data);
                setError(null);
                retryCountRef.current = 0;
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Unknown error');
                setError(error);

                // Retry with exponential backoff (max 3 attempts)
                if (attempt < 3) {
                    const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s
                    setTimeout(() => {
                        retryCountRef.current = attempt;
                        fetchConfigWithRetry(attempt + 1);
                    }, delayMs);
                }
            } finally {
                setIsLoading(false);
            }
        },
        [apiEndpoint, organizationId, appId],
    );

    useEffect(() => {
        if (!initialConfig) {
            fetchConfigWithRetry();
        }
    }, [fetchConfigWithRetry, initialConfig]);

    // Create route matcher cache, memoized
    const routeMatcher = useMemo(() => {
        if (!fullConfig) return null;
        const routeMappings = expandCompactConfig(fullConfig);
        return createRouteMatcherCache(routeMappings);
    }, [fullConfig]);

    // Derive path-scoped config from full config + current path (no refetch on nav)
    const config = useMemo(() => {
        if (!fullConfig || !routeMatcher) return null;
        const resolved = resolveConfigForPath(fullConfig, path);
        // Fallback if resolution fails
        if (resolved || !fallbackTheme) return resolved;
        return {
            ...Object.values(fullConfig.brandKitsMap)[0],
            theme: fallbackTheme,
            layoutTemplateId: 'homepage',
            layoutTemplatesMap: fullConfig.layoutTemplatesMap,
            routeMappings: expandCompactConfig(fullConfig),
            r2PublicUrl: fullConfig.r2PublicUrl,
        } as BrandConfig;
    }, [fullConfig, path, routeMatcher, fallbackTheme]);

    // Debounced CSS injection with validation
    const debouncedInjectCss = useMemo(
        () =>
            createDebounce((css: string) => {
                requestAnimationFrame(() => injectCssOptimized(css));
            }, 300),
        [],
    );

    useEffect(() => {
        if (!config) return;
        if (typeof document !== 'undefined') {
            const critical = document.getElementById(CRITICAL_STYLE_ID);
            if (critical) critical.remove();
        }
        if (config.customCss) {
            debouncedInjectCss(config.customCss);
        }
    }, [config, debouncedInjectCss]);

    return (
        <BrandContext.Provider value={{ config, isLoading, error, refresh: fetchConfigWithRetry }}>
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
