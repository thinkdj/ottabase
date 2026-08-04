// ============================================================
// @ottabase/premium/server — the control-plane API
// ============================================================
// `/api/premium/*` — what is installed, what state it is in, and the two writes an
// operator needs: paste a license, remove a license.
//
// AUTHORIZATION IS INJECTED, never assumed. This package has no idea what an admin is
// in the host app, so the host passes `requireAdmin` (and optionally a looser
// `requireViewer`) and the routes call it. A framework that shipped its own notion of
// "admin" would be a second, silently-diverging copy of the app's RBAC.
// ============================================================

import { Router, type Ctx } from '@ottabase/ottarouter';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { PremiumRegistry } from '../registry';

/** A guard: return a Response to refuse, or null to allow. */
export type PremiumRouteGuard<Env> = (c: Ctx<Env>) => Promise<Response | null> | Response | null;

export interface PremiumAdminRouterOptions<Env> {
    /** Gate for every mutation (activate, deactivate, uninstall, refresh). Required. */
    requireAdmin: PremiumRouteGuard<Env>;
    /**
     * Gate for the read-only status endpoints. Defaults to `requireAdmin`.
     *
     * Loosen this to "any signed-in user" when the client needs entitlement state to
     * render gates — the payload is the customer's own plan/limits, never a license key.
     */
    requireViewer?: PremiumRouteGuard<Env>;
}

/** Max license length accepted on the wire. A signed P-256 token is ~400 bytes. */
const MAX_LICENSE_LENGTH = 8192;

async function readJsonBody<T>(request: Request): Promise<T> {
    try {
        return ((await request.json()) as T) ?? ({} as T);
    } catch {
        return {} as T;
    }
}

/**
 * Build the `/api/premium` sub-router. Mount it wherever the host keeps its API:
 *
 * ```typescript
 * apiRouter.mount('/api/premium', createPremiumAdminRouter(premium, { requireAdmin }));
 * ```
 */
export function createPremiumAdminRouter<Env>(
    registry: PremiumRegistry<Env>,
    options: PremiumAdminRouterOptions<Env>,
): Router<Env> {
    const requireViewer = options.requireViewer ?? options.requireAdmin;
    const router = new Router<Env>();

    // ── Read ────────────────────────────────────────────────────
    router.get('/packages', async (c) => {
        const denied = await requireViewer(c);
        if (denied) return denied;
        return jsonResponse({ data: await registry.statuses(c.env) });
    });

    router.get('/packages/:key', async (c) => {
        const denied = await requireViewer(c);
        if (denied) return denied;
        const status = await registry.status(c.env, c.params.key);
        return status ? jsonResponse({ data: status }) : errorResponse('Package not installed', 404);
    });

    // ── Write ───────────────────────────────────────────────────
    router.post('/packages/:key/license', async (c) => {
        const denied = await options.requireAdmin(c);
        if (denied) return denied;

        const body = await readJsonBody<{ license?: unknown }>(c.req);
        const license = typeof body.license === 'string' ? body.license.trim() : '';
        if (!license) {
            return errorResponse('A license key is required', 400, { code: 'LICENSE_REQUIRED' });
        }
        if (license.length > MAX_LICENSE_LENGTH) {
            return errorResponse('License key is too long', 400, { code: 'LICENSE_TOO_LONG' });
        }

        const status = await registry.activate(c.env, c.params.key, license);
        if (!status) return errorResponse('Package not installed', 404);

        // A key that fails verification is NOT a server error — it is the single most
        // common operator mistake (wrong package, wrong app, pasted with a line break).
        // Answering 422 with the machine-readable reason is what lets the UI say which.
        if (!status.enabled) {
            return jsonResponse({ data: status, error: status.reason }, 422);
        }
        return jsonResponse({ data: status });
    });

    router.delete('/packages/:key/license', async (c) => {
        const denied = await options.requireAdmin(c);
        if (denied) return denied;
        const status = await registry.deactivate(c.env, c.params.key);
        return status ? jsonResponse({ data: status }) : errorResponse('Package not installed', 404);
    });

    router.post('/packages/:key/uninstall', async (c) => {
        const denied = await options.requireAdmin(c);
        if (denied) return denied;
        const removed = await registry.uninstall(c.env, c.params.key);
        if (!removed) return errorResponse('Package not installed', 404);
        // Deliberately re-resolved: uninstall clears the install RECORD, and the package
        // is still registered in config, so the honest answer is its fresh state.
        return jsonResponse({ data: await registry.status(c.env, c.params.key) });
    });

    router.post('/refresh', async (c) => {
        const denied = await options.requireAdmin(c);
        if (denied) return denied;
        registry.invalidate();
        return jsonResponse({ data: await registry.statuses(c.env) });
    });

    return router;
}
