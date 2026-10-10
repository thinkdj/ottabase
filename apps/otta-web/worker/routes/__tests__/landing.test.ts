/**
 * /api/landing is platform-admin only, scopes everything to the app the guard resolved from
 * server config (never request input), and turns model validation failures into field-level
 * 4xx responses the admin form can highlight. The models themselves are exercised against a
 * real SQLite database in packages/ottalanding.
 */
import { DomainValidationError } from '@ottabase/ottaorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAdminAccess = vi.hoisted(() => vi.fn());
vi.mock('../../lib/admin-guard', () => ({ requireAdminAccess }));

const models = vi.hoisted(() => ({
    ensureForApp: vi.fn(),
    saveSettings: vi.fn(),
    forApp: vi.fn(),
    createFor: vi.fn(),
    updateFor: vi.fn(),
    deleteFor: vi.fn(),
}));
vi.mock('@ottabase/ottalanding', () => ({
    LandingSite: { ensureForApp: models.ensureForApp, saveSettings: models.saveSettings },
    LandingPage: {
        forApp: models.forApp,
        createFor: models.createFor,
        updateFor: models.updateFor,
        deleteFor: models.deleteFor,
    },
}));

import {
    handleLandingGet,
    handleLandingPageCreate,
    handleLandingPageDelete,
    handleLandingPageUpdate,
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
});
