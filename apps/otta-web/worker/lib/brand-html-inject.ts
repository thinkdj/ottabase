// ---------------------------------------------------------------------------
// Brand Engine – Critical CSS injection for HTML responses (Zero FOUC)
// Injects :root + .dark CSS vars into <head> before first paint, plus the full
// resolved brand config as a JSON script tag so the client hydrates without
// re-fetching /api/brand.
// ---------------------------------------------------------------------------

import {
    buildCriticalStyleTagDual,
    buildCustomCssStyleTag,
    buildEffectsStyleTag,
    buildInitialConfigScriptTag,
} from '@ottabase/brand-engine';
import { resolveConfigFromFull, resolveFullBrandConfig } from '@ottabase/brand-engine/persistence';
import { sanitizeCssForStyleTag } from '@ottabase/utils/sanitize';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import type { CloudflareEnv } from '../../cloudflare-env';

/**
 * Font stylesheet <link> tags for every typography-role URL (both palettes) so
 * brand fonts load with the document instead of after client hydration (FOUT
 * fix). Deduplicated; URLs are escaped for the href attribute.
 */
function buildFontLinkTags(themes: Array<Record<string, unknown> | undefined>): string {
    const urls = new Set<string>();
    for (const theme of themes) {
        const typography = theme?.typography as Record<string, { url?: string }> | undefined;
        if (!typography) continue;
        for (const settings of Object.values(typography)) {
            const url = settings?.url;
            if (url && /^https:\/\//.test(url)) urls.add(url);
        }
    }
    return [...urls].map((url) => `<link rel="stylesheet" href="${url.replace(/"/g, '&quot;')}">`).join('\n    ');
}

export interface BrandHtmlInjectEnv {
    OBCF_D1: CloudflareEnv['OBCF_D1'];
    OBCF_KV: CloudflareEnv['OBCF_KV'];
    OBCF_R2: CloudflareEnv['OBCF_R2'];
    R2_PUBLIC_URL?: string;
}

/**
 * If response is HTML, resolve the brand config once and inject into <head>:
 * critical CSS (light + dark palettes) and the full config as a hydration
 * payload. Returns original response if not HTML or on error.
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
        // The worker's configured app id — the same source the client bundle
        // resolves APP_ID from. Request-derived hints (?appId=, X-App-Id) are
        // deliberately NOT consulted: a normal document navigation never
        // carries them, and getOttabaseConfig guarantees a non-empty appId,
        // so any fallback would be dead code.
        const appId = getOttabaseConfig(env as unknown as Record<string, unknown>).appId;

        // Single resolution serves both the critical CSS and the hydration
        // payload — no duplicate KV reads, no version skew between the two.
        const fullConfig = await resolveFullBrandConfig(env, { appId });
        if (!fullConfig) return response;

        // Path-scoped themes (route token overrides applied) for first paint;
        // mirrors exactly what the client derives from the same full config.
        const lightConfig = resolveConfigFromFull(fullConfig, path, 'light');
        if (!lightConfig?.theme) return response;
        const darkConfig = resolveConfigFromFull(fullConfig, path, 'dark');
        const lightTheme = lightConfig.theme;
        const darkTheme = darkConfig?.theme ?? lightTheme;

        // FIX: Clone before consuming body to prevent "Body has already been used" errors.
        // Problem: If we call response.text() and then something throws (e.g., theme
        // rendering fails), the catch block would return the original response whose
        // body is already consumed. Cloudflare Workers cannot stream a consumed body,
        // causing HTTP 500 (Error 1101) on any HTML page (e.g., /blog/demo-content).
        // Solution: Clone first — read from clone, keep original intact for fallback.
        const [forRead, fallback] = [response.clone(), response];
        const html = await forRead.text();
        // Sanitized: v2 token values (palette, shadow strings, …) are
        // admin-authored free-form CSS values.
        let headInjection = buildCriticalStyleTagDual(lightTheme, darkTheme, sanitizeCssForStyleTag);

        // Brand font stylesheets — load with the document, not after hydration
        const fontLinks = buildFontLinkTags([
            lightTheme as unknown as Record<string, unknown>,
            darkTheme as unknown as Record<string, unknown>,
        ]);
        if (fontLinks) headInjection += `\n    ${fontLinks}`;

        // Generated effects stylesheet (@font-face, @keyframes, text styles,
        // link contract, effect utilities, theme css) — '' for themes that use
        // none. Sanitized: effects.css is theme-authored.
        const effectsTag = buildEffectsStyleTag(lightTheme, sanitizeCssForStyleTag);
        if (effectsTag) headInjection += `\n    ${effectsTag}`;

        // Per-kit custom CSS — previously client-only behind a 300ms debounce
        // (visible FOUC for radically themed kits). Tenant-authored, so it is
        // sanitized before entering the document.
        if (lightConfig.customCss) {
            const customTag = buildCustomCssStyleTag(sanitizeCssForStyleTag(lightConfig.customCss));
            if (customTag) headInjection += `\n    ${customTag}`;
        }

        // Hydration handoff: embed the resolved config (+ the appId it was
        // resolved for) so BrandProvider skips its /api/brand mount fetch.
        // Best effort — if serialization fails, critical CSS still lands and
        // the client falls back to its normal fetch.
        try {
            headInjection += `\n    ${buildInitialConfigScriptTag({ ...fullConfig, appId })}`;
        } catch {
            // Hydration payload is a pure optimization — critical CSS above is unaffected.
        }

        // Replacer FUNCTION, not a replacement string: the payload carries
        // tenant-authored free text (tagline, customCss, …) where sequences
        // like $' or $$ would otherwise be expanded by String.replace and
        // corrupt the document.
        const injectedHtml = html.replace('</head>', () => `${headInjection}\n    </head>`);

        // The injected HTML embeds per-request-resolved brand state, so it
        // must never be served stale: strip the asset's validators (otherwise
        // the browser 304-revalidates against the ORIGINAL asset and keeps
        // old injected config forever) and forbid caching outright.
        const headers = new Headers(fallback.headers);
        headers.delete('ETag');
        headers.delete('Last-Modified');
        headers.set('Cache-Control', 'no-store');

        return new Response(injectedHtml, {
            status: fallback.status,
            statusText: fallback.statusText,
            headers,
        });
    } catch {
        // Safe: `response` (aliased as `fallback`) was never consumed — only the clone was.
        return response;
    }
}
