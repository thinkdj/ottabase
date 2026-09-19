// ---------------------------------------------------------------------------
// Brand Engine – Shared layout defaults
// ---------------------------------------------------------------------------

/**
 * Default route mappings used as a safety net when no mappings exist in DB.
 * Kept in one place to avoid divergence between server and client fallbacks.
 */
export const DEFAULT_ROUTE_MAPPINGS: Array<{ pathPattern: string; layoutTemplateId: string; priority: number }> = [
    { pathPattern: '/', layoutTemplateId: 'homepage', priority: 20 },
    { pathPattern: '/about', layoutTemplateId: 'homepage', priority: 20 },
    { pathPattern: '/blog/**', layoutTemplateId: 'homepage', priority: 20 },
    { pathPattern: '/login', layoutTemplateId: 'auth', priority: 20 },
    { pathPattern: '/register', layoutTemplateId: 'auth', priority: 20 },
    { pathPattern: '/studio', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/studio/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/demo/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/admin/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/dashboard', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/profile', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/shortlinks', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/referrals', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/organizations/**', layoutTemplateId: 'app-shell', priority: 10 },
    { pathPattern: '/**', layoutTemplateId: 'homepage', priority: 0 },
];
