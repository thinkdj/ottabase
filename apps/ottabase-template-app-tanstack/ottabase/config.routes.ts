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

import type { ApiRouteContext } from '../worker/routes/router';

/**
 * Handle custom / premium package API routes.
 *
 * Called by the framework router after all built-in routes.
 * Return a Response to handle the route, or null to skip.
 */
export async function handleCustomRoutes(context: ApiRouteContext): Promise<Response | null> {
    // const { route, method } = context;

    // Add your custom route handlers here.
    // Example:
    //   if (route === '/api/my-feature' && method === 'GET') {
    //       return new Response(JSON.stringify({ hello: 'world' }), {
    //           headers: { 'Content-Type': 'application/json' },
    //       });
    //   }

    return null;
}
