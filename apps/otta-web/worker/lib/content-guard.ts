// ---------------------------------------------------------------------------
// Content guard — editorial permission gate WITHOUT an admin requirement.
// requireAdminAccess asserts org/platform ADMIN; this guard only asserts an
// authenticated session whose merged (org-scoped) permissions carry a given
// permission, so non-admin editorial roles (author, editor) pass. Used for the
// blog preview-token mint and the /studio surface's server-side counterparts.
// ---------------------------------------------------------------------------

import { hasPermission } from '@ottabase/rbac/admin-guard';
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
