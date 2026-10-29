import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/admin-guard', () => ({
    requireAdminAccess: vi.fn(),
}));

vi.mock('../../lib/auth-utils', () => ({
    getSecurityContext: vi.fn(async () => ({ userId: 'u1', platformAdmin: true, appId: 'web' })),
}));

const executeSecureCrudRequest = vi.fn();
const auditLog = vi.fn(async (_data: Record<string, unknown>) => undefined);
const registry = new Map<string, { model: Record<string, unknown>; metadata: Record<string, unknown> }>();

vi.mock('@ottabase/ottaorm', async (importOriginal) => ({
    // The relation loader, the spec parser and the denylist are the real ones.
    ...(await importOriginal<typeof import('@ottabase/ottaorm')>()),
    executeSecureCrudRequest: (...args: unknown[]) => executeSecureCrudRequest(...args),
    parseCrudRequest: async (request: Request, url: URL, base: string) => {
        const parts = url.pathname
            .slice(base.length + 1)
            .split('/')
            .filter(Boolean);
        const body = ['POST', 'PATCH', 'PUT'].includes(request.method) ? await request.json() : undefined;
        return { method: request.method, model: parts[0], id: parts[1], body, query: undefined };
    },
    getCrudHubModel: (entity: string) => {
        const entry = registry.get(entity);
        return entry && (entry.model.admin as { enabled?: boolean } | undefined)?.enabled && entity !== 'users'
            ? entry
            : null;
    },
    listCrudHubModels: () =>
        [...registry.values()]
            .filter((e) => (e.model.admin as { enabled?: boolean } | undefined)?.enabled && e.model.entity !== 'users')
            .map((e) => ({
                entity: e.model.entity,
                scope: (e.model.admin as { scope?: string }).scope ?? 'system',
                fields: {},
                actions: [],
            })),
    describeCrudHubModel: (entry: { model: { entity: string } }) => ({ entity: entry.model.entity }),
}));

vi.mock('@ottabase/ottaorm/models', () => ({
    AuditLog: { log: (data: Record<string, unknown>) => auditLog(data) },
}));

import { requireAdminAccess } from '../../lib/admin-guard';
import { handleCrudHubAction, handleCrudHubCrud, handleCrudHubModels } from '../admin-crudhub';

function context(path: string, init?: RequestInit) {
    const request = new Request(`http://localhost${path}`, init);
    return { request, env: { OBCF_D1: {} }, url: new URL(request.url) } as never;
}

const platformAdmin = {
    user: { id: 'u1', email: 'a@x' },
    organizationId: 'system',
    appId: 'web',
    rbac: { permissions: ['*:*'] },
    session: { user: { platformAdmin: true } },
};
const orgAdmin = {
    user: { id: 'u2' },
    organizationId: 'org-1',
    appId: 'web',
    rbac: { permissions: ['org:admin'] },
    session: { user: { platformAdmin: false } },
};

const run = vi.fn(async () => ({ done: true }));

beforeEach(() => {
    vi.clearAllMocks();
    registry.clear();
    registry.set('posts', {
        model: {
            entity: 'posts',
            primaryKey: 'id',
            admin: { enabled: true, scope: 'org' },
            adminActions: {
                feature: { title: 'Feature', when: (row: { isFeatured?: boolean }) => !row.isFeatured, run },
            },
        },
        metadata: {},
    });
    registry.set('tags', {
        model: { entity: 'tags', primaryKey: 'id', admin: { enabled: true, scope: 'system', readOnly: true } },
        metadata: {},
    });
    registry.set('users', { model: { entity: 'users', primaryKey: 'id', admin: { enabled: true } }, metadata: {} });
    registry.set('todos', { model: { entity: 'todos', primaryKey: 'id' }, metadata: {} });
    registry.set('media', {
        model: {
            entity: 'media',
            primaryKey: 'id',
            admin: { enabled: true, scope: 'org', readOnly: true },
            adminActions: { reindex: { title: 'Reindex', run } },
        },
        metadata: {},
    });
    vi.mocked(requireAdminAccess).mockResolvedValue(platformAdmin as never);
});

describe('GET /api/admin/crudhub', () => {
    it('hides system-scoped models from an org admin', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(orgAdmin as never);
        const body = (await (await handleCrudHubModels(context('/api/admin/crudhub'))).json()) as {
            models: { entity: string }[];
        };
        expect(body.models.map((m) => m.entity).sort()).toEqual(['media', 'posts']);
    });

    it('shows everything opted in (never users) to a platform admin', async () => {
        const body = (await (await handleCrudHubModels(context('/api/admin/crudhub'))).json()) as {
            models: { entity: string }[];
        };
        expect(body.models.map((m) => m.entity).sort()).toEqual(['media', 'posts', 'tags']);
    });
});

describe('/api/admin/crudhub/{model}', () => {
    it('404s a model that did not opt in and a denylisted table that did', async () => {
        expect((await handleCrudHubCrud(context('/api/admin/crudhub/todos'), 'todos')).status).toBe(404);
        expect((await handleCrudHubCrud(context('/api/admin/crudhub/users'), 'users')).status).toBe(404);
        expect(requireAdminAccess).not.toHaveBeenCalled();
    });

    it('asks the guard for the model scope and refuses writes on a read-only model', async () => {
        executeSecureCrudRequest.mockResolvedValue({ success: true, status: 200, data: { data: [], pagination: {} } });
        await handleCrudHubCrud(context('/api/admin/crudhub/posts'), 'posts');
        // org models accept an org admin or a platform admin (no ORG_REQUIRED for a platform admin without an org)
        expect(requireAdminAccess).toHaveBeenLastCalledWith(expect.anything(), {
            scope: 'either',
            requiredPermissions: undefined,
        });

        const refused = await handleCrudHubCrud(
            context('/api/admin/crudhub/tags', {
                method: 'POST',
                body: '{"name":"x"}',
                headers: { 'content-type': 'application/json' },
            }),
            'tags',
        );
        expect(refused.status).toBe(403);
        expect(executeSecureCrudRequest).toHaveBeenCalledTimes(1);
    });

    it('passes a 403 from the guard through untouched', async () => {
        vi.mocked(requireAdminAccess).mockResolvedValue(new Response('no', { status: 403 }) as never);
        expect((await handleCrudHubCrud(context('/api/admin/crudhub/posts'), 'posts')).status).toBe(403);
    });

    it('audit-logs a write with field names only and annotates list rows with enabled actions', async () => {
        executeSecureCrudRequest.mockResolvedValueOnce({ success: true, status: 200, data: { id: 'p1', title: 'T' } });
        const response = await handleCrudHubCrud(
            context('/api/admin/crudhub/posts/p1', {
                method: 'PATCH',
                body: '{"title":"T","passwordHash":"zzz"}',
                headers: { 'content-type': 'application/json' },
            }),
            'posts',
        );
        expect(response.status).toBe(200);
        expect(auditLog).toHaveBeenCalledOnce();
        const logged = JSON.stringify(auditLog.mock.calls[0][0]);
        expect(logged).toContain('"fields":["title","passwordHash"]');
        expect(logged).not.toContain('zzz');

        executeSecureCrudRequest.mockResolvedValueOnce({
            success: true,
            status: 200,
            data: {
                data: [
                    { id: 'a', isFeatured: false },
                    { id: 'b', isFeatured: true },
                ],
                pagination: { total: 2 },
            },
        });
        const list = (await (await handleCrudHubCrud(context('/api/admin/crudhub/posts'), 'posts')).json()) as {
            data: Array<{ __actions: string[] }>;
        };
        expect(list.data.map((r) => r.__actions)).toEqual([['feature'], []]);
    });
});

describe('POST /api/admin/crudhub/{model}/{id}/actions/{key}', () => {
    it('runs a declared action on a row the caller can read, and refuses when `when` is false', async () => {
        executeSecureCrudRequest.mockResolvedValueOnce({
            success: true,
            status: 200,
            data: { id: 'p1', isFeatured: false },
        });
        const ok = await handleCrudHubAction(
            context('/api/admin/crudhub/posts/p1/actions/feature', { method: 'POST' }),
            'posts',
            'p1',
            'feature',
        );
        expect(ok.status).toBe(200);
        expect(run).toHaveBeenCalledOnce();
        expect(auditLog).toHaveBeenCalledOnce();

        executeSecureCrudRequest.mockResolvedValueOnce({
            success: true,
            status: 200,
            data: { id: 'p2', isFeatured: true },
        });
        const refused = await handleCrudHubAction(
            context('/api/admin/crudhub/posts/p2/actions/feature', { method: 'POST' }),
            'posts',
            'p2',
            'feature',
        );
        expect(refused.status).toBe(409);
        expect(run).toHaveBeenCalledOnce();
    });

    it('404s an undeclared action and a row outside the caller RLS scope', async () => {
        expect((await handleCrudHubAction(context('/x', { method: 'POST' }), 'posts', 'p1', 'nuke')).status).toBe(404);
        executeSecureCrudRequest.mockResolvedValueOnce({ success: false, status: 404, error: 'not found' });
        expect((await handleCrudHubAction(context('/x', { method: 'POST' }), 'posts', 'p9', 'feature')).status).toBe(
            404,
        );
    });
});

describe('readOnly models', () => {
    it('refuses generic writes but still runs a declared action', async () => {
        const patch = await handleCrudHubCrud(
            context('/api/admin/crudhub/media/m1', {
                method: 'PATCH',
                body: '{"title":"x"}',
                headers: { 'content-type': 'application/json' },
            }),
            'media',
        );
        expect(patch.status).toBe(403);
        expect(executeSecureCrudRequest).not.toHaveBeenCalled();

        executeSecureCrudRequest.mockResolvedValueOnce({ success: true, status: 200, data: { id: 'm1' } });
        const action = await handleCrudHubAction(context('/x', { method: 'POST' }), 'media', 'm1', 'reindex');
        expect(action.status).toBe(200);
        expect(run).toHaveBeenCalledOnce();
    });
});

describe('details relations', () => {
    it('loads admin.relations on a details read, links by entity, trims an unprojected denylisted relation', async () => {
        const { BaseModel } = await import('@ottabase/ottaorm');
        const { sqliteTable, text } = await import('drizzle-orm/sqlite-core');
        const table = (name: string) => sqliteTable(name, { id: text('id').primaryKey(), name: text('name') });
        class Person extends BaseModel {
            static entity = 'users';
            static table = table('users');
        }
        class Label extends BaseModel {
            static entity = 'post_tags';
            static table = table('post_tags');
        }
        class Article extends BaseModel {
            static entity = 'articles';
            static table = table('articles');
            static admin = { enabled: true, scope: 'org' as const, relations: ['author', 'tags:id{name}'] };
            async author() {
                return new (Person as any)({ entity: 'users', data: { id: 'u9', name: 'Ann', email: 'ann@x' } });
            }
            async tags() {
                return [
                    new (Label as any)({ entity: 'post_tags', data: { id: 't1', name: 'Design', slug: 'design' } }),
                ];
            }
        }
        registry.set('articles', { model: Article as never, metadata: {} });
        executeSecureCrudRequest.mockResolvedValueOnce({
            success: true,
            status: 200,
            data: { id: 'a1', name: 'Hello' },
        });

        const body = (await (
            await handleCrudHubCrud(context('/api/admin/crudhub/articles/a1'), 'articles')
        ).json()) as {
            __relations: Array<{ name: string; entity: string; many: boolean; items: unknown[] }>;
        };
        expect(body.__relations).toEqual([
            { name: 'author', entity: 'users', many: false, items: [{ id: 'u9', name: 'Ann' }], truncated: false },
            { name: 'tags', entity: 'post_tags', many: true, items: [{ id: 't1', name: 'Design' }], truncated: false },
        ]);
        expect(JSON.stringify(body)).not.toContain('ann@x');
    });
});
