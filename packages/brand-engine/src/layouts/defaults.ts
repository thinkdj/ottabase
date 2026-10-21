// ---------------------------------------------------------------------------
// Brand Engine – Shared layout defaults
// ---------------------------------------------------------------------------

/**
 * Default route mappings used as a safety net when no mappings exist in DB.
 * Kept in one place to avoid divergence between server and client fallbacks.
 */
export const DEFAULT_ROUTE_MAPPINGS: Array<{ pathPattern: string; layoutTemplateId: string; priority: number }> = [
    { pathPattern: '/demo/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/admin/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/profile', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/referrals', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/**', layoutTemplateId: 'app-shell', priority: 0 },
];
