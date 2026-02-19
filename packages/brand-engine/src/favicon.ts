// ---------------------------------------------------------------------------
// Brand Engine – Favicon helpers
// Icon is typically square and suitable as favicon. Modern browsers accept PNG.
// Future: Cloudflare Images can generate ico, apple-touch-icon from uploaded icon.
// ---------------------------------------------------------------------------

import type { ResolvedBrandConfig } from './persistence/types';

/**
 * Returns the best URL to use for favicon.
 * Prefers icon (square) over primary logo. Use in HTML: <link rel="icon" href={url} />
 */
export function getFaviconUrl(config: ResolvedBrandConfig): string {
    return config.logos?.icon ?? config.logos?.primary ?? '';
}
