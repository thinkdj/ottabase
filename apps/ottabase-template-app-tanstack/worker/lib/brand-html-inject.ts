// ---------------------------------------------------------------------------
// Brand Engine – Critical CSS injection for HTML responses (Zero FOUC)
// Injects :root + .dark CSS vars into <head> before first paint.
// Dual mode ensures brand theme applies universally on first paint for both light/dark.
// ---------------------------------------------------------------------------

import { buildCriticalStyleTagDual } from '@ottabase/brand-engine';
import { resolveBrandConfig } from '@ottabase/brand-engine/persistence';
import type { CloudflareEnv } from '../../cloudflare-env';

export interface BrandHtmlInjectEnv {
    OBCF_D1: CloudflareEnv['OBCF_D1'];
    OBCF_KV: CloudflareEnv['OBCF_KV'];
    OBCF_R2: CloudflareEnv['OBCF_R2'];
    R2_PUBLIC_URL?: string;
}

/**
 * If response is HTML, fetch brand config and inject critical CSS (light + dark) into <head>.
 * Returns original response if not HTML or on error.
 * Dual theme ensures correct palette on first paint regardless of user color scheme.
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
        const path = url.pathname || '/';
        const config = await resolveBrandConfig(env, {
            appId: url.searchParams.get('appId') ?? request.headers.get('x-app-id') ?? null,
            path,
            mode: 'light', // Used for initial load; both palettes injected below
        });
        if (!config?.theme) return response;

        // Use pre-resolved themes from server (already merged preset + tenant overrides)
        const lightTheme = config.theme;
        const darkTheme = config.darkTheme ?? config.theme;

        const html = await response.text();
        const criticalTag = buildCriticalStyleTagDual(lightTheme, darkTheme);
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
