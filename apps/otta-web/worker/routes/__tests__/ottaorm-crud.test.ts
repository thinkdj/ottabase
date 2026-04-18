import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleOttaormCrud } from '../ottaorm-crud';

vi.mock('@ottabase/auth/backend', () => ({
    getSession: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
    hashPassword: vi.fn(async (value: string) => `hashed-${value}`),
}));

vi.mock('@ottabase/db/drizzle-d1', () => ({
    createD1Driver: vi.fn(() => ({})),
}));

vi.mock('@ottabase/ottaorm', () => ({
    parseCrudRequest: vi.fn(),
    executeSecureCrudRequest: vi.fn(),
    registerConnection: vi.fn(),
}));

vi.mock('../../lib/auth-utils', () => ({
    getAuthOptions: vi.fn(() => ({})),
    getSecurityContext: vi.fn(() => ({ organizationId: 'org-1', appId: 'otta-web' })),
}));

vi.mock('@ottabase/ottablog', () => ({
    Post: { find: vi.fn() },
}));

vi.mock('@ottabase/comments', () => ({
    Comment: { find: vi.fn() },
}));

vi.mock('@ottabase/ottaorm/models', () => ({
    OrganizationMember: { create: vi.fn() },
    User: { whereIn: vi.fn() },
}));

function createContext() {
    const request = new Request('https://example.com/api/ottaorm/posts/post-1', { method: 'PATCH' });
    return {
        request,
        env: { OBCF_D1: {} },
        url: new URL(request.url),
    } as any;
}

describe('handleOttaormCrud (posts concurrency)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 409 when expectedUpdatedAt does not match', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { Post } = await import('@ottabase/ottablog');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: { expectedUpdatedAt: 1000 },
        });
        (Post.find as any).mockResolvedValue({
            get: (key: string) => (key === 'updatedAt' ? 2000 : null),
        });

        const response = await handleOttaormCrud(createContext());

        expect(response.status).toBe(409);
        expect(executeSecureCrudRequest as any).not.toHaveBeenCalled();
    });

    it('removes expectedUpdatedAt before executing the update', async () => {
        const { parseCrudRequest, executeSecureCrudRequest } = await import('@ottabase/ottaorm');
        const { Post } = await import('@ottabase/ottablog');

        (parseCrudRequest as any).mockResolvedValue({
            model: 'posts',
            method: 'PATCH',
            id: 'post-1',
            body: { expectedUpdatedAt: 1000, title: 'Next title' },
        });
        (Post.find as any).mockResolvedValue({
            get: (key: string) => (key === 'updatedAt' ? 1000 : null),
        });
        (executeSecureCrudRequest as any).mockResolvedValue({
            success: true,
            data: { id: 'post-1' },
            status: 200,
        });

        const response = await handleOttaormCrud(createContext());
        const call = (executeSecureCrudRequest as any).mock.calls[0][0];

        expect(response.status).toBe(200);
        expect(call.body.expectedUpdatedAt).toBeUndefined();
    });
});
