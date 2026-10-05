import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/admin-guard', () => ({ requireAdminAccess: vi.fn() }));
vi.mock('@ottabase/comments', () => ({ Comment: { count: vi.fn(), where: vi.fn() } }));
vi.mock('@ottabase/ottablog', () => ({ Post: { whereIn: vi.fn() } }));
vi.mock('@ottabase/ottaorm/models', () => ({ User: { whereIn: vi.fn() } }));

import { Comment } from '@ottabase/comments';
import { Post } from '@ottabase/ottablog';
import { User } from '@ottabase/ottaorm/models';
import { requireAdminAccess } from '../../lib/admin-guard';
import { handleAdminFlaggedComments } from '../admin-comments';

const record = (data: Record<string, unknown>) => ({ toJson: () => data, get: (key: string) => data[key] });

function ctx(url: string) {
    return { request: new Request(url), env: { OBCF_D1: {} }, url: new URL(url) } as any;
}

describe('GET /api/admin/comments/flagged', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(Comment.count).mockResolvedValue(2);
        vi.mocked(Comment.where).mockResolvedValue([
            record({ id: 'c1', body: 'spam', createdAt: 5, userId: 'u1', targetType: 'post', targetId: 'p1' }),
            record({ id: 'c2', body: 'rude', createdAt: 4, userId: null, targetType: 'page', targetId: 'x' }),
        ] as any);
        vi.mocked(Post.whereIn).mockResolvedValue([
            record({ id: 'p1', title: 'Hello', slug: 'hello', contentType: 'blog' }),
        ] as any);
        vi.mocked(User.whereIn).mockResolvedValue([record({ id: 'u1', name: 'Ada' })] as any);
    });

    it('lists every organization for a platform admin, with the post and author of each comment', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({ organizationId: 'system', appId: 'app' } as any);
        const res = await handleAdminFlaggedComments(ctx('http://x/api/admin/comments/flagged?limit=3'));
        expect(res.status).toBe(200);
        expect(Comment.where).toHaveBeenCalledWith(
            { status: 'flagged', appId: 'app' },
            { orderBy: 'createdAt', orderDirection: 'desc', limit: 3 },
        );
        expect(Post.whereIn).toHaveBeenCalledWith('id', ['p1'], expect.anything());
        expect(User.whereIn).toHaveBeenCalledWith('id', ['u1'], expect.anything());
        expect(await res.json()).toEqual({
            total: 2,
            comments: [
                {
                    id: 'c1',
                    body: 'spam',
                    createdAt: 5,
                    author: { id: 'u1', name: 'Ada' },
                    post: { id: 'p1', title: 'Hello', slug: 'hello', contentType: 'blog' },
                },
                { id: 'c2', body: 'rude', createdAt: 4, author: null, post: null },
            ],
        });
    });

    it('keeps an organization admin inside their own organization', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue({ organizationId: 'org_1', appId: 'app' } as any);
        await handleAdminFlaggedComments(ctx('http://x/api/admin/comments/flagged'));
        expect(Comment.count).toHaveBeenCalledWith({ status: 'flagged', appId: 'app', organizationId: 'org_1' });
        expect(Comment.where).toHaveBeenCalledWith(
            { status: 'flagged', appId: 'app', organizationId: 'org_1' },
            expect.objectContaining({ limit: 5 }),
        );
    });

    it('passes the guard response through', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(new Response('no', { status: 403 }));
        const res = await handleAdminFlaggedComments(ctx('http://x/api/admin/comments/flagged'));
        expect(res.status).toBe(403);
        expect(Comment.where).not.toHaveBeenCalled();
    });
});
