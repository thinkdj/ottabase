import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getSession } from '@ottabase/auth/backend';
import { getAuthOptions } from '../lib/auth-utils';
import { registerConnection } from '@ottabase/ottaorm';
import { User, OrganizationMember } from '@ottabase/ottaorm/models';
import type { ApiRouteContext } from './router';

/**
 * GET /api/admin/users - List all users (admin only)
 */
export async function handleAdminUsers(context: ApiRouteContext): Promise<Response> {
    const { request, env, url } = context;

    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const session = await getSession(request, env as any, getAuthOptions(env));
    if (!session?.user?.id) {
        return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }

    const users = await User.all({ orderBy: 'createdAt', orderDirection: 'desc' });

    return jsonResponse({
        data: users.map((u) => u.toJson()),
    });
}

/**
 * GET /api/admin/users/:id - Get a single user by ID (admin only)
 */
export async function handleAdminUserById(context: ApiRouteContext, userId: string): Promise<Response> {
    const { request, env } = context;

    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const session = await getSession(request, env as any, getAuthOptions(env));
    if (!session?.user?.id) {
        return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }

    const user = await User.find(userId);
    if (!user) {
        return errorResponse('User not found', 404, { code: 'NOT_FOUND' });
    }

    // Also fetch the user's organization memberships
    let memberships: any[] = [];
    try {
        const members = await OrganizationMember.where({ userId });
        memberships = members.map((m) => m.toJson());
    } catch {
        // organization_members table may not exist yet
    }

    return jsonResponse({
        data: {
            ...user.toJson(),
            memberships,
        },
    });
}
