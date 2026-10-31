/**
 * /api/landing is platform-admin only, scopes everything to the app the guard resolved from
 * server config (never request input), and turns model validation failures into field-level
 * 4xx responses the admin form can highlight. The models themselves are exercised against a
 * real SQLite database in packages/ottalanding.
 */
import { DomainValidationError } from '@ottabase/ottaorm';
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminAccess = vi.hoisted(() => vi.fn());
vi.mock('../../lib/admin-guard', () => ({ requireAdminAccess }));

const models = vi.hoisted(() => ({
    ensureForApp: vi.fn(),
    findSite: vi.fn(),
    saveSettings: vi.fn(),
    forApp: vi.fn(),
    createFor: vi.fn(),
    updateFor: vi.fn(),
    deleteFor: vi.fn(),
    findForApp: vi.fn(),
    previewTokenFor: vi.fn(),
    inbox: vi.fn(),
    setRead: vi.fn(),
    deleteLead: vi.fn(),
}));
vi.mock('@ottabase/ottalanding', async (importOriginal) => {
    const { LEAD_KINDS, leadsToCsv } = await importOriginal<typeof import('@ottabase/ottalanding')>();
    return {
        LEAD_KINDS,
        leadsToCsv,
        LandingSite: {
            ensureForApp: models.ensureForApp,
            findForApp: models.findSite,
            saveSettings: models.saveSettings,
        },
        LandingPage: {
            forApp: models.forApp,
            createFor: models.createFor,
            updateFor: models.updateFor,
            deleteFor: models.deleteFor,
            findForApp: models.findForApp,
            previewTokenFor: models.previewTokenFor,
        },
        LandingLead: { inbox: models.inbox, setRead: models.setRead, deleteFor: models.deleteLead },
    };
});
const ensureLeadNotifyTask = vi.hoisted(() => vi.fn());
vi.mock('../../lib/landing-notify', () => ({ ensureLeadNotifyTask }));

// The files service: share images are stored and released through it, never written to R2 here.
const files = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn(), remove: vi.fn(), keyOf: vi.fn() }));
vi.mock('../../../ottabase/files', () => ({ files }));

import {
    handleLandingGet,
    handleLandingLeadDelete,
    handleLandingLeadsList,
    handleLandingLeadUpdate,
    handleLandingPageCreate,
    handleLandingPageDelete,
    handleLandingPagePreview,
    handleLandingPageUpdate,
    handleLandingShareImage,
    handleLandingSiteUpdate,
} from '../landing';

function ctx(method: string, path: string, body?: unknown) {
    const request = new Request(`http://localhost${path}`, {
        method,
        headers: { 'content-type': 'application/json', 'x-app-id': 'attacker-app' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { request, env: {} as CloudflareEnv, url: new URL(request.url) } as never;
}

/** A multipart POST. */
function formCtx(fields: Record<string, string | Blob>) {
    // The handler only reads formData().get(); jsdom can't round-trip a real multipart body.
    const request = { formData: async () => ({ get: (key: string) => fields[key] ?? null }) };
    return { request, env: {} as CloudflareEnv } as never;
}
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

const page = (id: string) => ({ toPage: () => ({ id, path: '/x' }) });

describe('/api/landing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireAdminAccess.mockResolvedValue({ appId: 'otta-web' });
    });

    it.each([
        ['GET /', () => handleLandingGet(ctx('GET', '/api/landing'))],
        ['PUT /site', () => handleLandingSiteUpdate(ctx('PUT', '/api/landing/site', {}))],
        ['POST /pages', () => handleLandingPageCreate(ctx('POST', '/api/landing/pages', {}))],
        ['PUT /pages/:id', () => handleLandingPageUpdate(ctx('PUT', '/api/landing/pages/p1', {}), 'p1')],
        ['DELETE /pages/:id', () => handleLandingPageDelete(ctx('DELETE', '/api/landing/pages/p1'), 'p1')],
        ['POST /pages/:id/preview', () => handleLandingPagePreview(ctx('POST', '/x', {}), 'p1')],
        ['POST /share-image', () => handleLandingShareImage(formCtx({ target: 'site', file: new Blob([PNG]) }))],
        ['GET /leads', () => handleLandingLeadsList(ctx('GET', '/api/landing/leads'))],
        ['PATCH /leads/:id', () => handleLandingLeadUpdate(ctx('PATCH', '/x', { read: true }), 'l1')],
        ['DELETE /leads/:id', () => handleLandingLeadDelete(ctx('DELETE', '/x'), 'l1')],
    ])('%s refuses anyone who is not a platform admin and touches no data', async (_name, call) => {
        requireAdminAccess.mockResolvedValue(new Response(null, { status: 403 }));
        expect((await call()).status).toBe(403);
        expect(requireAdminAccess).toHaveBeenCalledWith(expect.anything(), { scope: 'system' });
        for (const fn of Object.values(models)) expect(fn).not.toHaveBeenCalled();
    });

    it('reads the app from the guard (server config), ignoring request headers', async () => {
        models.ensureForApp.mockResolvedValue({ getSettings: () => ({ name: 'Acme' }) });
        models.forApp.mockResolvedValue([page('p1')]);
        const res = await handleLandingGet(ctx('GET', '/api/landing'));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ site: { name: 'Acme' }, pages: [{ id: 'p1', path: '/x' }] });
        expect(models.ensureForApp).toHaveBeenCalledWith('otta-web');
        expect(models.forApp).toHaveBeenCalledWith('otta-web');
    });

    it('passes the body to the model and returns the created page', async () => {
        models.createFor.mockResolvedValue(page('new'));
        const res = await handleLandingPageCreate(
            ctx('POST', '/api/landing/pages', { title: 'Pricing', path: '/pricing' }),
        );
        expect(res.status).toBe(201);
        expect(models.createFor).toHaveBeenCalledWith('otta-web', { title: 'Pricing', path: '/pricing' });
    });

    it('maps validation failures to a 4xx with per-field errors', async () => {
        models.updateFor.mockRejectedValue(
            new DomainValidationError('Please fix the highlighted fields.', {
                fieldErrors: { 'sections.0.data.title': ['Required'] },
            }),
        );
        const res = await handleLandingPageUpdate(ctx('PUT', '/api/landing/pages/p1', {}), 'p1');
        expect(res.status).toBe(422);
        expect(await res.json()).toMatchObject({ fieldErrors: { 'sections.0.data.title': ['Required'] } });
    });

    it('returns 404 for a page that is not in this app', async () => {
        models.updateFor.mockResolvedValue(null);
        models.deleteFor.mockResolvedValue(false);
        expect((await handleLandingPageUpdate(ctx('PUT', '/x', {}), 'other')).status).toBe(404);
        expect((await handleLandingPageDelete(ctx('DELETE', '/x'), 'other')).status).toBe(404);
    });

    it('lets unexpected failures reach the error boundary instead of leaking them', async () => {
        models.saveSettings.mockRejectedValue(new Error('D1 exploded'));
        await expect(handleLandingSiteUpdate(ctx('PUT', '/api/landing/site', {}))).rejects.toThrow('D1 exploded');
    });

    it('hands out a page’s preview token, and a new one only when asked to reset', async () => {
        models.previewTokenFor.mockResolvedValue('tok_abcdefghijklmnopqrstu');
        const res = await handleLandingPagePreview(ctx('POST', '/x', {}), 'p1');
        expect(await res.json()).toEqual({ token: 'tok_abcdefghijklmnopqrstu' });
        expect(models.previewTokenFor).toHaveBeenLastCalledWith('otta-web', 'p1', false);
        await handleLandingPagePreview(ctx('POST', '/x', { reset: true }), 'p1');
        expect(models.previewTokenFor).toHaveBeenLastCalledWith('otta-web', 'p1', true);
        await handleLandingPagePreview(ctx('POST', '/x', { reset: 'yes' }), 'p1');
        expect(models.previewTokenFor).toHaveBeenLastCalledWith('otta-web', 'p1', false);

        models.previewTokenFor.mockResolvedValue(null);
        expect((await handleLandingPagePreview(ctx('POST', '/x', {}), 'other')).status).toBe(404);
    });

    describe('social images', () => {
        // Files as the Worker runtime has them (jsdom's lack arrayBuffer/stream).
        beforeEach(() => {
            vi.stubGlobal('File', NodeFile);
            vi.stubGlobal('Blob', NodeBlob);
        });
        afterEach(() => vi.unstubAllGlobals());

        const OLD = '/api/files/public/otta-web/share-image/' + 'a'.repeat(32) + '.png';
        const NEW = '/api/files/public/otta-web/share-image/' + 'b'.repeat(32) + '.png';
        beforeEach(() => {
            files.put.mockResolvedValue({ url: NEW });
            files.keyOf.mockImplementation((_env: unknown, url: string) =>
                url.startsWith('/api/files/public/') ? url.slice('/api/files/public/'.length) : null,
            );
            files.get.mockResolvedValue({ purpose: 'share-image' });
            files.remove.mockResolvedValue(true);
        });

        it('stores the image through the files service as an app-owned share image, at a new key each time', async () => {
            const file = new File([PNG], 'card.bin', { type: 'application/octet-stream' });
            const res = await handleLandingShareImage(formCtx({ target: 'site', file }));
            expect(res.status).toBe(201);
            expect(await res.json()).toEqual({ url: NEW });
            expect(files.put).toHaveBeenCalledWith(expect.anything(), {
                purpose: 'share-image',
                owner: { appId: 'otta-web', userId: null, organizationId: null },
                file,
                name: 'share-site.png',
            });
        });

        it('turns a refusal from the files service (type, size) into a 4xx', async () => {
            const { FilesError } = await import('@ottabase/ottaupload/server');
            files.put.mockRejectedValue(new FilesError(415, 'UNSUPPORTED_TYPE', 'no'));
            const svg = new File(['<svg onload=alert(1)>'], 'x.png', { type: 'image/png' });
            const res = await handleLandingShareImage(formCtx({ target: 'site', file: svg }));
            expect(res.status).toBe(415);
            expect(await res.json()).toMatchObject({ code: 'UNSUPPORTED_TYPE' });
        });

        it('stores a page’s image only for a page of this app', async () => {
            models.findForApp.mockResolvedValue(null);
            const res = await handleLandingShareImage(
                formCtx({ target: 'p-other', file: new File([PNG], 'card.png') }),
            );
            expect(res.status).toBe(404);
            expect(models.findForApp).toHaveBeenCalledWith('otta-web', 'p-other');
            expect(files.put).not.toHaveBeenCalled();
        });

        it('deletes the previous image once a save points elsewhere, and only its own share images', async () => {
            const withImage = (url: string | null) => ({
                toPage: () => ({ id: 'p1', share: url ? { imageUrl: url } : null }),
            });
            models.findForApp.mockResolvedValue(withImage(OLD));
            models.updateFor.mockResolvedValue(withImage(NEW));
            await handleLandingPageUpdate(ctx('PUT', '/api/landing/pages/p1', {}), 'p1');
            expect(files.remove).toHaveBeenCalledWith(expect.anything(), 'a'.repeat(32));

            files.remove.mockClear();
            models.findForApp.mockResolvedValue(withImage('https://elsewhere.example/og.png'));
            await handleLandingPageUpdate(ctx('PUT', '/api/landing/pages/p1', {}), 'p1');
            files.get.mockResolvedValue({ purpose: 'media' });
            models.findForApp.mockResolvedValue(withImage(OLD));
            await handleLandingPageUpdate(ctx('PUT', '/api/landing/pages/p1', {}), 'p1');
            expect(files.remove).not.toHaveBeenCalled();
        });

        it('removes a deleted page’s image too', async () => {
            models.findForApp.mockResolvedValue({ toPage: () => ({ id: 'p1', share: { imageUrl: OLD } }) });
            models.deleteFor.mockResolvedValue(true);
            expect((await handleLandingPageDelete(ctx('DELETE', '/api/landing/pages/p1'), 'p1')).status).toBe(200);
            expect(files.remove).toHaveBeenCalledWith(expect.anything(), 'a'.repeat(32));
        });
    });

    describe('form entries', () => {
        const lead = {
            id: 'l1',
            kind: 'contact',
            email: 'a@b.co',
            name: '=cmd',
            message: 'Hi',
            pagePath: '/',
            read: false,
            createdAt: '2026-10-11T00:00:00.000Z',
        };

        it('lists a page of the inbox, filtered by a known kind only', async () => {
            models.inbox.mockResolvedValue({ leads: [lead], total: 1, unread: 1 });
            const res = await handleLandingLeadsList(ctx('GET', '/api/landing/leads?kind=signup&offset=50'));
            expect(await res.json()).toEqual({ leads: [lead], total: 1, unread: 1 });
            expect(models.inbox).toHaveBeenLastCalledWith('otta-web', { kind: 'signup', limit: 50, offset: 50 });
            await handleLandingLeadsList(ctx('GET', '/api/landing/leads?kind=everything&offset=-3'));
            expect(models.inbox).toHaveBeenLastCalledWith('otta-web', { kind: undefined, limit: 50, offset: 0 });
        });

        it('exports CSV as an uncached download, with formula cells defused', async () => {
            models.inbox.mockResolvedValue({ leads: [lead], total: 1, unread: 1 });
            const res = await handleLandingLeadsList(ctx('GET', '/api/landing/leads?format=csv'));
            expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
            expect(res.headers.get('content-disposition')).toMatch(
                /^attachment; filename="form-entries-\d{4}-\d{2}-\d{2}\.csv"$/,
            );
            expect(res.headers.get('cache-control')).toBe('no-store');
            expect(await res.text()).toContain(`"'=cmd"`);
        });

        it('marks read or unread, and deletes, only entries of this app', async () => {
            models.setRead.mockResolvedValue(true);
            expect((await handleLandingLeadUpdate(ctx('PATCH', '/x', { read: false }), 'l1')).status).toBe(200);
            expect(models.setRead).toHaveBeenCalledWith('otta-web', 'l1', false);
            expect((await handleLandingLeadUpdate(ctx('PATCH', '/x', { read: 'yes' }), 'l1')).status).toBe(400);
            models.setRead.mockResolvedValue(false);
            expect((await handleLandingLeadUpdate(ctx('PATCH', '/x', { read: true }), 'other')).status).toBe(404);
            models.deleteLead.mockResolvedValue(false);
            expect((await handleLandingLeadDelete(ctx('DELETE', '/x'), 'other')).status).toBe(404);
        });

        it('turns on the notification task, linking to the admin it was set from, once an address is saved', async () => {
            models.saveSettings.mockResolvedValue({ getSettings: () => ({ name: 'Acme', leadEmail: 'me@acme.dev' }) });
            const request = new Request('http://127.0.0.1:3004/api/landing/site', {
                method: 'PUT',
                headers: { 'content-type': 'application/json', origin: 'http://localhost:3003' },
                body: '{}',
            });
            await handleLandingSiteUpdate({ request, env: {}, url: new URL(request.url) } as never);
            expect(ensureLeadNotifyTask).toHaveBeenCalledWith(
                'otta-web',
                'http://localhost:3003/admin/content/landing/leads',
            );

            ensureLeadNotifyTask.mockClear();
            models.saveSettings.mockResolvedValue({ getSettings: () => ({ name: 'Acme' }) });
            await handleLandingSiteUpdate(ctx('PUT', '/api/landing/site', {}));
            expect(ensureLeadNotifyTask).not.toHaveBeenCalled();
        });
    });
});
