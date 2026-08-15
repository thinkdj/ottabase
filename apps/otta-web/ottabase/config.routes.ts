// ============================================================
// CUSTOM ROUTE REGISTRATION  (User-zone)
// ============================================================
// Register API routes for your custom or premium packages here.
// This file is called by the framework router AFTER all built-in
// routes. Return a Response to handle a route, or null to skip.
//
// ── How it works ─────────────────────────────────────────────
// The framework router tries built-in routes first. If none match,
// it calls `handleCustomRoutes(context)`. Your handler receives the
// same ApiRouteContext that all framework route handlers use.
//
// ── Adding a custom route ────────────────────────────────────
//   1. Import your handler (from a premium package or local file).
//   2. Match on `context.route` and `context.method`.
//   3. Return a Response, or null to fall through.
//
// Example:
//   import { handlePremiumDashboard } from '@myorg/premium-dashboard';
//
//   export async function handleCustomRoutes(context: ApiRouteContext): Promise<Response | null> {
//       const { route, method } = context;
//
//       if (route === '/api/premium/dashboard' && method === 'GET') {
//           return handlePremiumDashboard(context);
//       }
//
//       if (route.startsWith('/api/premium/reports')) {
//           return handlePremiumReports(context);
//       }
//
//       return null;
//   }
// ============================================================

import type { BrowserWorker } from '@cloudflare/puppeteer';
import { CF_PDF_BASE_PATH, DEFAULT_PDF_RESOURCE_ORIGINS } from '@ottabase/cf-pdf';
import { createCfPdfRequestHandler } from '@ottabase/cf-pdf/router';
import { handleMediaLibraryPurge } from '../worker/routes/media-library';
import type { ApiRouteContext } from '../worker/routes/router';

/**
 * Cloudflare PDF export. The package owns the request contract and render policy;
 * this host adapter owns verified sessions, the Browser Rendering binding, and the
 * app's rate-limit policy.
 */
const handleCfPdfRequest = createCfPdfRequestHandler<ApiRouteContext['env']>({
    resolveCaller: async (request, env) => {
        const [{ getSession }, { getAuthOptions }] = await Promise.all([
            import('@ottabase/auth/backend'),
            import('../worker/lib/auth-utils'),
        ]);
        const session = await getSession(request, env as never, getAuthOptions(env));
        return session?.user?.id ? { userId: session.user.id } : null;
    },
    getBrowserBinding: (env) => env.OBCF_BROWSER as unknown as BrowserWorker | undefined,
    loadPuppeteer: async () => (await import('@cloudflare/puppeteer')).default,
    // Browser Rendering is expensive, so scope the host's existing limiter by user.
    // Deployments with a dedicated limiter can replace this callback without changing
    // the package or its route contract.
    rateLimit: (request, env, caller) =>
        import('../worker/lib/rate-limiting').then(({ enforceRateLimit }) =>
            enforceRateLimit(request, env, `cf-pdf:${caller.userId}`),
        ),
    getResourceOrigins: (request) => {
        const origin = new URL(request.url).origin;
        return origin.startsWith('https:') ? [origin, ...DEFAULT_PDF_RESOURCE_ORIGINS] : DEFAULT_PDF_RESOURCE_ORIGINS;
    },
    renderOptions: {
        format: 'Letter',
        viewportWidth: 816,
        viewportHeight: 1056,
        fontTimeoutMs: 3_000,
        renderTimeoutMs: 20_000,
        maxHtmlBytes: 700 * 1024,
        maxPdfBytes: 10 * 1024 * 1024,
    },
    metadata: {
        creator: 'Ottabase',
        producer: 'Ottabase PDF',
    },
});

/**
 * Handle custom / premium package API routes.
 *
 * Called by the framework router after all built-in routes.
 * Return a Response to handle the route, or null to skip.
 */
export async function handleCustomRoutes(context: ApiRouteContext): Promise<Response | null> {
    const { route, method } = context;

    if (route === CF_PDF_BASE_PATH && method === 'POST') {
        return handleCfPdfRequest(context.request, context.env);
    }

    // Media library routes (media is a core table, always available)
    const mediaPurgeMatch = route.match(/^\/api\/medialibrary\/([^/]+)\/purge$/);
    if (method === 'DELETE' && mediaPurgeMatch) {
        return handleMediaLibraryPurge(context, decodeURIComponent(mediaPurgeMatch[1]));
    }

    return null;
}
