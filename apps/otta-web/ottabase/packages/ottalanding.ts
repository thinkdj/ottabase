// The landing-site package: tables, models and policies from the package; this app adds the
// platform-admin editing routes and the cron handler that announces new leads on the bus
// (`lead.created`) and emails them. The public site (apps/otta-landing) reads the shared D1 directly.
import { createOttalandingPackage } from '@ottabase/ottalanding';
import { Router } from '@ottabase/ottarouter';
import { ctxOf, h } from '../../worker/lib/api-context';
import { LEAD_NOTIFY_DESCRIPTION, LEAD_NOTIFY_HANDLER, notifyNewLeads } from '../../worker/lib/landing-notify';
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
} from '../../worker/routes/landing';

function optionalString(payload: unknown, field: string): string | undefined {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
    const value = (payload as Record<string, unknown>)[field];
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') throw new Error(`payload.${field} must be a string`);
    return value;
}

export const ottalandingPackage = createOttalandingPackage<CloudflareEnv>({
    routes: {
        basePath: '/api/landing',
        build: () =>
            new Router<CloudflareEnv>()
                .get('/', h(handleLandingGet))
                .put('/site', h(handleLandingSiteUpdate))
                .post('/share-image', h(handleLandingShareImage))
                .get('/leads', h(handleLandingLeadsList))
                .patch('/leads/:id', (c) => handleLandingLeadUpdate(ctxOf(c), c.params.id))
                .delete('/leads/:id', (c) => handleLandingLeadDelete(ctxOf(c), c.params.id))
                .post('/pages', h(handleLandingPageCreate))
                .put('/pages/:id', (c) => handleLandingPageUpdate(ctxOf(c), c.params.id))
                .delete('/pages/:id', (c) => handleLandingPageDelete(ctxOf(c), c.params.id))
                .post('/pages/:id/preview', (c) => handleLandingPagePreview(ctxOf(c), c.params.id)),
    },
    cron: {
        // Seeded on install, so `lead.created` goes out whether or not an address is set. The
        // landing admin route adds the admin inbox URL to its payload (see ensureLeadNotifyTask).
        [LEAD_NOTIFY_HANDLER]: {
            description: LEAD_NOTIFY_DESCRIPTION,
            schedule: '* * * * *',
            handler: async ({ env, payload }) => {
                await notifyNewLeads(env, optionalString(payload, 'inboxUrl'));
            },
        },
    },
});
