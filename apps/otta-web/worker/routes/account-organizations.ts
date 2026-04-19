import { getSession } from '@ottabase/auth/backend';
import { OrganizationMember } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getAuthOptions } from '../lib/auth-utils';
import { initDbConnection } from '../lib/db-utils';
import type { ApiRouteContext } from './router';
import { createOrganizationWithOwner, parseJsonBody } from './shared/organization-validation';

export async function handleAccountOrganizationsList(context: ApiRouteContext): Promise<Response> {
    const { env, request } = context;

    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    initDbConnection(env);

    const session = await getSession(request, env as CloudflareEnv, getAuthOptions(env));
    const userId = session?.user?.id;
    if (!userId) {
        return errorResponse('Authentication required', 401, { code: 'UNAUTHENTICATED' });
    }

    try {
        const memberships = await OrganizationMember.getUserOrganizations(String(userId), { status: 'active' });
        const data = memberships
            .filter((membership) => membership.organization)
            .map((membership) => ({
                id: membership.organization!.id,
                name: membership.organization!.name,
                slug: membership.organization!.slug,
                plan: membership.organization!.plan,
                status: membership.organization!.status,
                currentUserRole: membership.role,
                currentUserStatus: membership.status,
            }))
            .sort((left, right) => left.name.localeCompare(right.name));

        return jsonResponse({ data });
    } catch (error) {
        return errorResponse('Failed to load account organizations', 500, {
            code: 'ACCOUNT_ORG_LIST_FAILED',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

/**
 * Onboarding: any authenticated user can create their first organization.
 * Grants the creator the `owner` role via `Organization.createWithOwner`.
 */
export async function handleAccountOnboardingOrganizationCreate(context: ApiRouteContext): Promise<Response> {
    const { env, request } = context;

    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    initDbConnection(env);

    const session = await getSession(request, env as CloudflareEnv, getAuthOptions(env));
    if (!session?.user?.id) {
        return errorResponse('Authentication required', 401, { code: 'UNAUTHENTICATED' });
    }

    const body = await parseJsonBody<Record<string, unknown>>(context);
    if (body instanceof Response) return body;

    return createOrganizationWithOwner(context, body, {
        userId: String(session.user.id),
        userEmail: typeof session.user.email === 'string' ? session.user.email : null,
        userName: typeof session.user.name === 'string' ? session.user.name : null,
    });
}
