import { OrganizationMember, User } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminAccess } from '../lib/admin-guard';
import type { ApiRouteContext } from './router';

/**
 * GET /api/admin/users - List all users (admin only)
 */
export async function handleAdminUsers(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const users = await User.all({ orderBy: 'createdAt', orderDirection: 'desc' });

    return jsonResponse({
        data: users.map((u) => u.toJson()),
    });
}

/**
 * GET /api/admin/users/:id - Get a single user by ID (admin only)
 */
export async function handleAdminUserById(context: ApiRouteContext, userId: string): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

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
