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
import type { CloudflareEnv } from '../../cloudflare-env';
import { getAuthOptions } from './auth-utils';
import { initDbConnection } from './db-utils';

export interface ContentGuardContext {
    request: Request;
    env: CloudflareEnv;
    url?: URL;
}

export interface ContentAccessResult {
    session: { user?: { id?: string | null; organizationId?: string | null } | null } | null;
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

    return { session: reqCtx.session ?? null };
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
