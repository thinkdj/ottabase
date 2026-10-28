// ============================================================
// Social images (@ottabase/og): the card behind every shared link
// ============================================================
// `GET /api/og/image?…&sig=` draws a 1200 by 630 card through Browser Rendering and keeps it in
// R2. The worker signs the URLs it emits (blog posts without a hero image, see
// worker/lib/blog-seo-inject.ts); the route renders nothing it did not sign. The defaults come
// from the brand kit: the brand name, its logo and its primary color.
// ============================================================

import { hslToHex } from '@ottabase/brand-engine';
import { resolveConfigFromFull, resolveFullBrandConfig } from '@ottabase/brand-engine/persistence';
import { createOgPackage, httpUrl, type OgCard } from '@ottabase/og';
import { brandEnv } from '../../worker/lib/brand-utils';
import { getOttabaseConfig } from '../config.loader';

/** `156 51.7% 34.1%` (a theme token) as `#rrggbb`. */
function tokenToHex(token: unknown): string | undefined {
    const parts = typeof token === 'string' ? token.trim().split(/\s+/).map(parseFloat) : [];
    if (parts.length !== 3 || parts.some(Number.isNaN)) return undefined;
    return hslToHex(parts[0]!, parts[1]!, parts[2]!);
}

/** The app's name and host, and the brand kit's name, logo and color when there is one. */
async function brandDefaults(env: CloudflareEnv, request: Request): Promise<Partial<OgCard>> {
    const config = getOttabaseConfig(env);
    const base: Partial<OgCard> = { siteName: config.appName, domain: new URL(request.url).host };
    try {
        const full = await resolveFullBrandConfig(brandEnv(env), { appId: config.appId });
        const brand = full ? resolveConfigFromFull(full, '/', 'light') : null;
        if (!brand) return base;
        return {
            ...base,
            siteName: brand.brandName || base.siteName,
            accent: tokenToHex(brand.theme.colors.primary),
            logoUrl: httpUrl(brand.logos.primary) ?? undefined,
        };
    } catch {
        return base;
    }
}

export const ogPackage = createOgPackage<CloudflareEnv>({
    getBrowserBinding: (env) => env.OBCF_BROWSER,
    getBucket: (env) => env.OBCF_R2,
    secret: (env) => env.AUTH_SECRET,
    defaults: brandDefaults,
});
