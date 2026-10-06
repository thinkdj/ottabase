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
    PostCategory: { findBySlug: vi.fn(async () => null), first: vi.fn(async () => null), create: vi.fn() },
    PostCategoryLink: { where: vi.fn(async () => []), create: vi.fn() },
    PostSeries: { findBySlug: vi.fn(async () => null), first: vi.fn(async () => null), create: vi.fn() },
    PostTag: { findBySlug: vi.fn(async () => null), first: vi.fn(async () => null), create: vi.fn() },
    PostTagLink: { where: vi.fn(async () => []), create: vi.fn() },
    OttablogSettings: { forScope: vi.fn(async () => null), forScopeOrPlatform: vi.fn(async () => null) },
    PostTranslation: {
        forPost: vi.fn(async () => []),
        findForPost: vi.fn(async () => null),
        findBySlug: vi.fn(async () => null),
    },
    OttablogTheme: {},
    OttablogPlugin: {},
}));

vi.mock('../studio', () => ({ StudioManager: { getState: vi.fn(async () => ({ themes: [], plugins: [] })) } }));

import { Post, PostCategory, PostCategoryLink, PostSeries, PostTag, PostTagLink } from '../ottaorm-models';

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

describe('handleBlogDemoSeed with authors, dates and taxonomy', () => {
    const term = (id: string) => postRow({ id });
    const created = () => vi.mocked(Post.create).mock.calls.map(([data]) => data as Record<string, any>);

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(Post.first).mockResolvedValue(null as any);
        vi.mocked(Post.create)
            .mockReset()
            .mockImplementation(async (data: any) => postRow({ id: `id-${data.slug}` }) as any);
        for (const Model of [PostTag, PostCategory, PostSeries]) {
            vi.mocked(Model.first).mockResolvedValue(null as any);
            vi.mocked(Model.create)
                .mockReset()
                .mockImplementation(async (data: any) => term(`${data.name ?? data.title}-id`) as any);
        }
    });

    const seeds = [
        {
            title: 'Edge, part one',
            slug: 'edge-one',
            excerpt: 'Why the edge.',
            content: {
                blocks: [{ type: 'paragraph', data: { text: 'one two three four five six seven eight nine ten' } }],
            },
            contentType: 'blog' as const,
            publishedAt: '2026-04-02T09:00:00.000Z',
            authorEmail: 'tomas@example.com',
            tags: ['Cloudflare', 'cloudflare', 'Workers'],
            categories: ['Engineering'],
            series: { title: 'Building on the edge', order: 1, description: 'Four parts.' },
        },
        {
            slug: 'blurb-one',
            contentType: 'blurb' as const,
            blurbText: 'Shipped the audit timeline today. Grouping by day did more for readability than any column.',
            crossposts: ['https://social.example/p/1'],
            authorEmail: 'nobody@example.com',
        },
        {
            title: 'Two days in Lisbon',
            slug: 'two-days-in-lisbon',
            contentType: 'photo' as const,
            photoNote: 'Trams, tiles and one very long lunch.',
            photoAlbum: [
                {
                    id: 'lisbon-1',
                    url: 'https://images.test/lisbon-1.jpg',
                    caption: 'Tram 28 at dawn',
                    location: 'Alfama',
                },
                { id: 'lisbon-2', url: 'https://images.test/lisbon-2.jpg', alt: 'Tiled facade' },
            ],
        },
    ];

    const handlersFor = () =>
        createBlogHandlers<Env>({
            ...baseConfig,
            requireAdmin: async () => ({ session: { user: { id: 'owner', organizationId: 'org-1' } } }),
            resolveAuthorId: async (_ctx, email) => (email === 'tomas@example.com' ? 'user-tomas' : null),
            demoPosts: seeds,
        });

    it('publishes each seed on its own date, by its own author, with reading time', async () => {
        const response = await handlersFor().handleBlogDemoSeed(ctxFor('/seed-demo', { method: 'POST' }));
        const body = (await response.json()) as { created: Array<{ slug: string; contentType: string }> };
        expect(body.created.map((c) => [c.slug, c.contentType])).toEqual([
            ['edge-one', 'blog'],
            ['blurb-one', 'blurb'],
            ['two-days-in-lisbon', 'photo'],
        ]);

        const [article, blurb, journal] = created();
        expect(article).toEqual(
            expect.objectContaining({
                authorId: 'user-tomas',
                userId: 'user-tomas',
                publishedAt: '2026-04-02T09:00:00.000Z',
                postedAt: '2026-04-02T09:00:00.000Z',
                readingTimeMinutes: 1,
                wordCount: 10,
                seriesId: 'Building on the edge-id',
                seriesOrder: 1,
            }),
        );
        // An unknown author email falls back to the caller
        expect(blurb).toEqual(expect.objectContaining({ authorId: 'owner', userId: 'owner', contentType: 'blurb' }));
        expect(journal).toEqual(expect.objectContaining({ authorId: 'owner', contentType: 'photo' }));
    });

    it('creates missing terms once and links tags and categories to the post', async () => {
        await handlersFor().handleBlogDemoSeed(ctxFor('/seed-demo', { method: 'POST' }));

        // "Cloudflare" and "cloudflare" are one tag; Workers is the other
        expect(vi.mocked(PostTag.create).mock.calls.map(([d]) => (d as any).name)).toEqual(['Cloudflare', 'Workers']);
        expect(vi.mocked(PostTagLink.create).mock.calls.map(([d]) => d)).toEqual([
            { postId: 'id-edge-one', tagId: 'Cloudflare-id' },
            { postId: 'id-edge-one', tagId: 'Workers-id' },
        ]);
        expect(vi.mocked(PostCategoryLink.create)).toHaveBeenCalledWith({
            postId: 'id-edge-one',
            categoryId: 'Engineering-id',
        });
        expect(vi.mocked(PostSeries.create)).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Building on the edge', description: 'Four parts.', appId: 'test-app' }),
        );
    });

    it('derives a blurb title and excerpt from its text, and a journal hero from its lead photo', async () => {
        await handlersFor().handleBlogDemoSeed(ctxFor('/seed-demo', { method: 'POST' }));
        const [, blurb, journal] = created();

        expect(blurb.title).toMatch(/^Shipped the audit timeline today/);
        expect(blurb.blurbText).toBe(seeds[1].blurbText);
        expect(blurb.crossposts).toEqual([{ url: 'https://social.example/p/1' }]);
        expect(blurb).not.toHaveProperty('content');

        expect(journal.photoAlbum).toHaveLength(2);
        expect(journal.photoNote).toBe('Trams, tiles and one very long lunch.');
        expect(journal.excerpt).toBe('Trams, tiles and one very long lunch.');
        expect(journal.heroImage).toEqual({
            url: 'https://images.test/lisbon-1.jpg',
            alt: 'Tram 28 at dawn',
            caption: 'Tram 28 at dawn',
        });
        expect(journal).not.toHaveProperty('content');
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
