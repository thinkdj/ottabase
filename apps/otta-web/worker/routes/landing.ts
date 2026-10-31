// /api/landing — admin editing for the landing site (@ottabase/ottalanding).
//
// Landing content is app-global and platform-owned, like brand settings: every route
// requires a platform admin, and the app comes from server config (via the guard),
// never from the request. The public site (apps/otta-landing) reads the same D1 rows
// directly through the package's models, so there are no public routes here.

import { LandingLead, LandingPage, LandingSite, LEAD_KINDS, leadsToCsv, type LeadKind } from '@ottabase/ottalanding';
import { DomainValidationError } from '@ottabase/ottaorm';
import { fileIdFromKey, FilesError } from '@ottabase/ottaupload/server';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { files } from '../../ottabase/files';
import { requireAdminAccess } from '../lib/admin-guard';
import { ensureLeadNotifyTask } from '../lib/landing-notify';
import { readJson } from '../lib/utils';
import type { ApiRouteContext } from './router';

/** Run an admin-only landing action, mapping validation failures to field-level 4xx responses. */
async function asAdmin(context: ApiRouteContext, action: (appId: string) => Promise<Response>): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'system' });
    if (auth instanceof Response) return auth;
    try {
        return await action(auth.appId);
    } catch (error) {
        if (error instanceof DomainValidationError) {
            return errorResponse(error.message, error.status, { code: error.code, fieldErrors: error.fieldErrors });
        }
        throw error;
    }
}

const notFound = () => errorResponse('Page not found', 404, { code: 'NOT_FOUND' });

/** Where the admin is served: the browser's Origin (behind a dev proxy), else this request's. */
function adminOrigin({ request, url }: ApiRouteContext): string {
    const origin = request.headers.get('origin');
    return origin && /^https?:\/\/[^/\s]+$/.test(origin) ? origin : url.origin;
}

/** GET /api/landing — the site settings and every page (seeds starter content on first use). */
export function handleLandingGet(context: ApiRouteContext): Promise<Response> {
    return asAdmin(context, async (appId) => {
        const site = await LandingSite.ensureForApp(appId);
        const pages = await LandingPage.forApp(appId);
        return jsonResponse({ site: site.getSettings(), pages: pages.map((p) => p.toPage()) });
    });
}

/** PUT /api/landing/site */
export function handleLandingSiteUpdate(context: ApiRouteContext): Promise<Response> {
    return asAdmin(context, async (appId) => {
        const before = shareImageOf((await LandingSite.findForApp(appId))?.getSettings());
        const site = await LandingSite.saveSettings(appId, await readJson(context.request));
        const settings = site.getSettings();
        await releaseShareImage(context.env, before, shareImageOf(settings));
        // A notification address gives the every-minute digest its inbox link (see landing-notify).
        if (settings.leadEmail)
            await ensureLeadNotifyTask(appId, `${adminOrigin(context)}/admin/content/landing/leads`);
        return jsonResponse({ site: settings });
    });
}

/** POST /api/landing/pages */
export function handleLandingPageCreate(context: ApiRouteContext): Promise<Response> {
    return asAdmin(context, async (appId) => {
        const page = await LandingPage.createFor(appId, await readJson(context.request));
        return jsonResponse({ page: page.toPage() }, 201);
    });
}

/** PUT /api/landing/pages/:id */
export function handleLandingPageUpdate(context: ApiRouteContext, id: string): Promise<Response> {
    return asAdmin(context, async (appId) => {
        const before = shareImageOf((await LandingPage.findForApp(appId, id))?.toPage());
        const page = await LandingPage.updateFor(appId, id, await readJson(context.request));
        if (!page) return notFound();
        await releaseShareImage(context.env, before, shareImageOf(page.toPage()));
        return jsonResponse({ page: page.toPage() });
    });
}

/** DELETE /api/landing/pages/:id — the page and its social image. */
export function handleLandingPageDelete(context: ApiRouteContext, id: string): Promise<Response> {
    return asAdmin(context, async (appId) => {
        const image = shareImageOf((await LandingPage.findForApp(appId, id))?.toPage());
        if (!(await LandingPage.deleteFor(appId, id))) return notFound();
        await releaseShareImage(context.env, image, null);
        return jsonResponse({ success: true });
    });
}

/**
 * POST /api/landing/pages/:id/preview — the page's preview-link token (made on first use).
 * Body `{ reset: true }` replaces it, so every link shared so far stops working.
 */
export function handleLandingPagePreview(context: ApiRouteContext, id: string): Promise<Response> {
    return asAdmin(context, async (appId) => {
        const { reset } = await readJson<{ reset?: unknown }>(context.request);
        const token = await LandingPage.previewTokenFor(appId, id, reset === true);
        return token ? jsonResponse({ token }) : notFound();
    });
}

// ── Social images ───────────────────────────────────────────────────────────

/** The rendered social image a site or page points at, if any. */
function shareImageOf(owner: { share?: { imageUrl?: string | null } | null } | null | undefined): string | null {
    return owner?.share?.imageUrl || null;
}

/**
 * Delete a social image once nothing points at it: a save that replaced it, or a deleted page.
 * Only this app's own share-image files are touched (an absolute URL someone pasted is left
 * alone). Best effort: a leftover image is harmless, a failed delete must not fail the save.
 */
async function releaseShareImage(env: CloudflareEnv, before: string | null, after: string | null): Promise<void> {
    if (!before || before === after) return;
    const key = files.keyOf(env, before);
    const id = key ? fileIdFromKey(key) : null;
    if (!id) return;
    const record = await files.get(env, id).catch(() => null);
    if (record?.purpose === 'share-image') await files.remove(env, id).catch(() => undefined);
}

/**
 * POST /api/landing/share-image — store the social image (multipart `file`, rendered in the
 * admin's browser) for `target`: `site`, or the id of one of this app's pages. Every save is a
 * new file at a new key (so caches never serve a stale one); the previous image goes when the
 * site or page is saved pointing at the new one.
 */
export function handleLandingShareImage(context: ApiRouteContext): Promise<Response> {
    return asAdmin(context, async (appId) => {
        const form = await context.request.formData().catch(() => null);
        const file = form?.get('file');
        const target = String(form?.get('target') ?? '');
        if (!(file instanceof File)) return errorResponse('Expected an image file', 400, { code: 'BAD_REQUEST' });
        if (target !== 'site' && !(await LandingPage.findForApp(appId, target))) return notFound();
        try {
            // The landing site is app-global: its images belong to no organization or person.
            const view = await files.put(context.env, {
                purpose: 'share-image',
                owner: { appId, userId: null, organizationId: null },
                file,
                name: `share-${target}.png`,
            });
            return jsonResponse({ url: view.url }, 201);
        } catch (error) {
            if (error instanceof FilesError) {
                return errorResponse('The social image must be a PNG, JPEG or WebP under 2 MB', error.status, {
                    code: error.code,
                });
            }
            throw error;
        }
    });
}

// ── Form entries (inbox) ────────────────────────────────────────────────────

const INBOX_PAGE = 50;
/** A spreadsheet export is everything, within reason. */
const EXPORT_LIMIT = 10_000;

/**
 * GET /api/landing/leads?kind=contact|signup&offset=0 — a page of the inbox, newest first.
 * With `format=csv`, every matching entry as a CSV download.
 */
export function handleLandingLeadsList(context: ApiRouteContext): Promise<Response> {
    return asAdmin(context, async (appId) => {
        const params = context.url.searchParams;
        const kind = LEAD_KINDS.find((k) => k === params.get('kind')) as LeadKind | undefined;
        if (params.get('format') === 'csv') {
            const { leads } = await LandingLead.inbox(appId, { kind, limit: EXPORT_LIMIT });
            return new Response(leadsToCsv(leads), {
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename="form-entries-${new Date().toISOString().slice(0, 10)}.csv"`,
                    'Cache-Control': 'no-store',
                },
            });
        }
        const offset = Math.max(0, Number.parseInt(params.get('offset') ?? '0', 10) || 0);
        return jsonResponse(await LandingLead.inbox(appId, { kind, limit: INBOX_PAGE, offset }));
    });
}

/** PATCH /api/landing/leads/:id — `{ read: boolean }` */
export function handleLandingLeadUpdate(context: ApiRouteContext, id: string): Promise<Response> {
    return asAdmin(context, async (appId) => {
        const { read } = await readJson<{ read?: unknown }>(context.request);
        if (typeof read !== 'boolean') return errorResponse('Expected { read: boolean }', 400, { code: 'BAD_REQUEST' });
        return (await LandingLead.setRead(appId, id, read))
            ? jsonResponse({ success: true })
            : errorResponse('Entry not found', 404, { code: 'NOT_FOUND' });
    });
}

/** DELETE /api/landing/leads/:id */
export function handleLandingLeadDelete(context: ApiRouteContext, id: string): Promise<Response> {
    return asAdmin(context, async (appId) =>
        (await LandingLead.deleteFor(appId, id))
            ? jsonResponse({ success: true })
            : errorResponse('Entry not found', 404, { code: 'NOT_FOUND' }),
    );
}
