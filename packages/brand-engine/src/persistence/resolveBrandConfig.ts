// ---------------------------------------------------------------------------
// Brand Engine – Resolve brand config (shared by API and Edge/SSR)
// Resolution order: brandPreview → Active preset → Default settings
// ---------------------------------------------------------------------------

import type { ResolvedBrandConfig } from './types';
import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';

export interface ResolveBrandConfigEnv {
    OBCF_D1: D1Database;
    OBCF_KV: KVNamespace;
    OBCF_R2: R2Bucket;
    R2_PUBLIC_URL?: string;
}
import { BrandSettings } from './BrandSettings.model';
import { ThemeVariant } from './ThemeVariant.model';
import { brandSettingsToConfig } from './brandSettingsToConfig';
import { createBrandCache } from './cache';
import { getLayoutData } from './layoutData';

export interface ResolveBrandConfigOptions {
    organizationId?: string | null;
    appId?: string | null;
    brandPreview?: string | null;
    themeVariant?: string | null;
    /** Light/dark mode for theme resolution */
    mode?: 'light' | 'dark';
    userId?: string | null;
    /** Skip cache (for preview/variant) */
    skipCache?: boolean;
}

/**
 * Resolve brand config for org/app. Used by GET /api/brand and Edge HTML injection.
 */
export async function resolveBrandConfig(
    env: ResolveBrandConfigEnv,
    opts: ResolveBrandConfigOptions,
): Promise<ResolvedBrandConfig | null> {
    const orgId = opts.organizationId ?? null;
    const appId = opts.appId ?? null;
    const brandPreview = opts.brandPreview ?? undefined;
    const themeVariantParam = opts.themeVariant ?? undefined;
    const mode = opts.mode ?? 'light';
    const skipCache = opts.skipCache ?? !!(brandPreview || themeVariantParam);
    const useCache = !skipCache;

    const cache = createBrandCache(env.OBCF_KV);
    const r2Url = env.R2_PUBLIC_URL || '';

    if (useCache) {
        const cached = await cache.get(orgId, appId, brandPreview ?? undefined, mode);
        if (cached) return cached;
    }

    // 1. Preview mode
    if (brandPreview) {
        const preset = (await BrandSettings.find(brandPreview)) as BrandSettings | null;
        if (preset) {
            const pOrg = preset.get('organizationId') as string | null;
            const pApp = preset.get('appId') as string | null;
            if (pOrg === orgId && pApp === (appId ?? null)) {
                const themeVariantTokens = await resolveThemeVariantTokens(preset, themeVariantParam, orgId, appId);
                const layoutData = await getLayoutData(orgId, appId);
                const config = brandSettingsToConfig(preset, r2Url, mode, layoutData, themeVariantTokens);
                if (useCache) await cache.set(orgId, appId || null, config, brandPreview, mode);
                return config;
            }
        }
    }

    // 2. Active preset
    const activePreset = await BrandSettings.findActive(orgId, appId);
    if (activePreset) {
        const themeVariantTokens = await resolveThemeVariantTokens(activePreset, themeVariantParam, orgId, appId);
        const layoutData = await getLayoutData(orgId, appId);
        const config = brandSettingsToConfig(activePreset, r2Url, mode, layoutData, themeVariantTokens);
        if (useCache) await cache.set(orgId, appId || null, config, undefined, mode);
        return config;
    }

    // 3. Default settings fallback
    const settings = await BrandSettings.resolve(orgId, appId, opts.userId ?? undefined);
    if (!settings) return null;

    const themeVariantTokens = await resolveThemeVariantTokens(settings, themeVariantParam, orgId, appId);
    const layoutData = await getLayoutData(orgId, appId);
    const config = brandSettingsToConfig(settings, r2Url, mode, layoutData, themeVariantTokens);

    if (useCache) await cache.set(orgId, appId || null, config, undefined, mode);
    return config;
}

/** Resolve theme variant tokens from param, preset's themeVariantId, or F3 auto (findActiveForDate) */
async function resolveThemeVariantTokens(
    settings: BrandSettings,
    themeVariantParam: string | undefined,
    orgId: string | null,
    appId: string | null,
): Promise<Partial<import('../tokens').DesignTokens> | undefined> {
    if (themeVariantParam) {
        if (themeVariantParam === 'active') {
            const active = await ThemeVariant.findActiveForDate(orgId, appId);
            return active?.getTokens();
        }
        const variant = (await ThemeVariant.find(themeVariantParam)) as ThemeVariant | null;
        if (variant) {
            const vOrg = variant.get('organizationId') as string | null;
            const vApp = variant.get('appId') as string | null;
            if (vOrg === orgId && vApp === (appId ?? null)) return variant.getTokens();
        }
        return undefined;
    }
    const themeVariantId = settings.get('themeVariantId') as string | null;
    if (themeVariantId) {
        const variant = (await ThemeVariant.find(themeVariantId)) as ThemeVariant | null;
        if (variant) return variant.getTokens();
    }
    // F3: Automatic themes - apply date-based variant when none specified
    const activeForDate = await ThemeVariant.findActiveForDate(orgId, appId);
    return activeForDate?.getTokens();
}
