// ---------------------------------------------------------------------------
// Brand Engine React – BrandProvider
// Single fetch GET /api/brand returns full config. Client resolves path locally.
// Features:
//   • Retry logic with exponential backoff
//   • Fallback theme for graceful degradation
//   • Route matching cache for performance
//   • CSS validation and debounced injection
//   • Per-route token overrides (applied on top of brand kit theme)
// ---------------------------------------------------------------------------

'use client';

import type { ResolvedBrandTheme } from '@ottabase/brand-engine';
import { deepMerge } from '@ottabase/brand-engine';
import type { LayoutConfig } from '@ottabase/ottalayout';
import { DEFAULT_LAYOUT, pathPatternToRegex } from '@ottabase/ottalayout';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/** Route mapping shape (expanded form) */
export type RouteMapping = {
    pathPattern: string;
    layoutTemplateId: string;
    brandKitId: string;
    priority: number;
    /** Optional per-route token overrides (partial DesignTokens JSON) */
    tokenOverridesJson?: string | null;
};

/**
 * Validates CSS syntax using Constructable Stylesheet API when available.
 * Fallback: basic type/emptiness check only (browser cannot reliably detect parse errors).
 */
function isCSSValid(css: string): boolean {
    if (typeof css !== 'string' || css.trim() === '') return false;
    try {
        if (typeof window !== 'undefined' && 'CSSStyleSheet' in window) {
            const Sheet = (window as unknown as { CSSStyleSheet: { new (): { replaceSync: (s: string) => void } } })
                .CSSStyleSheet;
            const sheet = new Sheet();
            sheet.replaceSync(css);
            return true;
        }
        const style = document.createElement('style');
        style.textContent = css;
        return true;
    } catch {
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

/** Route match result from the cached matcher */
interface RouteMatchResult {
    layoutTemplateId: string;
    brandKitId: string;
    tokenOverridesJson?: string | null;
}

/**
 * Creates a cached route matcher for efficient path resolution.
 * Caches both regex compilation and match results.
 */
function createRouteMatcherCache(mappings: RouteMapping[]) {
    const pathCache = new Map<string, RouteMatchResult | null>();
    const regexCache = new Map<string, RegExp>();
    const sorted = [...mappings].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    return (pathname: string): RouteMatchResult | null => {
        if (pathCache.has(pathname)) {
            return pathCache.get(pathname)!;
        }

        for (const m of sorted) {
            let regex = regexCache.get(m.pathPattern);
            if (!regex) {
                regex = pathPatternToRegex(m.pathPattern);
                regexCache.set(m.pathPattern, regex);
            }

            if (regex.test(pathname)) {
                const result: RouteMatchResult = {
                    layoutTemplateId: m.layoutTemplateId,
                    brandKitId: m.brandKitId,
                    tokenOverridesJson: m.tokenOverridesJson,
                };
                pathCache.set(pathname, result);
                return result;
            }
        }

        pathCache.set(pathname, null);
        return null;
    };
}

/**
 * Apply per-route token overrides to a resolved theme.
 * Parses the tokenOverridesJson and deep-merges on top of the kit theme.
 */
function applyRouteTokenOverrides(
    kitTheme: ResolvedBrandTheme,
    tokenOverridesJson: string,
    themeBase: string,
    tenantTheme: unknown,
): ResolvedBrandTheme {
    try {
        const overrides = JSON.parse(tokenOverridesJson) as Record<string, unknown>;
        if (!overrides || typeof overrides !== 'object' || Object.keys(overrides).length === 0) {
            return kitTheme;
        }
        // Deep-merge overrides into the resolved theme's colors/typography/etc.
        return deepMerge(kitTheme as unknown as Record<string, unknown>, overrides) as unknown as ResolvedBrandTheme;
    } catch {
        return kitTheme;
    }
}

/**
 * Full config from GET /api/brand – route mappings, layouts, all brand kits.
 * API returns both light and dark themes per kit. Client picks at runtime.
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
            /** Light-mode resolved theme */
            theme: ResolvedBrandTheme;
            /** Dark-mode resolved theme */
            darkTheme?: ResolvedBrandTheme;
            themeBase: string;
            tenantTheme: unknown;
            defaultColorScheme: string;
            allowDarkModeToggle: boolean;
            customCss?: string;
            hideOttabaseBranding: boolean;
        }
    >;
    /** @deprecated No longer sent by API — client determines mode locally */
    mode?: 'light' | 'dark';
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
    routeMappings: Array<{
        pathPattern: string;
        layoutTemplateId: string;
        brandKitId: string;
        priority: number;
        tokenOverridesJson?: string | null;
    }>;
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

type RouteMatcherFn = (pathname: string) => RouteMatchResult | null;

function resolveConfigForPath(
    full: FullBrandConfig,
    pathname: string,
    routeMatcher: RouteMatcherFn,
    mode: 'light' | 'dark',
    routeMappings: RouteMapping[],
): BrandConfig | null {
    const match = routeMatcher(pathname);
    const kitId = match?.brandKitId ?? full.kit ?? Object.keys(full.brandKitsMap)[0];
    const layoutId = match?.layoutTemplateId ?? 'homepage';
    const kit = kitId ? full.brandKitsMap[kitId] : Object.values(full.brandKitsMap)[0];
    if (!kit) return null;

    // Pick mode-appropriate theme (dark-mode theme if available, else fall back to light)
    let theme = mode === 'dark' && kit.darkTheme ? kit.darkTheme : kit.theme;

    // Apply per-route token overrides if present
    if (match?.tokenOverridesJson) {
        theme = applyRouteTokenOverrides(theme, match.tokenOverridesJson, kit.themeBase, kit.tenantTheme);
    }

    return {
        ...kit,
        theme,
        defaultColorScheme: kit.defaultColorScheme as 'light' | 'dark' | 'system',
        layoutTemplateId: layoutId,
        layoutTemplatesMap: full.layoutTemplatesMap,
        routeMappings,
        r2PublicUrl: full.r2PublicUrl,
    };
}

/** Build degraded config when API fails but fallbackTheme is provided */
function buildFallbackConfig(theme: ResolvedBrandTheme): BrandConfig {
    const layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }> = {
        homepage: { componentKey: 'homepage', config: DEFAULT_LAYOUT },
    };
    return {
        brandName: 'Default',
        logos: {},
        theme,
        themeBase: theme.name,
        tenantTheme: undefined,
        defaultColorScheme: 'light',
        allowDarkModeToggle: true,
        customCss: undefined,
        hideOttabaseBranding: false,
        layoutTemplateId: 'homepage',
        layoutTemplatesMap,
        routeMappings: [],
    };
}

/** Detect current color scheme mode from DOM */
function detectMode(): 'light' | 'dark' {
    if (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) {
        return 'dark';
    }
    return 'light';
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
    const [mode, setMode] = useState<'light' | 'dark'>(detectMode);
    const [isLoading, setIsLoading] = useState(!initialConfig);
    const [error, setError] = useState<Error | null>(null);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Watch for dark/light mode changes on <html> class (no refetch needed)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const observer = new MutationObserver(() => {
            setMode(detectMode());
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const fetchConfigWithRetry = useCallback(
        async (attempt = 1) => {
            try {
                setIsLoading(true);
                // No mode param — API returns both light+dark themes per kit
                const params = new URLSearchParams();
                if (organizationId) params.set('organizationId', organizationId);
                if (appId) params.set('appId', appId);
                const url = params.toString() ? `${apiEndpoint}?${params}` : apiEndpoint;

                const headers: Record<string, string> = {};
                if (organizationId) headers['X-Organization-Id'] = organizationId;
                if (appId) headers['X-App-Id'] = appId;
                const response = await fetch(url, { cache: 'no-store', headers });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: Failed to fetch brand config`);
                }
                const data = (await response.json()) as FullBrandConfig;
                setFullConfig(data);
                setError(null);
            } catch (err) {
                const errObj = err instanceof Error ? err : new Error('Unknown error');
                setError(errObj);

                // Retry with exponential backoff (max 3 attempts)
                if (attempt < 3) {
                    const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s
                    retryTimeoutRef.current = setTimeout(() => {
                        retryTimeoutRef.current = null;
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
        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
        };
    }, [fetchConfigWithRetry, initialConfig]);

    // Create route matcher cache + expanded route mappings, memoized
    const { routeMatcher, expandedRouteMappings } = useMemo(() => {
        if (!fullConfig) return { routeMatcher: null, expandedRouteMappings: [] as RouteMapping[] };
        const mappings = expandCompactConfig(fullConfig);
        return { routeMatcher: createRouteMatcherCache(mappings), expandedRouteMappings: mappings };
    }, [fullConfig]);

    // Derive path-scoped config from full config + current path + mode (no refetch on nav or mode change)
    const config = useMemo(() => {
        // Apply fallback theme when API fails and fallbackTheme is provided
        if (!fullConfig) {
            if (fallbackTheme && error) return buildFallbackConfig(fallbackTheme);
            return null;
        }
        if (!routeMatcher) return null;
        const resolved = resolveConfigForPath(fullConfig, path, routeMatcher, mode, expandedRouteMappings);
        // Fallback if route resolution fails but we have fullConfig + fallbackTheme
        if (resolved || !fallbackTheme) return resolved;
        const firstKit = Object.values(fullConfig.brandKitsMap)[0];
        if (!firstKit) return null;
        return {
            ...firstKit,
            theme: fallbackTheme,
            layoutTemplateId: 'homepage',
            layoutTemplatesMap: fullConfig.layoutTemplatesMap,
            routeMappings: expandedRouteMappings,
            r2PublicUrl: fullConfig.r2PublicUrl,
        } as BrandConfig;
    }, [fullConfig, path, mode, routeMatcher, expandedRouteMappings, fallbackTheme, error]);

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
        if (config.customCss) {
            debouncedInjectCss(config.customCss);
        }
        // Critical CSS removal is done by BrandThemeApplicator after it applies – avoids wrong-mode flash
    }, [config, debouncedInjectCss]);

    const brandContextValue = useMemo<BrandContextValue>(
        () => ({ config, isLoading, error, refresh: fetchConfigWithRetry }),
        [config, isLoading, error, fetchConfigWithRetry],
    );

    return (
        <BrandContext.Provider value={brandContextValue}>
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
