/**
 * Demo-seed + app-scoping handler tests. These live in the package rather than
 * otta-web because the app test's bare-specifier mocks do not intercept the
 * package's relative model imports.
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

const SEED_CONTENT = { blocks: [{ type: 'paragraph', data: { text: 'demo' } }] };
const DEMO_POSTS = [
    {
        title: 'Sample article',
        slug: 'sample-article',
        excerpt: 'A sample article.',
        content: SEED_CONTENT,
        contentType: 'blog' as const,
        isFeatured: true,
        heroImage: { url: 'https://cdn.test/hero.jpg', alt: 'Hero' },
    },
    {
        title: 'Sample release note',
        slug: 'sample-release-note',
        excerpt: 'A sample release note.',
        content: SEED_CONTENT,
        contentType: 'changelog' as const,
    },
];

const baseConfig = {
    connect: vi.fn(() => null),
    defaultAppId: () => 'test-app',
    requireAdmin: vi.fn(async (): Promise<any> => ({ session: { user: { id: 'admin' } } })),
    checkCronAuth: vi.fn(() => false),
    verifyPassword: vi.fn(async () => false),
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

describe('handleBlogDemoSeed', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(Post.first).mockResolvedValue(null as any);
        vi.mocked(Post.create).mockReset();
    });

    it('returns the admin guard response when the caller is unauthorized', async () => {
        const denial = new Response('nope', { status: 403 });
        const handlers = createBlogHandlers<Env>({
            ...baseConfig,
            demoPosts: DEMO_POSTS,
            requireAdmin: async () => denial,
        });

        expect(await handlers.handleBlogDemoSeed(ctxFor('/seed-demo', { method: 'POST' }))).toBe(denial);
    });

    it('creates missing rows in the caller own organization so they stay editable', async () => {
        vi.mocked(Post.create)
            .mockResolvedValueOnce(postRow({ id: 'post-1' }) as any)
            .mockResolvedValueOnce(postRow({ id: 'post-2' }) as any);
        const handlers = createBlogHandlers<Env>({
            ...baseConfig,
            // The public-read tenant is deliberately DIFFERENT from the caller's org
            // here: seeding must follow the caller, because the admin surface reads
            // posts through a tenant filter keyed on the caller's organization.
            mode: 'org',
            resolveOrganizationId: async () => 'public-tenant',
            requireAdmin: async () => ({ session: { user: { id: 'admin', organizationId: 'org-123' } } }),
            demoPosts: DEMO_POSTS,
        });

        const response = await handlers.handleBlogDemoSeed(
            ctxFor('/seed-demo', { method: 'POST', headers: { 'x-app-id': 'site-a' } }),
        );
        const body = (await response.json()) as { created: Array<{ slug: string }>; existing: string[]; total: number };

        expect(response.status).toBe(200);
        expect(body).toEqual({
            created: [
                { id: 'post-1', slug: 'sample-article', contentType: 'blog' },
                { id: 'post-2', slug: 'sample-release-note', contentType: 'changelog' },
            ],
            existing: [],
            total: 2,
        });
        expect(vi.mocked(Post.create).mock.calls[0][0]).toEqual(
            expect.objectContaining({
                slug: 'sample-article',
                appId: 'test-app',
                organizationId: 'org-123',
                contentType: 'blog',
                status: 'published',
                isFeatured: true,
                heroImage: { url: 'https://cdn.test/hero.jpg', alt: 'Hero' },
            }),
        );
    });

    it('omits heroImage entirely for seeds that do not declare one', async () => {
        // Passing `heroImage: undefined` would force-clear the column instead of
        // letting it keep its own default, so the key must be absent.
        vi.mocked(Post.create).mockResolvedValue(postRow({ id: 'post-x' }) as any);
        const handlers = createBlogHandlers<Env>({ ...baseConfig, demoPosts: DEMO_POSTS });

        await handlers.handleBlogDemoSeed(ctxFor('/seed-demo', { method: 'POST' }));

        expect(vi.mocked(Post.create).mock.calls[1][0]).not.toHaveProperty('heroImage');
    });

    it('probes for an existing slug per the binding (app, slug) unique index', async () => {
        vi.mocked(Post.create).mockResolvedValue(postRow({ id: 'post-1' }) as any);
        const handlers = createBlogHandlers<Env>({
            ...baseConfig,
            requireAdmin: async () => ({ session: { user: { id: 'admin', organizationId: 'org-123' } } }),
            demoPosts: DEMO_POSTS,
        });

        await handlers.handleBlogDemoSeed(ctxFor('/seed-demo', { method: 'POST', headers: { 'x-app-id': 'site-a' } }));

        // No organizationId in the probe: an org-filtered lookup would miss a
        // same-slug row in another tenant and turn the insert into a hard
        // constraint failure instead of a clean "already exists".
        expect(Post.first).toHaveBeenCalledWith({ slug: 'sample-article', appId: 'test-app' });
    });

    it('leaves existing rows untouched on a repeat seed', async () => {
        vi.mocked(Post.first).mockResolvedValue(postRow({ id: 'existing' }) as any);
        const handlers = createBlogHandlers<Env>({ ...baseConfig, demoPosts: DEMO_POSTS });

        const response = await handlers.handleBlogDemoSeed(ctxFor('/seed-demo', { method: 'POST' }));
        const body = (await response.json()) as { created: unknown[]; existing: string[] };

        expect(body.created).toEqual([]);
        expect(body.existing).toEqual(['sample-article', 'sample-release-note']);
        expect(Post.create).not.toHaveBeenCalled();
    });
});

describe('blog by-slug app scoping', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(Post.first).mockResolvedValue(null as any);
    });

    it('ignores request app headers and uses configured app scope', async () => {
        const handlers = createBlogHandlers<Env>(baseConfig);
        await handlers.handleBlogPostBySlug(
            {
                ...ctxFor('/posts/by-slug/hello'),
                request: new Request('https://x.test/posts/by-slug/hello', { headers: { 'x-app-id': 'site-b' } }),
            },
            'hello',
        );
        expect(Post.first).toHaveBeenCalledWith(expect.objectContaining({ appId: 'test-app', status: 'published' }));
    });

    it('ignores request app query/header values on unlock reads', async () => {
        const handlers = createBlogHandlers<Env>(baseConfig);
        await handlers.handleBlogPostUnlock({
            ...ctxFor('/posts/unlock?appId=site-q'),
            request: new Request('https://x.test/posts/unlock?appId=site-q', {
                method: 'POST',
                headers: { 'x-app-id': 'site-h', 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug: 's', password: 'p' }),
            }),
        });
        expect(Post.first).toHaveBeenCalledWith(expect.objectContaining({ appId: 'test-app' }));
    });

    it('returns 404 when no published row matches the resolved appId (no null-app fallback)', async () => {
        const handlers = createBlogHandlers<Env>(baseConfig);
        const res = await handlers.handleBlogPostBySlug(ctxFor('/posts/by-slug/hello'), 'hello');
        expect(res.status).toBe(404);
        expect(Post.first).toHaveBeenCalledTimes(1);
        expect(Post.first).toHaveBeenCalledWith(expect.objectContaining({ appId: 'test-app' }));
    });

    it('scopes taxonomy slug lookups to configured appId', async () => {
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
            expect.objectContaining({ appId: 'test-app', type: 'post' }),
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
        expect(PostSeries.findBySlug).toHaveBeenCalledWith('s', expect.objectContaining({ appId: 'test-app' }));
    });
});
