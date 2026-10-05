import { Comment } from '@ottabase/comments';
import { Post } from '@ottabase/ottablog';
import { User } from '@ottabase/ottaorm/models';
import { SYSTEM_ORGANIZATION_ID } from '@ottabase/rbac/admin-guard';
import { jsonResponse } from '@ottabase/utils/http-response';
import { parseBoundedInteger } from '@ottabase/utils/pagination';
import { requireAdminAccess } from '../lib/admin-guard';
import type { ApiRouteContext } from './router';

export interface FlaggedComment {
    id: string;
    body: string;
    createdAt: number | string;
    author: { id: string; name: string | null } | null;
    post: { id: string; title: string | null; slug: string; contentType: string } | null;
}

/**
 * GET /api/admin/comments/flagged?limit=5
 * The moderation queue: comments readers reported, newest first, with the post each sits on.
 * A platform admin sees every organization's; an organization admin only their own.
 */
export async function handleAdminFlaggedComments(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const limit = parseBoundedInteger(context.url.searchParams.get('limit'), 5, 1, 50);
    const where: Record<string, unknown> = { status: 'flagged', appId: auth.appId };
    if (auth.organizationId !== SYSTEM_ORGANIZATION_ID) where.organizationId = auth.organizationId;

    const [total, flagged] = await Promise.all([
        Comment.count(where),
        Comment.where(where, { orderBy: 'createdAt', orderDirection: 'desc', limit }),
    ]);
    const rows = flagged.map((comment) => comment.toJson() as Record<string, unknown>);
    const postIds = [...new Set(rows.filter((row) => row.targetType === 'post').map((row) => String(row.targetId)))];
    const userIds = [...new Set(rows.map((row) => row.userId).filter(Boolean))] as string[];

    const [posts, users] = await Promise.all([
        postIds.length ? Post.whereIn('id', postIds, { select: ['id', 'title', 'slug', 'contentType'] }) : [],
        userIds.length ? User.whereIn('id', userIds, { select: ['id', 'name'] }) : [],
    ]);
    const postById = new Map(
        posts.map((post) => [
            post.get('id'),
            {
                id: post.get('id'),
                title: post.get('title'),
                slug: post.get('slug'),
                contentType: post.get('contentType'),
            },
        ]),
    );
    const userById = new Map(users.map((user) => [user.get('id'), { id: user.get('id'), name: user.get('name') }]));

    const comments: FlaggedComment[] = rows.map((row) => ({
        id: String(row.id),
        body: String(row.body ?? ''),
        createdAt: row.createdAt as number | string,
        author: userById.get(row.userId) ?? null,
        post: row.targetType === 'post' ? (postById.get(row.targetId) ?? null) : null,
    }));

    return jsonResponse({ total, comments });
}
