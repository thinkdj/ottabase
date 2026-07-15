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
import { getMenuSlotData } from './menuSlotData';
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
    /**
     * Skip the cache READ, forcing a fresh D1 load (e.g. right after an
     * invalidation, where KV's eventual consistency could still serve stale
     * data). The freshly loaded result is always written back to cache
     * afterward — there is no "resolve but don't cache" mode.
     */
    skipCacheRead?: boolean;
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
    opts: ResolveBrandConfigOptions,
): Promise<FullBrandConfig | null> {
    const appId = opts.appId ?? null;
    const skipCacheRead = opts.skipCacheRead ?? false;

    const cache = createBrandCache(env.OBCF_KV);
    const r2Url = env.R2_PUBLIC_URL || '';

    // Dual-mode: cache is mode-neutral (both themes stored per kit)
    if (!skipCacheRead) {
        const cached = await cache.getResolutionData(appId, 'all');
        if (cached)
            return {
                ...cached,
                menuSlots: cached.menuSlots ?? {},
                r2PublicUrl: r2Url,
            };
    }

    const layoutData = await getLayoutData(appId);
    const brandKitIds = [...new Set(layoutData.routeMappings.map((m) => m.brandKitId))];
    const [brandKitsMap, menuSlots] = await Promise.all([loadBrandKitsMap(brandKitIds, r2Url), getMenuSlotData(appId)]);

    const cacheData: BrandResolutionCache = {
        routeMappings: layoutData.routeMappings,
        layoutTemplatesMap: layoutData.layoutTemplatesMap,
        menuSlots,
        brandKitsMap,
    };
    const fullConfig: FullBrandConfig = {
        ...cacheData,
        r2PublicUrl: r2Url,
    };

    // Always cache a freshly loaded result — including when skipCacheRead
    // forced this fresh load — so callers that intentionally bypassed a
    // possibly-stale read (e.g. warmBrandCache after invalidation) actually
    // leave the cache warm instead of a no-op.
    await cache.setResolutionData(appId, 'all', cacheData);
    return fullConfig;
}

/**
 * Derive a path-scoped config from an already-resolved full config — pure CPU,
 * no KV/D1 access. Mirrors the client's resolveConfigForPath (route match →
 * kit lookup with deleted-kit fallback → mode merge → route token overrides),
 * so edge-injected critical CSS and client hydration agree exactly.
 */
export function resolveConfigFromFull(
    full: BrandResolutionCache,
    path: string,
    mode: string,
): ResolvedBrandConfig | null {
    const match = resolveRouteForPath(path, full.routeMappings) ?? {
        layoutTemplateId: 'homepage',
        brandKitId: Object.keys(full.brandKitsMap)[0],
        tokenOverridesJson: undefined,
    };
    const kitData = full.brandKitsMap[match.brandKitId] ?? Object.values(full.brandKitsMap)[0];
    if (!kitData) return null;
    return buildConfigFromCache(full, match, kitData, mode);
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
        menuSlots: cached.menuSlots,
    };
}
