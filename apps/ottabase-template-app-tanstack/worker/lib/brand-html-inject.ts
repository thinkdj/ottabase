// ---------------------------------------------------------------------------
// Brand Engine – Critical CSS injection for HTML responses (Zero FOUC)
// Injects :root CSS vars into <head> before first paint
// ---------------------------------------------------------------------------

import { resolveBrandConfig } from '@ottabase/brand-engine/persistence';
import { buildCriticalStyleTag } from '@ottabase/brand-engine';
import type { CloudflareEnv } from '../../cloudflare-env';

export interface BrandHtmlInjectEnv {
    OBCF_D1: CloudflareEnv['OBCF_D1'];
    OBCF_KV: CloudflareEnv['OBCF_KV'];
    OBCF_R2: CloudflareEnv['OBCF_R2'];
    R2_PUBLIC_URL?: string;
}

/**
 * If response is HTML, fetch brand config and inject critical CSS into <head>.
 * Returns original response if not HTML or on error.
 */
export async function injectBrandCriticalCSS(
    response: Response,
    request: Request,
    env: BrandHtmlInjectEnv,
): Promise<Response> {
    const contentType = response.headers.get('Content-Type') ?? '';
    if (!contentType.includes('text/html') || !response.ok) return response;

    try {
        const url = new URL(request.url);
        const config = await resolveBrandConfig(env, {
            organizationId: url.searchParams.get('organizationId') ?? null,
            appId: url.searchParams.get('appId') ?? null,
            brandPreview: url.searchParams.get('brandPreview') ?? undefined,
            themeVariant: url.searchParams.get('themeVariant') ?? undefined,
        });
        if (!config?.theme) return response;

        const html = await response.text();
        const criticalTag = buildCriticalStyleTag(config.theme);
        const injectedHtml = html.replace('</head>', `${criticalTag}\n    </head>`);
        return new Response(injectedHtml, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });
    } catch {
        return response;
    }
}
