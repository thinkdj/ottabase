/**
 * Kitchensink + app-scoping handler tests, ported from otta-web's
 * blog.kitchensink.test.ts when the handlers moved into the package (the app
 * test's bare-specifier mocks stopped intercepting the package's relative
 * model imports). Same coverage, package-native seams.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlogHandlers } from '../router';

vi.mock('../ottaorm-models', () => ({
    Post: {
        findBySlug: vi.fn(async () => null),
        first: vi.fn(async () => null),
        create: vi.fn(),
    },
    PostCategory: { findBySlug: vi.fn(async () => null) },
    PostCategoryLink: { where: vi.fn(async () => []) },
    PostSeries: { findBySlug: vi.fn(async () => null) },
    PostTag: { findBySlug: vi.fn(async () => null) },
    PostTagLink: { where: vi.fn(async () => []) },
    OttablogTheme: {},
    OttablogPlugin: {},
}));

vi.mock('../studio', () => ({ StudioManager: { getState: vi.fn(async () => ({ themes: [], plugins: [] })) } }));

import { Post, PostCategory, PostSeries, PostTag } from '../ottaorm-models';

type Env = { marker?: string };
const env: Env = {};

const KITCHENSINK_CONTENT = { blocks: [{ type: 'paragraph', data: { text: 'demo' } }] };

const baseConfig = {
    connect: vi.fn(() => null),
    defaultAppId: () => 'test-app',
    requireAdmin: vi.fn(async (): Promise<any> => ({ session: { user: { id: 'admin' } } })),
    checkCronAuth: vi.fn(() => false),
    verifyPassword: vi.fn(async () => false),
    kitchensinkContent: KITCHENSINK_CONTENT as Record<string, unknown>,
};

const ctxFor = (path: string, init?: RequestInit) => ({
    request: new Request(`https://x.test${path}`, init),
    env,
    url: new URL(`https://x.test${path}`),
});

const postRow = (fields: Record<string, unknown>, setMock = vi.fn(), saveMock = vi.fn()) => ({
    get: (key: string) => fields[key] ?? null,
    set: setMock,
    save: saveMock,
});

describe('handleBlogKitchensink', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(Post.findBySlug).mockResolvedValue(null as any);
        vi.mocked(Post.create).mockReset();
    });

    it('returns the admin guard response when the caller is unauthorized', async () => {
        const denial = new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        const handlers = createBlogHandlers<Env>({ ...baseConfig, requireAdmin: vi.fn(async () => denial) });

        const res = await handlers.handleBlogKitchensink(ctxFor('/kitchensink', { method: 'POST' }));
        expect(res.status).toBe(401);
    });

    it('upserts an existing kitchensink post so the public blog url always works', async () => {
        const setMock = vi.fn();
        const saveMock = vi.fn().mockResolvedValue(undefined);
        vi.mocked(Post.findBySlug).mockResolvedValueOnce(
            postRow(
                { id: 'post-1', slug: 'kitchensink-ottablog', status: 'draft', publishedAt: null },
                setMock,
                saveMock,
            ) as any,
        );

        const handlers = createBlogHandlers<Env>(baseConfig);
        const res = await handlers.handleBlogKitchensink(ctxFor('/kitchensink', { method: 'POST' }));
        const body = (await res.json()) as { status: string; slug: string };

        expect(res.status).toBe(200);
        expect(body.status).toBe('upserted');
        expect(body.slug).toBe('kitchensink-ottablog');
        expect(setMock).toHaveBeenCalledWith('status', 'published');
        expect(setMock).toHaveBeenCalledWith('content', expect.any(Object));
        expect(setMock).toHaveBeenCalledWith('publishedAt', expect.any(String));
        expect(saveMock).toHaveBeenCalled();
    });

    it('upserts on a unique-race create failure for idempotent behavior', async () => {
        const setMock = vi.fn();
        const saveMock = vi.fn().mockResolvedValue(undefined);
        vi.mocked(Post.findBySlug)
            .mockResolvedValueOnce(null as any)
            .mockResolvedValueOnce(
                postRow({ id: 'post-1', slug: 'kitchensink-ottablog', publishedAt: null }, setMock, saveMock) as any,
            );
        vi.mocked(Post.create).mockRejectedValueOnce(new Error('UNIQUE constraint failed: posts.slug'));

        const handlers = createBlogHandlers<Env>(baseConfig);
        const res = await handlers.handleBlogKitchensink(ctxFor('/kitchensink', { method: 'POST' }));
        const body = (await res.json()) as { status: string; slug: string };

        expect(res.status).toBe(200);
        expect(body.status).toBe('upserted');
        expect(setMock).toHaveBeenCalledWith('content', expect.any(Object));
        expect(saveMock).toHaveBeenCalled();
    });

    it('assigns app, org, and user from the request context on create', async () => {
        vi.mocked(Post.create).mockResolvedValueOnce(postRow({ id: 'post-1', slug: 'kitchensink-ottablog' }) as any);

        const handlers = createBlogHandlers<Env>(baseConfig);
        const res = await handlers.handleBlogKitchensink(
            ctxFor('/kitchensink', { method: 'POST', headers: { 'x-app-id': 'site-a', 'x-org-id': 'org-123' } }),
        );

        expect(res.status).toBe(200);
        expect(Post.findBySlug).toHaveBeenCalledWith('kitchensink-ottablog', { appId: 'site-a' });
        const payload = vi.mocked(Post.create).mock.calls[0][0] as Record<string, unknown>;
        expect(payload.appId).toBe('site-a');
        expect(payload.organizationId).toBe('org-123');
        expect(payload.userId).toBe('admin');
        expect(payload.authorId).toBe('admin');
        expect((payload.content as { blocks: unknown[] }).blocks).toBeDefined();
    });
});

describe('blog by-slug app scoping', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(Post.first).mockResolvedValue(null as any);
    });

    it('scopes by-slug reads to the x-app-id header', async () => {
        const handlers = createBlogHandlers<Env>(baseConfig);
        await handlers.handleBlogPostBySlug(
            {
                ...ctxFor('/posts/by-slug/hello'),
                request: new Request('https://x.test/posts/by-slug/hello', { headers: { 'x-app-id': 'site-b' } }),
            },
            'hello',
        );
        expect(Post.first).toHaveBeenCalledWith(expect.objectContaining({ appId: 'site-b', status: 'published' }));
    });

    it('prefers the appId query param over the header on unlock reads', async () => {
        const handlers = createBlogHandlers<Env>(baseConfig);
        await handlers.handleBlogPostUnlock({
            ...ctxFor('/posts/unlock?appId=site-q'),
            request: new Request('https://x.test/posts/unlock?appId=site-q', {
                method: 'POST',
                headers: { 'x-app-id': 'site-h', 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: 's', password: 'p' }),
            }),
        });
        expect(Post.first).toHaveBeenCalledWith(expect.objectContaining({ appId: 'site-q' }));
    });

    it('returns 404 when no published row matches the resolved appId (no null-app fallback)', async () => {
        const handlers = createBlogHandlers<Env>(baseConfig);
        const res = await handlers.handleBlogPostBySlug(ctxFor('/posts/by-slug/hello'), 'hello');
        expect(res.status).toBe(404);
        expect(Post.first).toHaveBeenCalledTimes(1);
        expect(Post.first).toHaveBeenCalledWith(expect.objectContaining({ appId: 'test-app' }));
    });

    it('scopes taxonomy slug lookups by appId (header default, explicit type, query precedence)', async () => {
        const handlers = createBlogHandlers<Env>(baseConfig);

        await handlers.handleBlogTagBySlug(
            {
                ...ctxFor('/tags/by-slug/t'),
                request: new Request('https://x.test/tags/by-slug/t', { headers: { 'x-app-id': 'site-b' } }),
            },
            't',
        );
        expect(PostTag.findBySlug).toHaveBeenCalledWith(
            't',
            expect.objectContaining({ appId: 'site-b', type: 'post' }),
        );

        await handlers.handleBlogCategoryBySlug(ctxFor('/categories/by-slug/c?type=docs'), 'c');
        expect(PostCategory.findBySlug).toHaveBeenCalledWith(
            'c',
            expect.objectContaining({ appId: 'test-app', type: 'docs' }),
        );

        await handlers.handleBlogSeriesBySlug(
            {
                ...ctxFor('/series/by-slug/s?appId=site-q'),
                request: new Request('https://x.test/series/by-slug/s?appId=site-q', {
                    headers: { 'x-app-id': 'site-h' },
                }),
            },
            's',
        );
        expect(PostSeries.findBySlug).toHaveBeenCalledWith('s', expect.objectContaining({ appId: 'site-q' }));
    });
});
