// ============================================================
// POST /api/account/switch-org
// Switch the authenticated user's "current organization" to the
// one passed in the body. Validates active membership, pins the
// choice in KV (read by the jwt callback), bumps the profile
// version so the next session.update() re-issues the JWT with
// the new org context, and invalidates the RBAC cache.
// ============================================================

import { getSession } from '@ottabase/auth/backend';
import { userKey } from '@ottabase/cf';
import { OrganizationMember } from '@ottabase/ottaorm/models';
import { getRBACCache } from '@ottabase/rbac';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getAuthOptions } from '../lib/auth-utils';
import { initDbConnection } from '../lib/db-utils';
import type { ApiRouteContext } from './router';

interface SwitchOrgBody {
    organizationId?: string;
}

export async function handleAccountSwitchOrg(context: ApiRouteContext): Promise<Response> {
    const { env, request } = context;

    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }
    if (!env.OBCF_KV) {
        return errorResponse('KV binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    initDbConnection(env);

    const session = await getSession(request, env as CloudflareEnv, getAuthOptions(env));
    const userId = session?.user?.id ? String(session.user.id) : null;
    if (!userId) {
        return errorResponse('Authentication required', 401, { code: 'UNAUTHENTICATED' });
    }

    let body: SwitchOrgBody;
    try {
        body = (await request.json()) as SwitchOrgBody;
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'BAD_REQUEST' });
    }

    const organizationId = body.organizationId?.trim();
    if (!organizationId) {
        return errorResponse('organizationId is required', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: { organizationId: ['organizationId is required'] },
        });
    }

    const member = await OrganizationMember.getMember(userId, organizationId);
    if (!member || member.status !== 'active') {
        return errorResponse('Not an active member of this organization', 403, {
            code: 'FORBIDDEN',
        });
    }

    try {
        await env.OBCF_KV.put(userKey('auth', userId, 'profile', 'currentOrgId'), organizationId);

        const profileVersionKey = userKey('auth', userId, 'profile', 'version');
        const current = Number((await env.OBCF_KV.get(profileVersionKey)) || 0);
        const next = Number.isFinite(current) ? current + 1 : Date.now();
        await env.OBCF_KV.put(profileVersionKey, String(next));

        await getRBACCache().invalidateUser(userId, organizationId);

        return jsonResponse({ data: { organizationId } });
    } catch (error) {
        return errorResponse('Failed to switch organization', 500, {
            code: 'ORG_SWITCH_FAILED',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
