/**
 * /api/files over the real files service, with the core purposes otta-web declares and
 * in-memory buckets and rows: who may upload what, where it lands, who may read, edit and
 * delete it, and that ownership comes from the session, never from the request.
 * The service's own rules (sniffing, stripping, tokens, ranges) are tested in @ottabase/ottaupload.
 */
import { File as NodeFile } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), enforceRateLimit: vi.fn(), auditLog: vi.fn() }));
vi.mock('@ottabase/ottaorm', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ottabase/ottaorm')>()),
    AuditLog: { log: mocks.auditLog },
}));
vi.mock('@ottabase/auth/backend', () => ({ getSession: mocks.getSession }));
vi.mock('../../lib/auth-utils', () => ({ getAuthOptions: vi.fn(() => ({})), bumpProfileVersion: vi.fn() }));
vi.mock('../../lib/rate-limiting', () => ({ enforceUploadRateLimit: mocks.enforceRateLimit }));
vi.mock('../../lib/db-utils', () => ({ initDbConnection: vi.fn() }));
vi.mock('../../../ottabase/config.loader', () => ({ getOttabaseConfig: () => ({ appId: 'otta-web' }) }));

// The real service, over memory: the same purposes the app declares, its buckets, its rows.
const world = vi.hoisted(() => ({
    rows: new Map<string, Record<string, unknown>>(),
    public: new Map<string, Uint8Array>(),
    private: new Map<string, Uint8Array>(),
}));
vi.mock('../../../ottabase/files', async () => {
    const { createFiles } = await import('@ottabase/ottaupload/server');
    const { corePackage } = await import('../../../ottabase/packages/core');
    const bucket = (objects: Map<string, Uint8Array>) => ({
        put: async (key: string, value: Uint8Array) => void objects.set(key, value),
        get: async (key: string) => {
            const body = objects.get(key);
            return body
                ? { key, size: body.length, httpEtag: '"e"', uploaded: new Date(0), body, writeHttpMetadata() {} }
                : null;
        },
        delete: async (keys: string | string[]) => {
            for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
        },
    });
    const store = {
        insert: async (record: Record<string, unknown>) => void world.rows.set(String(record.id), record),
        get: async (id: string) => (world.rows.get(id) as never) ?? null,
        update: async (id: string, fields: Record<string, unknown>) => {
            const row = world.rows.get(id);
            return row ? (Object.assign(row, fields) as never) : null;
        },
        delete: async (id: string) => void world.rows.delete(id),
        usedBytes: async () => 0,
        uploadedBy: async () => [],
    };
    return {
        files: createFiles({
            appId: () => 'otta-web',
            purposes: () => corePackage.files ?? [],
            store: store as never,
            buckets: () => ({ public: bucket(world.public) as never, private: bucket(world.private) as never }),
            quota: () => null,
        }),
    };
});

import {
    handleFilesDelete,
    handleFilesPublic,
    handleFilesQuarantine,
    handleFilesRead,
    handleFilesRestore,
    handleFilesUpdate,
    handleFilesUpload,
} from '../files';

const PNG = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 4, 0, 0, 0, 3,
]);

function as(
    user: { id: string; organizationId?: string | null; permissions?: string[]; platformAdmin?: boolean } | null,
) {
    mocks.getSession.mockResolvedValue(user ? { user } : null);
}

function ctx(method: string, path: string, init: { form?: Record<string, unknown>; json?: unknown } = {}) {
    const url = new URL(`https://app.test${path}`);
    const request = init.form
        ? // The handler only reads formData().get(); a jsdom multipart body does not round-trip.
          ({
              method,
              url: url.toString(),
              headers: new Headers({ 'x-org-id': 'org-attacker' }),
              formData: async () => ({ get: (key: string) => init.form![key] ?? null }),
          } as unknown as Request)
        : new Request(url, { method, body: init.json ? JSON.stringify(init.json) : undefined });
    return { request, env: {} as CloudflareEnv, url } as never;
}

async function upload(purpose: string, file: unknown = new NodeFile([PNG], 'me.png', { type: 'image/png' })) {
    return handleFilesUpload(ctx('POST', '/api/files', { form: { purpose, file, userId: 'someone-else' } }));
}

describe('/api/files', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        world.rows.clear();
        world.public.clear();
        world.private.clear();
        mocks.enforceRateLimit.mockResolvedValue(null);
        vi.stubGlobal('File', NodeFile);
    });
    afterEach(() => vi.unstubAllGlobals());

    it('needs a session, and is rate limited per user', async () => {
        as(null);
        expect((await upload('media')).status).toBe(401);
        as({ id: 'u1' });
        mocks.enforceRateLimit.mockResolvedValueOnce(new Response(null, { status: 429 }));
        expect((await upload('media')).status).toBe(429);
        expect(mocks.enforceRateLimit).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'u1');
    });

    it('stores a media upload in the public bucket, owned by the session (not the form, not a header)', async () => {
        as({ id: 'u1', organizationId: 'org-1' });
        const res = await upload('media');
        expect(res.status).toBe(201);
        const { file } = (await res.json()) as { file: Record<string, string> };
        expect(file).toMatchObject({ userId: 'u1', organizationId: 'org-1', appId: 'otta-web', audience: 'public' });
        expect(file.storageKey).toMatch(/^otta-web\/media\/[0-9a-f]{32}\.png$/);
        expect(world.public.has(file.storageKey)).toBe(true);
        expect(file.url).toBe(`/api/files/public/${file.storageKey}`);
    });

    it('refuses purposes that belong to their own route, unknown ones, and types a purpose does not allow', async () => {
        as({ id: 'u1' });
        for (const purpose of ['avatar', 'brand-asset', 'share-image', 'nope']) {
            const res = await upload(purpose);
            expect(res.status).toBe(400);
            expect(await res.json()).toMatchObject({ code: 'UNKNOWN_PURPOSE' });
        }
        const svg = new NodeFile(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'x.png', { type: 'image/png' });
        expect((await upload('media', svg)).status).toBe(415);
        expect(world.public.size).toBe(0);
    });

    it('keeps attachments private: same organization only, never served by key', async () => {
        as({ id: 'u1', organizationId: 'org-1' });
        const { file } = (await (await upload('attachment')).json()) as { file: Record<string, string> };
        expect(world.private.has(file.storageKey)).toBe(true);
        expect(file.url).toBe(`/api/files/${file.id}`);

        as({ id: 'u2', organizationId: 'org-1' });
        expect((await handleFilesRead(ctx('GET', file.url), file.id)).status).toBe(200);
        as({ id: 'u3', organizationId: 'org-2' });
        expect((await handleFilesRead(ctx('GET', file.url), file.id)).status).toBe(403);
        as(null);
        expect((await handleFilesRead(ctx('GET', file.url), file.id)).status).toBe(401);
        // The public route reads the public bucket only: a private key is simply not there.
        expect((await handleFilesPublic(ctx('GET', '/x'), file.storageKey)).status).toBe(404);
    });

    it('redirects a public file by id, and 404s a malformed id without a lookup', async () => {
        as({ id: 'u1' });
        const { file } = (await (await upload('media')).json()) as { file: Record<string, string> };
        as(null);
        const res = await handleFilesRead(ctx('GET', `/api/files/${file.id}`), file.id);
        expect(res.status).toBe(302);
        expect(res.headers.get('Location')).toBe(file.url);
        expect((await handleFilesRead(ctx('GET', '/api/files/../x'), '../x')).status).toBe(404);
    });

    it('lets the uploader and org admins edit and delete, nobody else', async () => {
        as({ id: 'u1', organizationId: 'org-1' });
        const { file } = (await (await upload('media')).json()) as { file: Record<string, string> };

        as({ id: 'u2', organizationId: 'org-1' });
        expect((await handleFilesUpdate(ctx('PATCH', '/x', { json: { title: 'Mine now' } }), file.id)).status).toBe(
            403,
        );
        expect((await handleFilesDelete(ctx('DELETE', '/x'), file.id)).status).toBe(403);

        as({ id: 'u2', organizationId: 'org-1', permissions: ['media:manage'] });
        const edited = await handleFilesUpdate(ctx('PATCH', '/x', { json: { altText: ' A cat ' } }), file.id);
        expect(await edited.json()).toMatchObject({ file: { altText: 'A cat' } });

        as({ id: 'u1', organizationId: 'org-1' });
        expect((await handleFilesDelete(ctx('DELETE', '/x'), file.id)).status).toBe(200);
        expect(world.rows.size).toBe(0);
        expect(world.public.size).toBe(0);
    });

    it('never deletes an avatar, a brand asset or a share image from here (their rows point at them)', async () => {
        world.rows.set('b'.repeat(32), {
            id: 'b'.repeat(32),
            appId: 'otta-web',
            userId: 'u1',
            organizationId: null,
            purpose: 'avatar',
            audience: 'public',
            storageKey: `otta-web/avatar/${'b'.repeat(32)}.png`,
            variants: null,
        });
        as({ id: 'u1' });
        const res = await handleFilesDelete(ctx('DELETE', '/x'), 'b'.repeat(32));
        expect(res.status).toBe(409);
        expect(world.rows.size).toBe(1);
    });

    describe('quarantine', () => {
        async function publicFile() {
            as({ id: 'u1', organizationId: 'org-1' });
            return ((await (await upload('media')).json()) as { file: Record<string, string> }).file;
        }

        it('is for admins of the file’s organization (and platform admins) only', async () => {
            const file = await publicFile();
            as({ id: 'u1', organizationId: 'org-1' }); // the uploader is not a moderator
            expect((await handleFilesQuarantine(ctx('POST', '/x'), file.id)).status).toBe(403);
            as({ id: 'a2', organizationId: 'org-2', permissions: ['org:admin'] });
            expect((await handleFilesQuarantine(ctx('POST', '/x'), file.id)).status).toBe(403);
            as(null);
            expect((await handleFilesQuarantine(ctx('POST', '/x'), file.id)).status).toBe(401);
            expect(world.public.has(file.storageKey)).toBe(true);
            expect(mocks.auditLog).not.toHaveBeenCalled();
        });

        it('takes a public file out of the public bucket, says its cached URLs need purging, and audits it', async () => {
            const file = await publicFile();
            as({ id: 'admin', organizationId: 'org-1', permissions: ['media:manage'] });
            const res = await handleFilesQuarantine(ctx('POST', `/api/files/${file.id}/quarantine`), file.id);
            expect(res.status).toBe(200);
            const body = (await res.json()) as { file: { status: string }; purge: string; urls: string[] };
            expect(body).toMatchObject({ file: { status: 'quarantined' }, purge: 'manual' });
            expect(body.urls).toEqual([`https://app.test/api/files/public/${file.storageKey}`]);
            expect(world.public.has(file.storageKey)).toBe(false);
            expect(world.private.has(file.storageKey)).toBe(true);
            expect((await handleFilesPublic(ctx('GET', '/x'), file.storageKey)).status).toBe(404);
            expect(mocks.auditLog).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: 'files.quarantine',
                    resourceType: 'media',
                    resourceId: file.id,
                    userId: 'admin',
                    organizationId: 'org-1',
                }),
            );

            const restored = await handleFilesRestore(ctx('DELETE', `/api/files/${file.id}/quarantine`), file.id);
            expect(await restored.json()).toMatchObject({ file: { status: 'ready' } });
            expect(world.public.has(file.storageKey)).toBe(true);
            expect(mocks.auditLog).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'files.restore' }));
        });
    });
});
