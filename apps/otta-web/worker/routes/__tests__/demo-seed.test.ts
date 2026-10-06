/**
 * The seed creates what is missing and counts what it finds, entity by entity.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { get: (key: string) => unknown; assignRole: ReturnType<typeof vi.fn> };
type Double = ReturnType<typeof model>;
const row = (fields: Record<string, unknown>): Row => ({ get: (key) => fields[key] ?? null, assignRole: vi.fn() });

/** A model double: `first` answers from `existing`, `create` records and returns a row with an id */
function model(name: string, existing: Record<string, unknown>[] = []) {
    const created: Record<string, unknown>[] = [];
    const matches = (where: Record<string, unknown>) => (fields: Record<string, unknown>) =>
        Object.entries(where).every(([key, value]) => fields[key] === value);
    return {
        created,
        first: vi.fn(async (where: Record<string, unknown>) => {
            const hit = [...existing, ...created].find(matches(where));
            return hit ? row(hit) : null;
        }),
        where: vi.fn(async (where: Record<string, unknown>) =>
            [...existing, ...created].filter(matches(where)).map(row),
        ),
        create: vi.fn(async (data: Record<string, unknown>) => {
            const fields = { id: `${name}-${created.length + 1}`, ...data };
            created.push(fields);
            return row(fields);
        }),
        findByName: vi.fn(async (roleName: string) => row({ id: `role-${roleName}` })),
    };
}

const mocks = vi.hoisted(() => {
    const models: Record<string, unknown> = {};
    return {
        models,
        seedDemoPosts: vi.fn(),
        notifyUser: vi.fn(async () => true),
        invalidate: vi.fn(),
        auditLog: vi.fn(async () => undefined),
        /** Forwards every static call to whichever double the current test installed under `name` */
        forward: (name: string) =>
            new Proxy({}, { get: (_target, key) => (models[name] as Record<PropertyKey, unknown>)[key] }),
    };
});

vi.mock('@ottabase/brand-engine/persistence', () => ({
    Menu: mocks.forward('Menu'),
    MenuItem: mocks.forward('MenuItem'),
    MenuSlotAssignment: mocks.forward('MenuSlotAssignment'),
    createBrandCache: () => ({ invalidate: mocks.invalidate }),
}));
vi.mock('@ottabase/comments', () => ({ Comment: mocks.forward('Comment') }));
vi.mock('@ottabase/notifications', () => ({ NotificationModel: mocks.forward('NotificationModel') }));
vi.mock('@ottabase/ottablog', () => ({ Post: mocks.forward('Post') }));
vi.mock('@ottabase/ottablog/router', () => ({ seedDemoPosts: mocks.seedDemoPosts }));
vi.mock('@ottabase/ottaorm', () => ({ Media: mocks.forward('Media') }));
vi.mock('@ottabase/ottaorm/models', () => ({
    AuditLog: { log: mocks.auditLog },
    OrganizationMember: mocks.forward('OrganizationMember'),
    Role: mocks.forward('Role'),
    User: mocks.forward('User'),
}));
vi.mock('@ottabase/shortlinks', () => ({ Shortlink: mocks.forward('Shortlink') }));
vi.mock('../../lib/admin-guard', () => ({
    requireAdminAccess: vi.fn(async () => ({
        user: { id: 'owner' },
        organizationId: 'system',
        session: { user: { id: 'owner', organizationId: 'org-1' } },
    })),
}));
vi.mock('../../lib/db-utils', () => ({ initDbConnection: vi.fn() }));
vi.mock('../../lib/brand-utils', () => ({ brandEnv: (env: unknown) => env }));
vi.mock('../../lib/notify', () => ({
    notifyUser: mocks.notifyUser,
    quietly: (work: () => Promise<unknown>) => work().catch(() => null),
}));
vi.mock('../../../ottabase/config.loader', () => ({
    getOttabaseConfig: () => ({ appId: 'otta-web', features: { ottablog: { mode: 'platform' } } }),
}));

import { DEMO_MEDIA, DEMO_POSTS, MENUS, PEOPLE, SHORTLINKS, THREADS } from '../../fixtures/demo';
import { requireAdminAccess } from '../../lib/admin-guard';
import { handleDemoSeed } from '../demo-seed';

const NAMES = [
    'Menu',
    'MenuItem',
    'MenuSlotAssignment',
    'Comment',
    'NotificationModel',
    'Post',
    'Media',
    'OrganizationMember',
    'Role',
    'User',
    'Shortlink',
];
const double = (name: string) => mocks.models[name] as Double;
const install = (name: string, existing: Record<string, unknown>[] = []) => {
    mocks.models[name] = model(name, existing);
};
const call = async () => {
    const url = new URL('http://x/api/admin/demo-seed');
    const res = await handleDemoSeed({
        request: new Request(url, { method: 'POST' }),
        env: { OBCF_KV: {} },
        url,
    } as never);
    return (await res.json()) as Record<string, { created: number; existing: number }>;
};
const postsForThreads = () => THREADS.map((t) => ({ id: `post-${t.slug}`, slug: t.slug, appId: 'otta-web' }));
const commentsInThreads = THREADS.reduce(
    (n, t) => n + t.comments.reduce((m, c) => m + 1 + (c.replies?.length ?? 0), 0),
    0,
);

describe('handleDemoSeed', () => {
    beforeEach(() => {
        for (const name of NAMES) install(name);
        mocks.seedDemoPosts.mockReset().mockImplementation(async (seeds: Array<{ slug: string }>) => ({
            created: seeds.map((s) => ({ id: 'p', slug: s.slug, contentType: 'blog' })),
            existing: [],
            total: seeds.length,
        }));
        mocks.notifyUser.mockClear();
        mocks.invalidate.mockClear();
    });

    it('fills an empty install and reports what it made', async () => {
        // Posts exist once the blog seed ran, so the comment threads can find them
        install('Post', postsForThreads());
        const summary = await call();

        expect(summary).toEqual({
            people: { created: PEOPLE.length, existing: 0 },
            media: { created: DEMO_MEDIA.length, existing: 0 },
            posts: { created: DEMO_POSTS.length, existing: 0, total: DEMO_POSTS.length },
            comments: { created: commentsInThreads, existing: 0 },
            shortlinks: { created: SHORTLINKS.length, existing: 0 },
            menus: { created: MENUS.length, existing: 0 },
            notifications: { created: 3, existing: 0 },
        });

        // People become members of the caller's organization, with their role
        expect(double('OrganizationMember').created).toHaveLength(PEOPLE.length);
        expect(double('OrganizationMember').created[0]).toEqual(
            expect.objectContaining({ organizationId: 'org-1', role: 'member', status: 'active' }),
        );
        // The blog seed gets the caller's scope and can resolve every author
        const [seeds, scope] = mocks.seedDemoPosts.mock.calls[0] as [
            unknown,
            { authorIdFor: (email: string) => string | null; organizationId: string; appId: string },
        ];
        expect(seeds).toBe(DEMO_POSTS);
        expect(scope).toEqual(expect.objectContaining({ appId: 'otta-web', organizationId: 'org-1', userId: 'owner' }));
        expect(scope.authorIdFor(PEOPLE[1]!.email)).toBe('User-2');
        expect(scope.authorIdFor('nobody@example.com')).toBeNull();
        // A reply hangs under its parent
        expect(double('Comment').created[1]).toEqual(
            expect.objectContaining({ parentId: 'Comment-1', depth: 1, targetType: 'post' }),
        );
        // Shortlinks are absolute, the menus fill both slots, and the brand cache is dropped
        expect(double('Shortlink').created[0]!.fullUrl).toBe('http://x/blog/series/building-on-the-edge');
        expect(double('MenuItem').created).toHaveLength(MENUS.reduce((n, m) => n + m.items.length, 0));
        expect(double('MenuSlotAssignment').created.map((s) => [s.slotName, s.renderType])).toEqual([
            ['header-nav', 'navbar'],
            ['footer-nav', 'footer'],
        ]);
        expect(mocks.invalidate).toHaveBeenCalledWith({ appId: 'otta-web' });
        expect(mocks.notifyUser).toHaveBeenCalledTimes(3);
        // The run is an audit entry of its own
        expect(mocks.auditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'owner',
                action: 'seed',
                resourceType: 'demo_content',
                metadata: summary,
            }),
        );
    });

    it('leaves a seeded install alone and counts what it found', async () => {
        install(
            'User',
            PEOPLE.map((p) => ({ id: `u-${p.email}`, email: p.email })),
        );
        install(
            'OrganizationMember',
            PEOPLE.map((p) => ({ organizationId: 'org-1', userId: `u-${p.email}` })),
        );
        install(
            'Media',
            DEMO_MEDIA.map((m) => ({ storageKey: m.storageKey, appId: 'otta-web' })),
        );
        install('Post', postsForThreads());
        install(
            'Comment',
            THREADS.map((t) => ({ targetType: 'post', targetId: `post-${t.slug}` })),
        );
        install(
            'Shortlink',
            SHORTLINKS.map((l) => ({ shortCode: l.code })),
        );
        install(
            'Menu',
            MENUS.map((m) => ({ id: `m-${m.slug}`, slug: m.slug, appId: 'otta-web' })),
        );
        install('MenuSlotAssignment', [{ appId: 'otta-web', slotName: 'header-nav' }]);
        install('NotificationModel', [
            { userId: 'owner', title: 'Four people joined your organization' },
            { userId: 'owner', title: 'New comments on the blog' },
            { userId: 'owner', title: 'Demo content is in place' },
        ]);
        mocks.seedDemoPosts.mockResolvedValue({
            created: [],
            existing: DEMO_POSTS.map((p) => p.slug),
            total: DEMO_POSTS.length,
        });

        const summary = await call();

        expect(summary).toEqual({
            people: { created: 0, existing: PEOPLE.length },
            media: { created: 0, existing: DEMO_MEDIA.length },
            posts: { created: 0, existing: DEMO_POSTS.length, total: DEMO_POSTS.length },
            comments: { created: 0, existing: THREADS.reduce((n, t) => n + t.comments.length, 0) },
            shortlinks: { created: 0, existing: SHORTLINKS.length },
            menus: { created: 0, existing: MENUS.length },
            notifications: { created: 0, existing: 3 },
        });
        for (const name of NAMES) expect(double(name).create).not.toHaveBeenCalled();
        expect(mocks.invalidate).not.toHaveBeenCalled();
    });

    it('returns the guard response when the caller is not a platform admin', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValueOnce(new Response(null, { status: 403 }));
        const url = new URL('http://x/api/admin/demo-seed');
        const res = await handleDemoSeed({ request: new Request(url, { method: 'POST' }), env: {}, url } as never);
        expect(res.status).toBe(403);
        expect(mocks.seedDemoPosts).not.toHaveBeenCalled();
    });
});
