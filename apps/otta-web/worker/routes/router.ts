// ============================================================
// API router — built on @ottabase/ottarouter
// ============================================================
//
// Routes are order-free: precedence lives in the pattern (static > :param > *,
// exact method > ALL), so registrations below are grouped by feature, not by
// match priority. Conflicting registrations throw at module load.
//
// A handler returns a Response, or null to decline and keep matching. When no
// route claims a request, handleApiRequest() resolves null so the worker can
// fall through to shortlinks and static assets.
//
// Core routes (auth, admin, ORM, brand, platform demos) are registered here.
// Everything a PACKAGE contributes — blog, landing, shortlinks, referrals, AI,
// the app's own routes, paid add-ons — is mounted from `ottabase/packages.ts`
// by mountPackages() and mountPremiumPackages() below.
// ============================================================

import { wasSessionRevoked } from '@ottabase/auth/backend';
import { handleAnalyticsTrack } from '@ottabase/analytics/server';
import { mountPackages, runHealth } from '@ottabase/kernel';
import { Router } from '@ottabase/ottarouter';
import { createPremiumAdminRouter, mountPremiumPackages } from '@ottabase/premium/server';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { packages } from '../../ottabase/packages';
import { requireAdminAccess } from '../lib/admin-guard';
import { buildCorsHeaders, ctxOf, h, makeApiRouteContext, type ApiRouteContext } from '../lib/api-context';
import { premium } from '../lib/premium';
import { handleUnhandledRequestError } from '../lib/http-error-boundary';
import {
    handleMeSessionRename,
    handleMeSessionRevoke,
    handleMeSessionsList,
    handleMeSessionsRevokeOthers,
} from './me-sessions';
import { getKillSwitchStatus } from '../lib/killswitch';
import { handleAdminCronCreate, handleAdminCronList, handleCronTask } from './admin-cron';
import { handleCrudHubAction, handleCrudHubCrud, handleCrudHubModel, handleCrudHubModels } from './admin-crudhub';
import { handleAdminSystemReadiness } from './admin-system';
import {
    handleAdminDbRowDelete,
    handleAdminDbTableData,
    handleAdminDbTableDelete,
    handleAdminDbTables,
} from './admin-db';
import {
    handleAdminDevMailClear,
    handleAdminDevMailDelete,
    handleAdminDevMailGet,
    handleAdminDevMailList,
} from './admin-dev-mail';
import {
    handleAdminOrganizationInviteMember,
    handleAdminOrganizationMembersList,
    handleAdminOrganizationRemoveMember,
    handleAdminOrganizationUpdateMember,
} from './admin-organization-members';
import { handleAdminAiConfig } from './admin-ai'; // otta:only ottaai
import { handleAdminPromotePlatformOwner } from './admin-owner';
import {
    handleAdminQueuesDLQJob,
    handleAdminQueuesDLQList,
    handleAdminQueuesDLQPurge,
    handleAdminQueuesDLQRetryAll,
    handleAdminQueuesDLQRetryJob,
    handleAdminQueuesFailed,
    handleAdminQueuesOverview,
    handleAdminQueuesPending,
    handleAdminQueuesProcessed,
    handleAdminQueuesResetStats,
} from './admin-queues';
import {
    handleAdminRoleCreate,
    handleAdminRoleDelete,
    handleAdminRoleUpdate,
    handleAdminRolesList,
} from './admin-roles';
import { handleAdminUserById, handleAdminUserSearch, handleAdminUsers } from './admin-users';
import { handleAuditLogs } from './audit';
import {
    handleAuthConfig,
    handleAuthApiRequest,
    handleAuthRegister,
    handlePasswordChange,
    handlePasswordResetConfirm,
    handlePasswordResetRequest,
    handleUserProfile,
    handleVerifyEmail,
    handleVerifyEmailResend,
} from './auth';
import { handleBrandApi } from './brand';
import { handleD1Init, handleD1TodoById, handleD1Todos } from './cloudflare-d1'; // otta:only demo
import { handleCloudflareQueue } from './cloudflare-queue'; // otta:only demo
import { handleRateLimiting } from './cloudflare-rate'; // otta:only demo
import { handleRealtimeBroadcast, handleRealtimeStats, handleRealtimeWebsocket } from './cloudflare-realtime'; // otta:only demo
import {
    handleCloudflareImages, // otta:only demo
    handleCloudflareKV, // otta:only demo
    handleCloudflareR2, // otta:only demo
    handleUpload,
    handleUploadFile,
} from './cloudflare-storage';
import { handleCoreAnalytics } from './core-analytics';
import { handleDemo, handleDemoError, handleDemoMode } from './demo'; // otta:only demo
import { handleEmailProviders, handleEmailTest } from './email';
import { handleOttaormCrud } from './ottaorm-crud';
import { handleModelsMetadata, handleOttaormInit } from './ottaorm-init';

// The handler context and its adapters live in ../lib/api-context so package manifests can
// use them without importing this module. Re-exported for the many handlers that import
// the type from here.
export { makeApiRouteContext, type ApiRouteContext };

const TABLE_NAME = /^[a-zA-Z0-9_]+$/;

export const apiRouter = new Router<CloudflareEnv>();

// -------------------------------------------------------
// CORS preflight — middleware, not a route, so it wins over
// every /api/* route (including the ALL /api/auth/* catch-all)
// -------------------------------------------------------
apiRouter.use('/api', (c, next) => {
    if (c.method === 'OPTIONS' && c.path.startsWith('/api/')) {
        return new Response(null, { status: 204, headers: buildCorsHeaders(c.req, c.env) });
    }
    return next();
});

// -------------------------------------------------------
// Core / system
// -------------------------------------------------------
// Liveness: public, and deliberately says nothing about bindings or packages.
apiRouter.get('/api/health', () =>
    jsonResponse({
        ok: true,
        name: 'otta-web',
        timestamp: Date.now(),
    }),
);
// System readiness for the /admin overview: declared settings, bindings and probes with the
// package that asked for each. Platform admins only; no secret value ever appears.
apiRouter.get('/api/admin/system/readiness', h(handleAdminSystemReadiness));
// Readiness: every package's required env and its own probe, for platform admins. The
// per-check detail names bindings, so it is not public.
apiRouter.get(
    '/api/admin/health',
    h(async (ctx) => {
        const auth = await requireAdminAccess(ctx, { scope: 'system' });
        if (auth instanceof Response) return auth;
        const report = await runHealth(packages, ctx.env);
        return jsonResponse({ ...report, packages: packages.keys(), timestamp: Date.now() }, report.ok ? 200 : 503);
    }),
);
// Platform control-plane status — exposes lockdown/read-only flags, so restrict to platform admins.
apiRouter.get(
    '/api/system/kill-switches',
    h(async (ctx) => {
        const auth = await requireAdminAccess(ctx, { scope: 'system' });
        if (auth instanceof Response) return auth;
        return jsonResponse({ ...getKillSwitchStatus(ctx.env) });
    }),
);

// Brand API (core — always enabled). May return null to decline and keep matching.
apiRouter.on(['GET', 'POST', 'DELETE', 'PUT'], '/api/brand', h(handleBrandApi));
apiRouter.on(['GET', 'POST', 'DELETE', 'PUT'], '/api/brand/*', h(handleBrandApi));

// -------------------------------------------------------
// Auth — explicit routes win over the /api/auth/* catch-all by
// specificity (static > *), for every method
// -------------------------------------------------------
apiRouter.get('/api/auth/config', h(handleAuthConfig));
apiRouter.get('/api/auth/verify-email', h(handleVerifyEmail));
apiRouter.post('/api/auth/register', h(handleAuthRegister));
apiRouter.post('/api/auth/verify-email/resend', h(handleVerifyEmailResend));
apiRouter.post('/api/auth/password/reset/request', h(handlePasswordResetRequest));
apiRouter.post('/api/auth/password/reset/confirm', h(handlePasswordResetConfirm));
apiRouter.post('/api/auth/password/change', h(handlePasswordChange));
apiRouter.all('/api/auth/*', h(handleAuthApiRequest));
apiRouter.on(['GET', 'PATCH'], '/api/users/me', h(handleUserProfile));
// The signed-in user's own sessions (see me-sessions.ts). Static before :id so revoke-others wins.
apiRouter.get('/api/users/me/sessions', h(handleMeSessionsList));
apiRouter.post('/api/users/me/sessions/revoke-others', h(handleMeSessionsRevokeOthers));
apiRouter.patch('/api/users/me/sessions/:id', (c) => handleMeSessionRename(ctxOf(c), c.params.id));
apiRouter.delete('/api/users/me/sessions/:id', (c) => handleMeSessionRevoke(ctxOf(c), c.params.id));

// -------------------------------------------------------
// Email
// -------------------------------------------------------
apiRouter.get('/api/email/providers', h(handleEmailProviders));
apiRouter.post('/api/email/test', h(handleEmailTest));

// -------------------------------------------------------
// Analytics & audit
// -------------------------------------------------------
apiRouter.get('/api/analytics/core', h(handleCoreAnalytics));
apiRouter.post('/api/analytics/track', (c) =>
    handleAnalyticsTrack({
        request: c.req,
        dataset: c.env.OBCF_ANALYTICS_CORE,
        defaultAppId: getOttabaseConfig(c.env).appId,
    }),
);
apiRouter.get('/api/audit/logs', h(handleAuditLogs));

// -------------------------------------------------------
// Admin: users, roles, platform owner, organizations
// -------------------------------------------------------
apiRouter.get('/api/admin/users', h(handleAdminUsers));
apiRouter.get('/api/admin/users/search', h(handleAdminUserSearch));
apiRouter.get('/api/admin/users/:userId', (c) => handleAdminUserById(ctxOf(c), c.params.userId));
apiRouter.get('/api/admin/roles', h(handleAdminRolesList));
apiRouter.post('/api/admin/roles', h(handleAdminRoleCreate));
apiRouter.patch('/api/admin/roles/:roleId', (c) => handleAdminRoleUpdate(ctxOf(c), c.params.roleId));
apiRouter.delete('/api/admin/roles/:roleId', (c) => handleAdminRoleDelete(ctxOf(c), c.params.roleId));
apiRouter.post('/api/admin/platform-owner/promote', h(handleAdminPromotePlatformOwner));
apiRouter.get('/api/admin/organizations/:organizationId/members', (c) =>
    handleAdminOrganizationMembersList(ctxOf(c), c.params.organizationId),
);
apiRouter.post('/api/admin/organizations/:organizationId/members/invite', (c) =>
    handleAdminOrganizationInviteMember(ctxOf(c), c.params.organizationId),
);
apiRouter.patch('/api/admin/organizations/:organizationId/members/:memberId', (c) =>
    handleAdminOrganizationUpdateMember(ctxOf(c), c.params.organizationId, c.params.memberId),
);
apiRouter.delete('/api/admin/organizations/:organizationId/members/:memberId', (c) =>
    handleAdminOrganizationRemoveMember(ctxOf(c), c.params.organizationId, c.params.memberId),
);

// -------------------------------------------------------
// Admin: cron — the catch-all 404s on unknown tasks instead of
// declining, so nothing under /api/admin/cron/* ever falls through
// -------------------------------------------------------
apiRouter.get('/api/admin/cron', h(handleAdminCronList));
apiRouter.post('/api/admin/cron', h(handleAdminCronCreate));
apiRouter.all('/api/admin/cron/*', async (c) => {
    const rest = c.params['*'];
    const action = rest.endsWith('/toggle') ? 'toggle' : rest.endsWith('/run') ? 'run' : null;
    const cronResult = await handleCronTask(ctxOf(c), rest, action);
    return (
        cronResult ??
        errorResponse('Not found', 404, {
            code: 'NOT_FOUND',
        })
    );
});

// -------------------------------------------------------
// Admin: queues & DLQ
// -------------------------------------------------------
apiRouter.get('/api/admin/queues', h(handleAdminQueuesOverview));
apiRouter.get('/api/admin/queues/processed', h(handleAdminQueuesProcessed));
apiRouter.get('/api/admin/queues/failed', h(handleAdminQueuesFailed));
apiRouter.get('/api/admin/queues/pending', h(handleAdminQueuesPending));
apiRouter.post('/api/admin/queues/reset-stats', h(handleAdminQueuesResetStats));
apiRouter.get('/api/admin/queues/dlq', h(handleAdminQueuesDLQList));
apiRouter.delete('/api/admin/queues/dlq', h(handleAdminQueuesDLQPurge));
apiRouter.post('/api/admin/queues/dlq/retry-all', h(handleAdminQueuesDLQRetryAll));
apiRouter.post('/api/admin/queues/dlq/:jobId/retry', (c) => handleAdminQueuesDLQRetryJob(ctxOf(c), c.params.jobId));
apiRouter.all('/api/admin/queues/dlq/:jobId', (c) => handleAdminQueuesDLQJob(ctxOf(c), c.params.jobId));

// -------------------------------------------------------
// Admin: DB browser (table names are charset-restricted; anything
// else declines so the request falls through).
//
// Registered as `*` wildcards rather than `:tableName` so the charset
// test runs on the RAW segment: `*` captures are never auto-decoded,
// so a percent-encoded table name (valid or malformed) simply fails
// the charset test and falls through.
// -------------------------------------------------------
// -------------------------------------------------------
// CrudHub: generic admin data screens over opted-in models (see admin-crudhub.ts).
// The model segment is matched as a plain entity name; everything else falls through.
// -------------------------------------------------------
const ENTITY_NAME = /^[a-z][a-z0-9_]{0,63}$/;
apiRouter.get('/api/admin/crudhub', h(handleCrudHubModels));
apiRouter.get('/api/admin/crudhub/:model/_meta', (c) =>
    ENTITY_NAME.test(c.params.model) ? handleCrudHubModel(ctxOf(c), c.params.model) : null,
);
apiRouter.post('/api/admin/crudhub/:model/:id/actions/:key', (c) =>
    ENTITY_NAME.test(c.params.model) && ENTITY_NAME.test(c.params.key)
        ? handleCrudHubAction(ctxOf(c), c.params.model, c.params.id, c.params.key)
        : null,
);
apiRouter.all('/api/admin/crudhub/:model', (c) =>
    ENTITY_NAME.test(c.params.model) ? handleCrudHubCrud(ctxOf(c), c.params.model) : null,
);
apiRouter.all('/api/admin/crudhub/:model/:id', (c) =>
    ENTITY_NAME.test(c.params.model) ? handleCrudHubCrud(ctxOf(c), c.params.model) : null,
);

apiRouter.get('/api/admin/db/tables', h(handleAdminDbTables));
apiRouter.get('/api/admin/db/tables/*', (c) => {
    const tableName = c.params['*'];
    return TABLE_NAME.test(tableName) ? handleAdminDbTableData({ ...ctxOf(c), tableName }) : null;
});
apiRouter.delete('/api/admin/db/tables/*', (c) => {
    const tail = c.params['*'];
    const slashIndex = tail.indexOf('/');
    if (slashIndex === -1) {
        return TABLE_NAME.test(tail) ? handleAdminDbTableDelete({ ...ctxOf(c), tableName: tail }) : null;
    }
    const tableName = tail.slice(0, slashIndex);
    const rowId = tail.slice(slashIndex + 1);
    return TABLE_NAME.test(tableName)
        ? handleAdminDbRowDelete({ ...ctxOf(c), tableName }, rowId, c.url.searchParams.get('pk') || 'id')
        : null;
});

// otta:begin ottaai
// -------------------------------------------------------
// Admin: OttaAI / AI Gateway (platform-admin, read-only snapshot)
// -------------------------------------------------------
apiRouter.get('/api/admin/ai/config', h(handleAdminAiConfig));
// otta:end ottaai

// -------------------------------------------------------
// Admin: dev mail
// -------------------------------------------------------
apiRouter.get('/api/admin/dev-mail', h(handleAdminDevMailList));
apiRouter.delete('/api/admin/dev-mail', h(handleAdminDevMailClear));
apiRouter.get('/api/admin/dev-mail/:messageId', (c) => handleAdminDevMailGet(ctxOf(c), c.params.messageId));
apiRouter.delete('/api/admin/dev-mail/:messageId', (c) => handleAdminDevMailDelete(ctxOf(c), c.params.messageId));

// -------------------------------------------------------
// Cloudflare platform demos & services
// -------------------------------------------------------
// otta:begin demo
apiRouter.all('/api/demo', h(handleDemo));
apiRouter.all('/api/demo/error', () => handleDemoError());
apiRouter.get('/api/demo/mode', h(handleDemoMode));
apiRouter.all('/api/cloudflare/queues', h(handleCloudflareQueue));
apiRouter.post('/api/cloudflare/d1/init', h(handleD1Init));
apiRouter.all('/api/cloudflare/d1/todos', h(handleD1Todos));
apiRouter.on(['PATCH', 'DELETE'], '/api/cloudflare/d1/todos/*', (c) =>
    handleD1TodoById(ctxOf(c), c.params['*'], c.method as 'PATCH' | 'DELETE'),
);
apiRouter.all('/api/cloudflare/kv', h(handleCloudflareKV));
apiRouter.all('/api/cloudflare/r2', h(handleCloudflareR2));
apiRouter.post('/api/cloudflare/images', h(handleCloudflareImages));
apiRouter.post('/api/cloudflare/rate-limiting', h(handleRateLimiting));
apiRouter.get('/api/cloudflare/realtime/stats', h(handleRealtimeStats));
apiRouter.post('/api/cloudflare/realtime/broadcast', h(handleRealtimeBroadcast));
apiRouter.all('/api/cloudflare/realtime/ws', h(handleRealtimeWebsocket));
// otta:end demo
// NOTE: there are deliberately no `/api/cloudflare/ai/*` routes. The AI demo posts to
// `/api/ai/complete` — the SAME endpoint product features use — so the demo exercises the real
// resolution chain instead of a parallel client whose provider table can drift from it.
apiRouter.post('/api/upload', h(handleUpload));
apiRouter.all('/api/upload/file/*', h(handleUploadFile));

// -------------------------------------------------------
// OttaORM — generic CRUD catch-all with two excluded exacts;
// excluded tails decline so unmatched methods fall through
// -------------------------------------------------------
// Model metadata exposes the full schema surface (every table + package), so restrict to
// platform admins — it backs the admin Database/Migrations pages.
apiRouter.get(
    '/api/ottaorm/models-metadata',
    h(async (ctx) => {
        const auth = await requireAdminAccess(ctx, { scope: 'system' });
        if (auth instanceof Response) return auth;
        return handleModelsMetadata();
    }),
);
apiRouter.on(['GET', 'POST'], '/api/ottaorm/init', h(handleOttaormInit));
apiRouter.all('/api/ottaorm/*', (c) =>
    c.params['*'] === 'init' || c.params['*'] === 'models-metadata' ? null : handleOttaormCrud(ctxOf(c)),
);

// -------------------------------------------------------
// Packages (ottabase/packages.ts)
// -------------------------------------------------------
// Every free package's routes, from its manifest: blog, landing, shortlinks, referrals, AI,
// and the app's own. A package is installed when it is in the list, so there is no
// request-time toggle to check; removing the entry removes the routes.
mountPackages(apiRouter, { packages });

// -------------------------------------------------------
// Premium Packages (@ottabase/premium)
// -------------------------------------------------------
// Both calls are no-ops when the list holds no premium package: no routes, no middleware,
// no KV reads. An app that sells no add-ons pays nothing for this.
//
// Each package's namespace is mounted behind its own license gate, so an unlicensed
// package answers 402 instead of serving. The control plane below is separate, and admin-
// gated, because reading and changing license state is an operator action, not a feature.
mountPremiumPackages(apiRouter, premium, { packages });

apiRouter.mount(
    '/api/premium',
    createPremiumAdminRouter(premium, {
        // Mutations (activate/remove a key, uninstall) are platform-admin only: a license
        // is a commercial instrument for the whole deployment, not per-tenant settings.
        requireAdmin: async (c) => {
            const auth = await requireAdminAccess(ctxOf(c), { scope: 'system' });
            return auth instanceof Response ? auth : null;
        },
        // Reads are open to any admin of either scope: the client needs entitlement state
        // to render gates, and the payload is plan/limits — never a license key.
        requireViewer: async (c) => {
            const auth = await requireAdminAccess(ctxOf(c), { scope: 'either' });
            return auth instanceof Response ? auth : null;
        },
    }),
);

// -------------------------------------------------------
// Error policy — mirrors the worker's top-level mapping, plus
// uniform 400s for malformed percent-encoding in :params
// -------------------------------------------------------
apiRouter.onError((err, c) => {
    if (err instanceof URIError) {
        return errorResponse('Invalid identifier', 400, { code: 'BAD_REQUEST' });
    }
    return handleUnhandledRequestError(err, c.req, { env: c.env, ctx: c.ctx });
});

/**
 * Resolve an API request. Resolves null when nothing claimed the request, so the worker
 * can fall through to shortlinks and static assets.
 */
export async function handleApiRequest(
    request: Request,
    env: CloudflareEnv,
    ctx?: ExecutionContext,
): Promise<Response | null> {
    const response = await apiRouter.handle(request, env, ctx);
    return response?.status === 401 ? markRevokedSession(request, env, response) : response;
}

/** The header a 401 carries when the session was revoked, so the browser can say so (notice `session-revoked`). */
export const SESSION_ENDED_HEADER = 'X-Session-Ended';

/**
 * Every 401 passes through here: when the caller still holds a validly signed cookie whose session
 * was revoked (from another device, or by a password change), say so in a header. Only 401s pay
 * the two KV reads; a missing or expired cookie gets no header and reads as "expired".
 */
async function markRevokedSession(request: Request, env: CloudflareEnv, response: Response): Promise<Response> {
    if (!(await wasSessionRevoked(request, env as never))) return response;
    const marked = new Response(response.body, response);
    marked.headers.set(SESSION_ENDED_HEADER, 'revoked');
    return marked;
}
