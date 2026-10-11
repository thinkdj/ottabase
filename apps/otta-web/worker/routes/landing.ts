// /api/landing — admin editing for the landing site (@ottabase/ottalanding).
//
// Landing content is app-global and platform-owned, like brand settings: every route
// requires a platform admin, and the app comes from server config (via the guard),
// never from the request. The public site (apps/otta-landing) reads the same D1 rows
// directly through the package's models, so there are no public routes here.

import { createR2Client } from '@ottabase/cf/r2';
import { LandingLead, LandingPage, LandingSite, LEAD_KINDS, leadsToCsv, type LeadKind } from '@ottabase/ottalanding';
import { deleteFileFromR2, uploadFileToR2 } from '@ottabase/ottaupload/server';
import { DomainValidationError } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
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
        const site = await LandingSite.saveSettings(appId, await readJson(context.request));
        const settings = site.getSettings();
        // A notification address turns on the every-minute digest task (see landing-notify).
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
        const page = await LandingPage.updateFor(appId, id, await readJson(context.request));
        return page ? jsonResponse({ page: page.toPage() }) : notFound();
    });
}

/** DELETE /api/landing/pages/:id — the page and its social image. */
export function handleLandingPageDelete(context: ApiRouteContext, id: string): Promise<Response> {
    return asAdmin(context, async (appId) => {
        if (!(await LandingPage.deleteFor(appId, id))) return notFound();
        const r2 = r2Client(context.env);
        // Best effort: a leftover image is harmless, a failed delete must not fail the request.
        if (r2) await deleteFileFromR2(shareImageKey(appId, id), r2).catch(() => undefined);
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

/** Rendered in the admin's browser (the editor's own canvas), so the server only stores it. */
const SHARE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** One fixed key per site or page, overwritten on each save, so old renders never pile up. */
function shareImageKey(appId: string, target: string): string {
    return `landing/${appId}/share/${target}.png`;
}

function r2Client(env: CloudflareEnv) {
    // The env's R2Bucket and @ottabase/cf's come from different workers-types copies (DOM vs Workers Headers).
    return env.OBCF_R2 ? createR2Client({ bucket: env.OBCF_R2 as never }) : null;
}

async function isPng(file: File): Promise<boolean> {
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    return PNG_SIGNATURE.every((byte, i) => head[i] === byte);
}

/**
 * POST /api/landing/share-image — store the social image (multipart `file`, PNG) for `target`:
 * `site`, or the id of one of this app's pages. Returns its URL, cache-busted with `?v=`.
 */
export function handleLandingShareImage(context: ApiRouteContext): Promise<Response> {
    return asAdmin(context, async (appId) => {
        const r2 = r2Client(context.env);
        if (!r2) return errorResponse('Uploads are not configured', 500, { code: 'CONFIG_ERROR' });
        const form = await context.request.formData().catch(() => null);
        const file = form?.get('file');
        const target = String(form?.get('target') ?? '');
        if (!(file instanceof File)) return errorResponse('Expected an image file', 400, { code: 'BAD_REQUEST' });
        if (target !== 'site' && !(await LandingPage.findForApp(appId, target))) return notFound();
        if (file.size > SHARE_IMAGE_MAX_BYTES || !(await isPng(file))) {
            return errorResponse('The social image must be a PNG under 2 MB', 400, { code: 'INVALID_IMAGE' });
        }
        const key = shareImageKey(appId, target);
        // Stored as image/png whatever the browser labelled it: the bytes were just checked.
        const png = new File([file], 'share.png', { type: 'image/png' });
        const result = await uploadFileToR2(png, r2, {
            maxFileSize: SHARE_IMAGE_MAX_BYTES,
            generateKey: () => key,
            getUrl: (k) => `/api/upload/file/${k}?v=${Date.now()}`,
        });
        if (!result.success || !result.url) {
            return errorResponse('The social image could not be stored', 500, { code: 'UPLOAD_FAILED' });
        }
        return jsonResponse({ url: result.url }, 201);
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
