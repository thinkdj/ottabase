// ============================================================
// Shortlink Fallback Handler (ResumeMe)
// ============================================================
// Resolves vanity short-code URLs to their target via redirect.
// Paths starting with /r/ are reserved for the client-side
// public resume viewer and are NOT intercepted here.
// ============================================================

import { Shortlink, buildRedirectResponse } from '@ottabase/shortlinks';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import type { CloudflareEnv } from '../../cloudflare-env';

export interface ShortlinkContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

/**
 * Attempt to resolve the current path as a shortlink vanity URL.
 * Returns a redirect Response if matched, or null to let the SPA handle it.
 *
 * Skips: /api/*, /@*, /r/*, static assets, root path.
 */
export async function handleShortlinkFallback(context: ShortlinkContext): Promise<Response | null> {
    const { env, request, url } = context;

    if (!getOttabaseConfig(env).packages.shortlinks) {
        return null;
    }

    if (
        !env.OBCF_D1 ||
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/@') ||
        url.pathname.startsWith('/r/') ||
        url.pathname === '/' ||
        /\.[a-zA-Z0-9]+$/.test(url.pathname)
    ) {
        return null;
    }

    const shortCode = url.pathname.substring(1);
    const shortlink = await Shortlink.findByCode(shortCode);
    if (!shortlink) {
        return null;
    }

    return buildRedirectResponse(shortlink);
}
