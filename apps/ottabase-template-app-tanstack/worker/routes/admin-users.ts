import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { User, OrganizationMember } from '@ottabase/ottaorm/models';
import { requireAdminRoute } from '../lib/admin-utils';
import type { ApiRouteContext } from './router';

/**
 * GET /api/admin/users - List all users (system admin only)
 */
export async function handleAdminUsers(context: ApiRouteContext): Promise<Response> {
    const result = await requireAdminRoute(context, 'system');
    if (result instanceof Response) return result;

    const users = await User.all({ orderBy: 'createdAt', orderDirection: 'desc' });

    return jsonResponse({
        data: users.map((u) => u.toJson()),
    });
}

/**
 * GET /api/admin/users/:id - Get a single user by ID (system admin only)
 */
export async function handleAdminUserById(context: ApiRouteContext, userId: string): Promise<Response> {
    const result = await requireAdminRoute(context, 'system');
    if (result instanceof Response) return result;

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
