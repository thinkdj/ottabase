import { OrganizationMember, User } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { paginatedJsonResponse, parsePaginationParams } from '@ottabase/utils/pagination';
import { requireAdminAccess } from '../lib/admin-guard';
import type { ApiRouteContext } from './router';

function parseSearchLimit(rawValue: string | null): number {
    const parsed = Number.parseInt(rawValue || '', 10);
    if (!Number.isFinite(parsed)) return 12;
    return Math.min(25, Math.max(1, parsed));
}

/**
 * GET /api/admin/users?page=1&per_page=25&search=... - List users with server-side pagination (admin only)
 */
export async function handleAdminUsers(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;

    const url = new URL(context.request.url);
    const { page, perPage, search } = parsePaginationParams(url.searchParams, {
        defaults: { perPage: 25, orderBy: 'createdAt', order: 'desc' },
    });

    let paginationResult;
    if (search) {
        paginationResult = await User.searchPaginate(search, ['name', 'email'], page, perPage, undefined, {
            orderBy: 'createdAt',
            orderDirection: 'desc',
        });
    } else {
        paginationResult = await User.paginate(page, perPage, undefined, {
            orderBy: 'createdAt',
            orderDirection: 'desc',
        });
    }

    return paginatedJsonResponse({
        data: paginationResult.data.map((u) => u.toJson()),
        total: paginationResult.total,
        page: paginationResult.page,
        perPage: paginationResult.perPage,
        path: '/api/admin/users',
    });
}

/**
 * GET /api/admin/users/search?q=... - Search users for org membership invites (admin only)
 */
export async function handleAdminUserSearch(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const url = new URL(context.request.url);
    const query = (url.searchParams.get('q') || '').trim();

    if (query.length < 2) {
        return jsonResponse({ data: [] });
    }

    const limit = parseSearchLimit(url.searchParams.get('limit'));
    const isSystemAdmin = auth.organizationId === 'system';

    // For tenant-scoped admins, only allow exact-email lookup to avoid broad cross-tenant enumeration.
    let users;
    if (!isSystemAdmin) {
        if (!query.includes('@')) {
            return jsonResponse({ data: [] });
        }

        const candidateUsers = await User.search(query, ['email'], undefined, {
            orderBy: 'createdAt',
            orderDirection: 'desc',
            limit: 5,
        });

        const normalizedQuery = query.toLowerCase();
        users = candidateUsers.filter((user) => {
            const record = user.toJson() as { email?: string | null };
            return (record.email || '').toLowerCase() === normalizedQuery;
        });
    } else {
        users = await User.search(query, ['name', 'email', 'id'], undefined, {
            orderBy: 'createdAt',
            orderDirection: 'desc',
            limit,
        });
    }

    return jsonResponse({
        data: users.map((user) => {
            const record = user.toJson() as {
                id: string;
                name?: string | null;
                email?: string | null;
                image?: string | null;
            };

            return {
                id: record.id,
                name: record.name ?? null,
                email: record.email ?? null,
                image: record.image ?? null,
            };
        }),
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

    // Fetch the target user's org memberships, but expose only the ones for organizations the
    // CALLER also belongs to. The global user directory is intentional platform-admin capability,
    // but a platform owner must not be able to enumerate which tenants a user belongs to beyond the
    // orgs they share — that is the same cross-tenant roster data gated in the org-members and
    // audit routes (reached here via a user id instead of an org id).
    let memberships: any[] = [];
    try {
        const callerOrgIds = auth.user?.id
            ? new Set(await OrganizationMember.organizationIdsForUser(auth.user.id))
            : new Set<string>();
        const members = await OrganizationMember.where({ userId });
        memberships = members.map((m) => m.toJson()).filter((m: any) => callerOrgIds.has(m.organizationId));
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
