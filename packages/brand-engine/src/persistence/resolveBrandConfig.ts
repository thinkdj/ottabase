// ---------------------------------------------------------------------------
// Brand Engine – Resolve brand config (path-aware)
// Resolution: route mappings → match path → Brand Kit + layout
// ---------------------------------------------------------------------------

import type { ResolvedBrandConfig, BrandResolutionCache } from './types';
import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import { BrandKit } from './BrandKit.model';
import { brandKitToTheme, brandKitLogos } from './brandKitToConfig';
import { createBrandCache } from './cache';
import { getLayoutData } from './layoutData';
import { resolveRouteForPath } from '../layouts/resolver';
import type { ResolvedBrandTheme } from '../resolver';
import type { BrandTheme } from '../theme';

export interface ResolveBrandConfigEnv {
    OBCF_D1: D1Database;
    OBCF_KV: KVNamespace;
    OBCF_R2: R2Bucket;
    R2_PUBLIC_URL?: string;
}

export interface ResolveBrandConfigOptions {
    organizationId?: string | null;
    appId?: string | null;
    /** Current pathname – required for path-scoped resolution */
    path: string;
    /** Light/dark mode */
    mode?: 'light' | 'dark';
    /** Skip cache */
    skipCache?: boolean;
}

/** Full resolution data – all route mappings + all brand kits. Client resolves path locally. */
export type FullBrandConfig = BrandResolutionCache & { mode: 'light' | 'dark'; r2PublicUrl?: string };

/**
 * Load and build brand kits map from database.
 * Shared helper for both resolveFullBrandConfig and resolveBrandConfig.
 * Ensures default kit exists if none provided.
 */
async function loadBrandKitsMap(
    brandKitIds: string[],
    mode: 'light' | 'dark',
    r2Url: string,
): Promise<BrandResolutionCache['brandKitsMap']> {
    const brandKitsMap: BrandResolutionCache['brandKitsMap'] = {};

    for (const kitId of brandKitIds) {
        const kit = (await BrandKit.find(kitId)) as BrandKit | null;
        if (!kit) continue;
        const theme = brandKitToTheme(kit, mode);
        const logos = brandKitLogos(kit, r2Url);
        const presetId = (kit.get('themePresetId') as string) || null;
        const tokens = kit.toBrandTheme().tokens;
        const tenantTheme: Partial<BrandTheme> = tokens ? { tokens } : {};
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
            theme,
            themeBase: presetId || 'default',
            tenantTheme,
            defaultColorScheme: (kit.get('defaultColorScheme') as string) || 'system',
            allowDarkModeToggle: (kit.get('allowDarkModeToggle') as boolean) ?? true,
            customCss: (kit.get('customCss') as string) || undefined,
            hideOttabaseBranding: (kit.get('hideOttabaseBranding') as boolean) ?? false,
        };
    }

    // Ensure system default exists if no kits loaded
    if (Object.keys(brandKitsMap).length === 0) {
        const defaultKit = await BrandKit.getOrCreateDefault();
        const defaultKitId = (defaultKit.get('id') as string) || 'default';
        const theme = brandKitToTheme(defaultKit, mode);
        const logos = brandKitLogos(defaultKit, r2Url);
        const presetId = (defaultKit.get('themePresetId') as string) || null;
        const tokens = defaultKit.toBrandTheme().tokens;
        const tenantTheme: Partial<BrandTheme> = tokens ? { tokens } : {};
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
            theme,
            themeBase: presetId || 'default',
            tenantTheme,
            defaultColorScheme: (defaultKit.get('defaultColorScheme') as string) || 'system',
            allowDarkModeToggle: (defaultKit.get('allowDarkModeToggle') as boolean) ?? true,
            customCss: (defaultKit.get('customCss') as string) || undefined,
            hideOttabaseBranding: (defaultKit.get('hideOttabaseBranding') as boolean) ?? false,
        };
    }

    return brandKitsMap;
}

/**
 * Resolve full brand data (route mappings, layouts, all brand kits). No path required.
 * Client uses resolveRouteForPath(path, routeMappings) then brandKitsMap[match.brandKitId].
 */
export async function resolveFullBrandConfig(
    env: ResolveBrandConfigEnv,
    opts: Omit<ResolveBrandConfigOptions, 'path'> & { path?: string },
): Promise<FullBrandConfig | null> {
    const orgId = opts.organizationId ?? null;
    const appId = opts.appId ?? null;
    const mode = opts.mode ?? 'light';
    const skipCache = opts.skipCache ?? false;

    const cache = createBrandCache(env.OBCF_KV);
    const r2Url = env.R2_PUBLIC_URL || '';

    if (!skipCache) {
        const cached = await cache.getResolutionData(orgId, appId, mode);
        if (cached) return { ...cached, mode, r2PublicUrl: r2Url };
    }

    const layoutData = await getLayoutData(orgId, appId);
    const brandKitIds = [...new Set(layoutData.routeMappings.map((m) => m.brandKitId))];
    const brandKitsMap = await loadBrandKitsMap(brandKitIds, mode, r2Url);

    const cacheData: BrandResolutionCache = {
        routeMappings: layoutData.routeMappings,
        layoutTemplatesMap: layoutData.layoutTemplatesMap,
        brandKitsMap,
    };
    const fullConfig: FullBrandConfig = {
        ...cacheData,
        mode,
        r2PublicUrl: r2Url,
    };

    if (!skipCache) {
        await cache.setResolutionData(orgId, appId, mode, cacheData);
    }
    return fullConfig;
}

/**
 * Resolve brand config for org/app at the given path.
 */
export async function resolveBrandConfig(
    env: ResolveBrandConfigEnv,
    opts: ResolveBrandConfigOptions,
): Promise<ResolvedBrandConfig | null> {
    const orgId = opts.organizationId ?? null;
    const appId = opts.appId ?? null;
    const path = opts.path ?? '/';
    const mode = opts.mode ?? 'light';
    const skipCache = opts.skipCache ?? false;

    const cache = createBrandCache(env.OBCF_KV);
    const r2Url = env.R2_PUBLIC_URL || '';

    // Try cache
    if (!skipCache) {
        const cached = await cache.getResolutionData(orgId, appId, mode);
        if (cached) {
            const match = resolveRouteForPath(path, cached.routeMappings);
            if (match) {
                const kitData = cached.brandKitsMap[match.brandKitId];
                if (kitData) {
                    return buildConfigFromCache(cached, match, kitData, path);
                }
            }
        }
    }

    // Load fresh
    const layoutData = await getLayoutData(orgId, appId);
    const match = resolveRouteForPath(path, layoutData.routeMappings);
    if (!match) return null;

    const brandKitIds = [...new Set(layoutData.routeMappings.map((m) => m.brandKitId))];
    const brandKitsMap = await loadBrandKitsMap(brandKitIds, mode, r2Url);

    const kitData = brandKitsMap[match.brandKitId];
    if (!kitData) return null;

    const config: ResolvedBrandConfig = {
        ...kitData,
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
        await cache.setResolutionData(orgId, appId, mode, cacheData);
    }

    return config;
}

function buildConfigFromCache(
    cached: BrandResolutionCache,
    match: { layoutTemplateId: string; brandKitId: string },
    kitData: BrandResolutionCache['brandKitsMap'][string],
    _path: string,
): ResolvedBrandConfig {
    return {
        brandName: kitData.brandName,
        tagline: kitData.tagline,
        logos: kitData.logos,
        theme: kitData.theme,
        themeBase: kitData.themeBase,
        tenantTheme: kitData.tenantTheme,
        defaultColorScheme: kitData.defaultColorScheme as 'light' | 'dark' | 'system',
        allowDarkModeToggle: kitData.allowDarkModeToggle,
        customCss: kitData.customCss,
        hideOttabaseBranding: kitData.hideOttabaseBranding,
        layoutTemplateId: match.layoutTemplateId,
        layoutTemplatesMap: cached.layoutTemplatesMap,
        routeMappings: cached.routeMappings,
    };
}
