// /api/landing — admin editing for the landing site (@ottabase/ottalanding).
//
// Landing content is app-global and platform-owned, like brand settings: every route
// requires a platform admin, and the app comes from server config (via the guard),
// never from the request. The public site (apps/otta-landing) reads the same D1 rows
// directly through the package's models, so there are no public routes here.

import { LandingPage, LandingSite } from '@ottabase/ottalanding';
import { DomainValidationError } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { requireAdminAccess } from '../lib/admin-guard';
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
        return jsonResponse({ site: site.getSettings() });
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

/** DELETE /api/landing/pages/:id */
export function handleLandingPageDelete(context: ApiRouteContext, id: string): Promise<Response> {
    return asAdmin(context, async (appId) =>
        (await LandingPage.deleteFor(appId, id)) ? jsonResponse({ success: true }) : notFound(),
    );
}
