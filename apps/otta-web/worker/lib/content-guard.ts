// ---------------------------------------------------------------------------
// Content guard — editorial permission gate WITHOUT an admin requirement.
// requireAdminAccess asserts org/platform ADMIN; this guard only asserts an
// authenticated session whose merged (org-scoped) permissions carry a given
// permission, so non-admin editorial roles (author, editor) pass. Used for the
// blog preview-token mint and the /studio surface's server-side counterparts.
// ---------------------------------------------------------------------------

import { hasPermission, isPlatformAdmin } from '@ottabase/rbac/admin-guard';
import { getRequestContext } from '@ottabase/rbac/request-context';
import { errorResponse } from '@ottabase/utils/http-errors';
import type { SecurityContext } from '@ottabase/ottaorm';
import { getAuthOptions, getSecurityContext } from './auth-utils';
import { initDbConnection } from './db-utils';

export interface ContentGuardContext {
    request: Request;
    env: CloudflareEnv;
    url?: URL;
}

export interface ContentAccessResult {
    session: { user?: { id?: string | null; organizationId?: string | null } | null } | null;
    securityContext: SecurityContext;
}

/**
 * Require an authenticated caller holding `permission` (wildcards honored, so
 * `posts:*`, `org:admin`-carried grants, and the platform owner's `*:*` pass).
 * Resolves to the session on success, a 401/403 Response on denial.
 */
export async function requireContentPermission(
    context: ContentGuardContext,
    permission: string,
): Promise<ContentAccessResult | Response> {
    const { request, env } = context;

    if (!env?.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    initDbConnection(env);

    const reqCtx = await getRequestContext(request, env as any, {
        getAuthOptions,
        // Editorial permissions are org-scoped grants; a session without an active
        // org still resolves (single-founder mode) and is checked the same way.
        allowNullTenant: true,
    });

    if (!reqCtx.isAuthenticated || !reqCtx.user) {
        return errorResponse('Authentication required', 401, { code: 'UNAUTHORIZED' });
    }

    if (!hasPermission(reqCtx, permission)) {
        return errorResponse(`Missing required permission: ${permission}`, 403, { code: 'FORBIDDEN' });
    }

    const session = reqCtx.session ?? null;

    // Authorization and row scope are deliberately separate concerns. getRequestContext
    // evaluates the caller's current RBAC grants; getSecurityContext is the canonical,
    // membership-validated OttaORM context used by /api/ottaorm. In particular it preserves
    // the scope-aware platformAdmin flag and maps an explicit Platform selection to the
    // platform-owned organizationId=null partition instead of the RBAC-only "system" sentinel.
    const securityContext = await getSecurityContext(request, session, env);

    return { session, securityContext };
}

/**
 * SCOPED Studio guard: platform-blog scope (null org) requires a PLATFORM
 * admin; an org scope requires an ORG ADMIN of that org (org:admin grant
 * evaluated in the TARGET org — grants are org-scoped, so non-members have
 * none there) or a platform admin. This is what lets each tenant run their
 * own blog's Studio in org mode while the platform blog stays platform-only.
 */
export async function requireStudioAdminForScope(
    context: ContentGuardContext,
    target: { organizationId: string | null },
): Promise<ContentAccessResult | Response> {
    const { request, env } = context;

    if (!env?.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    initDbConnection(env);

    const reqCtx = await getRequestContext(request, env as any, {
        getAuthOptions,
        allowNullTenant: true,
        // Evaluate grants in the TARGET org (the resolved blog scope), never a
        // request-supplied hint. For the platform scope there is no org to load.
        organizationIdOverride: target.organizationId ?? undefined,
    });

    if (!reqCtx.isAuthenticated || !reqCtx.user) {
        return errorResponse('Authentication required', 401, { code: 'UNAUTHORIZED' });
    }

    // Same split as requireContentPermission: getRequestContext answers "may they?", but the
    // returned securityContext is what callers hand to the ottaorm RLS engine, so it MUST be the
    // canonical membership-validated one. A RequestContext has no userId/platformAdmin, and its
    // undefined memberOrganizationIds reads as "membership unknown" — which makes the engine SKIP
    // the cross-tenant check rather than fail closed.
    const toAccessResult = async (): Promise<ContentAccessResult> => {
        const session = reqCtx.session ?? null;
        return { session, securityContext: await getSecurityContext(request, session, env) };
    };

    if (isPlatformAdmin(reqCtx)) {
        return toAccessResult();
    }

    // The platform blog's studio is platform-only.
    if (target.organizationId === null) {
        return errorResponse('Managing the platform blog requires a platform administrator', 403, {
            code: 'FORBIDDEN',
        });
    }

    if (!hasPermission(reqCtx, 'org:admin')) {
        return errorResponse('Managing this blog requires an administrator of its organization', 403, {
            code: 'FORBIDDEN',
        });
    }

    return toAccessResult();
}

/**
 * OBJECT-level check for editorial actions on a specific post: platform admin,
 * or a manage-grade grant (posts:manage / posts:* / org:admin / *:*) evaluated
 * IN THE POST ROW's organization — never a request-supplied org hint. Grants
 * are org-scoped, so a non-member simply has none there and fails closed.
 */
export async function canManagePostInOrg(
    context: ContentGuardContext,
    post: { organizationId: string | null },
): Promise<boolean> {
    const { request, env } = context;
    if (!env?.OBCF_D1) return false;

    initDbConnection(env);

    try {
        const reqCtx = await getRequestContext(request, env as any, {
            getAuthOptions,
            allowNullTenant: true,
            organizationIdOverride: post.organizationId ?? undefined,
        });

        if (!reqCtx.isAuthenticated || !reqCtx.user) return false;
        if (isPlatformAdmin(reqCtx)) return true;
        // Platform-owned posts (null org): only a platform admin manages them.
        if (post.organizationId === null) return false;
        return hasPermission(reqCtx, 'posts:manage') || hasPermission(reqCtx, 'org:admin');
    } catch {
        return false;
    }
}
