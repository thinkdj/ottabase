// ---------------------------------------------------------------------------
// Brand Engine – Resolve brand config (shared by API and Edge/SSR)
// Resolution order: brandPreview → Active BrandBox → BrandSettings
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
import { BrandBox } from './BrandBox.model';
import { ThemeVariant } from './ThemeVariant.model';
import { brandSettingsToConfig } from './brandSettingsToConfig';
import { brandBoxToConfig } from './brandBoxToConfig';
import { createBrandCache } from './cache';
import { getLayoutData } from './layoutData';

export interface ResolveBrandConfigOptions {
    organizationId?: string | null;
    appId?: string | null;
    brandPreview?: string | null;
    themeVariant?: string | null;
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
    const skipCache = opts.skipCache ?? !!(brandPreview || themeVariantParam);
    const useCache = !skipCache;

    const cache = createBrandCache(env.OBCF_KV);
    const r2Url = env.R2_PUBLIC_URL || '';

    if (useCache) {
        const cached = await cache.get(orgId, appId, brandPreview ?? undefined);
        if (cached) return cached;
    }

    // 1. Preview mode
    if (brandPreview) {
        const box = (await BrandBox.find(brandPreview)) as InstanceType<typeof BrandBox> | null;
        if (box) {
            const bOrg = box.get('organizationId') as string | null;
            const bApp = box.get('appId') as string | null;
            if (bOrg === orgId && bApp === (appId ?? null)) {
                const config = await brandBoxToConfig(box, r2Url, 'light');
                if (useCache) await cache.set(orgId, appId || null, config, brandPreview);
                return config;
            }
        }
    }

    // 2. Active BrandBox
    const activeBox = await BrandBox.findActive(orgId, appId);
    if (activeBox) {
        const config = await brandBoxToConfig(activeBox, r2Url, 'light');
        if (useCache) await cache.set(orgId, appId || null, config);
        return config;
    }

    // 3. BrandSettings fallback
    const settings = await BrandSettings.resolve(orgId, appId, opts.userId ?? undefined);
    if (!settings) return null;

    let themeVariantTokens: Partial<import('../tokens').DesignTokens> | undefined;
    if (themeVariantParam) {
        if (themeVariantParam === 'active') {
            const active = await ThemeVariant.findActiveForDate(orgId, appId);
            if (active) themeVariantTokens = active.getTokens();
        } else {
            const variant = (await ThemeVariant.find(themeVariantParam)) as ThemeVariant | null;
            if (variant) {
                const vOrg = variant.get('organizationId') as string | null;
                const vApp = variant.get('appId') as string | null;
                if (vOrg === orgId && vApp === (appId ?? null)) {
                    themeVariantTokens = variant.getTokens();
                }
            }
        }
    }

    const layoutData = await getLayoutData(orgId, appId);
    const config = brandSettingsToConfig(settings, r2Url, 'light', layoutData, themeVariantTokens);

    if (useCache) await cache.set(orgId, appId || null, config);
    return config;
}
