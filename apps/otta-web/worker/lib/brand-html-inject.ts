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

        // FIX: Clone before consuming body to prevent "Body has already been used" errors.
        // Problem: If we call response.text() and then something throws (e.g., theme
        // rendering fails), the catch block would return the original response whose
        // body is already consumed. Cloudflare Workers cannot stream a consumed body,
        // causing HTTP 500 (Error 1101) on any HTML page (e.g., /blog/demo-content).
        // Solution: Clone first — read from clone, keep original intact for fallback.
        const [forRead, fallback] = [response.clone(), response];
        const html = await forRead.text();
        const criticalTag = buildCriticalStyleTagDual(lightTheme, darkTheme);
        const injectedHtml = html.replace('</head>', `${criticalTag}\n    </head>`);
        return new Response(injectedHtml, {
            status: fallback.status,
            statusText: fallback.statusText,
            headers: fallback.headers,
        });
    } catch {
        // Safe: `response` (aliased as `fallback`) was never consumed — only the clone was.
        return response;
    }
}
