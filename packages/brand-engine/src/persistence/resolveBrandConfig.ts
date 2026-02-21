// ---------------------------------------------------------------------------
// Brand Engine – Resolve brand config (path-aware, v2: per-app scoping)
// Resolution: route mappings → match path → Brand Kit + layout
// ---------------------------------------------------------------------------

import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import { resolveRouteForPath } from '@ottabase/ottalayout';
import type { ResolvedBrandTheme } from '../resolver';
import { deepMerge } from '../resolver';
import { BrandKit } from './BrandKit.model';
import { brandKitLogos, brandKitToTheme } from './brandKitToConfig';
import { createBrandCache } from './cache';
import { getLayoutData } from './layoutData';
import type { BrandResolutionCache, ResolvedBrandConfig } from './types';

export interface ResolveBrandConfigEnv {
    OBCF_D1: D1Database;
    OBCF_KV: KVNamespace;
    OBCF_R2: R2Bucket;
    R2_PUBLIC_URL?: string;
}

export interface ResolveBrandConfigOptions {
    /** App ID – primary scope for brand resolution */
    appId?: string | null;
    /** Current pathname – required for path-scoped resolution */
    path: string;
    /** Color scheme mode (light, dark, or custom scheme name) */
    mode?: string;
    /** Skip cache */
    skipCache?: boolean;
}

/** Full resolution data – all route mappings + all brand kits (both modes). Client resolves path locally. */
export type FullBrandConfig = BrandResolutionCache & { mode?: string; r2PublicUrl?: string };

/**
 * Load and build brand kits map from database.
 * Resolves BOTH light and dark themes per kit so the client can switch modes
 * without a refetch. `theme` = light, `darkTheme` = dark.
 */
async function loadBrandKitsMap(brandKitIds: string[], r2Url: string): Promise<BrandResolutionCache['brandKitsMap']> {
    const brandKitsMap: BrandResolutionCache['brandKitsMap'] = {};

    await Promise.all(
        brandKitIds.map(async (kitId) => {
            const kit = (await BrandKit.find(kitId)) as BrandKit | null;
            if (!kit) return;

            const [lightTheme, darkTheme] = await Promise.all([
                brandKitToTheme(kit, 'light'),
                brandKitToTheme(kit, 'dark'),
            ]);

            const logos = brandKitLogos(kit, r2Url);

            brandKitsMap[kitId] = {
                brandName: (kit.get('brandName') as string) || 'My App',
                tagline: (kit.get('tagline') as string) || undefined,
                logos: {
                    primary: logos.logo,
                    dark: logos.logoDark,
                    icon: logos.icon,
                    ogImage: logos.ogImage,
                    emailLogo: logos.emailLogo,
                } as Record<string, string>,
                theme: lightTheme as ResolvedBrandTheme,
                darkTheme,
                defaultColorScheme: (kit.get('defaultColorScheme') as string) || 'system',
                allowDarkModeToggle: (kit.get('allowDarkModeToggle') as boolean) ?? true,
                customCss: (kit.get('customCss') as string) || undefined,
                hideOttabaseBranding: (kit.get('hideOttabaseBranding') as boolean) ?? false,
            };
        }),
    );

    // Ensure system default exists if no kits loaded
    if (Object.keys(brandKitsMap).length === 0) {
        const defaultKit = await BrandKit.getOrCreateDefault();
        const defaultKitId = (defaultKit.get('id') as string) || 'default';
        const [lightTheme, darkTheme] = await Promise.all([
            brandKitToTheme(defaultKit, 'light'),
            brandKitToTheme(defaultKit, 'dark'),
        ]);
        const logos = brandKitLogos(defaultKit, '');
        brandKitsMap[defaultKitId] = {
            brandName: (defaultKit.get('brandName') as string) || 'My App',
            tagline: (defaultKit.get('tagline') as string) || undefined,
            logos: {
                primary: logos.logo,
                dark: logos.logoDark,
                icon: logos.icon,
                ogImage: logos.ogImage,
                emailLogo: logos.emailLogo,
            } as Record<string, string>,
            theme: lightTheme as ResolvedBrandTheme,
            darkTheme,
            defaultColorScheme: (defaultKit.get('defaultColorScheme') as string) || 'system',
            allowDarkModeToggle: (defaultKit.get('allowDarkModeToggle') as boolean) ?? true,
            customCss: (defaultKit.get('customCss') as string) || undefined,
            hideOttabaseBranding: (defaultKit.get('hideOttabaseBranding') as boolean) ?? false,
        };
    }

    return brandKitsMap;
}

/**
 * Resolve full brand data (route mappings, layouts, all brand kits) for an app.
 * Returns both light and dark themes per kit – client picks mode at runtime.
 * Client uses resolveRouteForPath(path, routeMappings) then brandKitsMap[match.brandKitId].
 */
export async function resolveFullBrandConfig(
    env: ResolveBrandConfigEnv,
    opts: Omit<ResolveBrandConfigOptions, 'path'> & { path?: string },
): Promise<FullBrandConfig | null> {
    const appId = opts.appId ?? null;
    const skipCache = opts.skipCache ?? false;

    const cache = createBrandCache(env.OBCF_KV);
    const r2Url = env.R2_PUBLIC_URL || '';

    // Dual-mode: cache is mode-neutral (both themes stored per kit)
    if (!skipCache) {
        const cached = await cache.getResolutionData(appId, 'all');
        if (cached) return { ...cached, r2PublicUrl: r2Url };
    }

    const layoutData = await getLayoutData(appId);
    const brandKitIds = [...new Set(layoutData.routeMappings.map((m) => m.brandKitId))];
    const brandKitsMap = await loadBrandKitsMap(brandKitIds, r2Url);

    const cacheData: BrandResolutionCache = {
        routeMappings: layoutData.routeMappings,
        layoutTemplatesMap: layoutData.layoutTemplatesMap,
        brandKitsMap,
    };
    const fullConfig: FullBrandConfig = {
        ...cacheData,
        r2PublicUrl: r2Url,
    };

    if (!skipCache) {
        await cache.setResolutionData(appId, 'all', cacheData);
    }
    return fullConfig;
}

/**
 * Resolve brand config for an app at the given path.
 * Uses the mode-neutral cache (both themes stored per kit).
 * Picks the mode-appropriate theme from the kit's `theme`/`darkTheme`.
 */
export async function resolveBrandConfig(
    env: ResolveBrandConfigEnv,
    opts: ResolveBrandConfigOptions,
): Promise<ResolvedBrandConfig | null> {
    const appId = opts.appId ?? null;
    const path = opts.path ?? '/';
    const mode = opts.mode ?? 'light';
    const skipCache = opts.skipCache ?? false;

    const cache = createBrandCache(env.OBCF_KV);
    const r2Url = env.R2_PUBLIC_URL || '';

    // Try dual-mode cache first
    if (!skipCache) {
        const cached = await cache.getResolutionData(appId, 'all');
        if (cached) {
            const match = resolveRouteForPath(path, cached.routeMappings);
            if (match) {
                const kitData = cached.brandKitsMap[match.brandKitId];
                if (kitData) {
                    return buildConfigFromCache(cached, match, kitData, mode);
                }
            }
        }
    }

    // Load fresh — loadBrandKitsMap resolves both modes
    const layoutData = await getLayoutData(appId);
    const match = resolveRouteForPath(path, layoutData.routeMappings);
    if (!match) return null;

    const brandKitIds = [...new Set(layoutData.routeMappings.map((m) => m.brandKitId))];
    const brandKitsMap = await loadBrandKitsMap(brandKitIds, r2Url);

    const kitData = brandKitsMap[match.brandKitId];
    if (!kitData) return null;

    // Pick mode-appropriate theme
    const baseTheme =
        mode === 'dark' && kitData.darkTheme
            ? (deepMerge(
                  kitData.theme as unknown as Record<string, unknown>,
                  kitData.darkTheme as Record<string, unknown>,
              ) as unknown as typeof kitData.theme)
            : kitData.theme;

    // Apply per-route token overrides when present
    let resolvedTheme = baseTheme;
    if (match.tokenOverridesJson) {
        try {
            const overrides = JSON.parse(match.tokenOverridesJson) as Record<string, unknown>;
            if (overrides && typeof overrides === 'object' && Object.keys(overrides).length > 0) {
                resolvedTheme = deepMerge(
                    resolvedTheme as unknown as Record<string, unknown>,
                    overrides,
                ) as unknown as typeof resolvedTheme;
            }
        } catch {
            /* ignore malformed JSON */
        }
    }

    const config: ResolvedBrandConfig = {
        ...kitData,
        theme: resolvedTheme,
        defaultColorScheme: kitData.defaultColorScheme as 'light' | 'dark' | 'system',
        layoutTemplateId: match.layoutTemplateId,
        layoutTemplatesMap: layoutData.layoutTemplatesMap,
        routeMappings: layoutData.routeMappings,
    };

    if (!skipCache) {
        const cacheData: BrandResolutionCache = {
            routeMappings: layoutData.routeMappings,
            layoutTemplatesMap: layoutData.layoutTemplatesMap,
            brandKitsMap,
        };
        await cache.setResolutionData(appId, 'all', cacheData);
    }

    return config;
}

function buildConfigFromCache(
    cached: BrandResolutionCache,
    match: { layoutTemplateId: string; brandKitId: string; tokenOverridesJson?: string | null },
    kitData: BrandResolutionCache['brandKitsMap'][string],
    mode: string,
): ResolvedBrandConfig {
    // Pick mode-appropriate theme
    let theme =
        mode === 'dark' && kitData.darkTheme
            ? (deepMerge(
                  kitData.theme as unknown as Record<string, unknown>,
                  kitData.darkTheme as Record<string, unknown>,
              ) as unknown as typeof kitData.theme)
            : kitData.theme;

    // Apply per-route token overrides when present
    if (match.tokenOverridesJson) {
        try {
            const overrides = JSON.parse(match.tokenOverridesJson) as Record<string, unknown>;
            if (overrides && typeof overrides === 'object' && Object.keys(overrides).length > 0) {
                theme = deepMerge(theme as unknown as Record<string, unknown>, overrides) as unknown as typeof theme;
            }
        } catch {
            /* ignore malformed JSON – serve base kit theme */
        }
    }
    return {
        brandName: kitData.brandName,
        tagline: kitData.tagline,
        logos: kitData.logos,
        theme,
        defaultColorScheme: kitData.defaultColorScheme as 'light' | 'dark' | 'system',
        allowDarkModeToggle: kitData.allowDarkModeToggle,
        customCss: kitData.customCss,
        hideOttabaseBranding: kitData.hideOttabaseBranding,
        layoutTemplateId: match.layoutTemplateId,
        layoutTemplatesMap: cached.layoutTemplatesMap,
        routeMappings: cached.routeMappings,
    };
}
