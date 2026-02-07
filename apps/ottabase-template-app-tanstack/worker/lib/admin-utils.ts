// ============================================================
// Admin Utilities
// ============================================================
//
// Shared helpers for admin route authorization.
// Wraps @ottabase/rbac's getRequestContext + assertAdmin
// with the app's auth configuration.
// ============================================================

import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { getRequestContext, assertAdmin, type RequestContext, type AdminScope } from '@ottabase/rbac';
import { getSession } from '@ottabase/auth/backend';
import { getAuthOptions } from './auth-utils';
import type { CloudflareEnv } from '../cloudflare-env';

export interface AdminContext {
    request: Request;
    env: CloudflareEnv;
    url?: URL;
}

/**
 * Resolve the full request context for admin routes.
 * Initializes DB, resolves session + RBAC.
 */
export async function getAdminRequestContext(
    context: AdminContext,
): Promise<RequestContext> {
    const { request, env } = context;

    // Ensure DB is initialized (idempotent via registerConnection)
    if (env.OBCF_D1) {
        registerConnection('default', createD1Driver(env.OBCF_D1));
    }

    return getRequestContext(request, env, {
        getSession: async (req, e) => getSession(req, e as any, getAuthOptions(e as any)),
    });
}

/**
 * One-call admin check for route handlers.
 *
 * Returns a Response (401/403) on failure, or { sessionUser, organizationId } on success.
 *
 * @example
 * ```ts
 * export async function handleAdminUsers(context: ApiRouteContext): Promise<Response> {
 *     const result = await requireAdminRoute(context, 'system');
 *     if (result instanceof Response) return result;
 *     const { sessionUser, organizationId } = result;
 *     // ... proceed
 * }
 * ```
 */
export async function requireAdminRoute(
    context: AdminContext,
    scope: AdminScope = 'system',
    options?: { requiredPermissions?: string[]; requireAllPermissions?: boolean },
): Promise<Response | { sessionUser: { id: string; email?: string; name?: string }; organizationId: string | null }> {
    const { env } = context;

    if (!env.OBCF_D1) {
        return new Response(
            JSON.stringify({ error: 'D1 database binding not configured', code: 'CONFIG_ERROR' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }

    const reqCtx = await getAdminRequestContext(context);
    return assertAdmin(reqCtx, { scope, ...options });
}
