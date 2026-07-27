// ============================================================
// API router — built on @ottabase/ottarouter
// ============================================================
//
// Routes are order-free: precedence lives in the pattern (static > :param > *,
// exact method > ALL), so registrations below are grouped by feature, not by
// match priority. Conflicting registrations throw at module load.
//
// A handler returns a Response, or null to decline and keep matching. When no
// route claims a request, handleApiRequest() consults the user-zone
// handleCustomRoutes (ottabase/config.routes.ts) and finally resolves null so
// the worker can fall through to shortlinks and static assets.
// ============================================================

import { handleAnalyticsTrack } from '@ottabase/analytics/server';
import { buildBlogRouter } from '@ottabase/ottablog/router';
import { Router, withHeaders, type Ctx } from '@ottabase/ottarouter';
import { errorResponse, ServiceError } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { handleCustomRoutes } from '../../ottabase/config.routes';
import { requireAdminAccess } from '../lib/admin-guard';
import { getKillSwitchStatus } from '../lib/killswitch';
import { handleAdminCronCreate, handleAdminCronList, handleCronTask } from './admin-cron';
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
import {
    handleAiComplete,
    handleAiCredentialsActivate,
    handleAiCredentialsCreate,
    handleAiCredentialsDelete,
    handleAiCredentialsList,
    handleAiCredentialsTest,
    handleAiCredentialsUpdate,
    handleAiEmbed,
    handleAiExplain,
    handleAiProviders,
    handleAiStatus,
} from './ai';
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
import {
    handleBlogCategoryBySlug,
    handleBlogDemoSeed,
    handleBlogPostBySlug,
    handleBlogPreviewTokenMint,
    handleBlogStudioThemeTokens,
    handleBlogPostUnlock,
    handleBlogPostsList,
    handleBlogPublishScheduled,
    handleBlogRelatedPosts,
    handleBlogRssFeed,
    handleBlogSeriesBySlug,
    handleBlogSitemap,
    handleBlogStudioActivateTheme,
    handleBlogStudioPluginConfig,
    handleBlogStudioPluginEnable,
    handleBlogStudioState,
    handleBlogTagBySlug,
} from './blog';
import { handleBrandApi } from './brand';
import { handleD1Init, handleD1TodoById, handleD1Todos } from './cloudflare-d1';
import { handleCloudflareQueue } from './cloudflare-queue';
import { handleRateLimiting } from './cloudflare-rate';
import { handleRealtimeBroadcast, handleRealtimeStats, handleRealtimeWebsocket } from './cloudflare-realtime';
import {
    handleCloudflareImages,
    handleCloudflareKV,
    handleCloudflareR2,
    handleUpload,
    handleUploadFile,
} from './cloudflare-storage';
import { handleCoreAnalytics } from './core-analytics';
import { handleDemo, handleDemoError } from './demo';
import { handleEmailProviders, handleEmailTest } from './email';
import { handleOttaormCrud } from './ottaorm-crud';
import { handleModelsMetadata, handleOttaormInit } from './ottaorm-init';
import {
    handleReferralStats,
    handleReferralTrack,
    handleReferralTrackingList,
    handleReferralUser,
    handleReferralUsernameUpdate,
    handleReferralsAnalytics,
} from './referrals';
import {
    handleShortlinkById,
    handleShortlinkExplicitGo,
    handleShortlinksAnalytics,
    handleShortlinksCreate,
    handleShortlinksList,
} from './shortlinks';

/** The context every route handler receives (unchanged across the ottarouter migration). */
export interface ApiRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
    route: string;
    method: string;
    withAuthCors: (response: Response) => Response;
    corsHeaders: Record<string, string>;
}

type WorkerCtx = Ctx<CloudflareEnv>;
type ApiHandler = (context: ApiRouteContext) => Promise<Response | null> | Response | null;

function buildCorsHeaders(request: Request, env: CloudflareEnv): Record<string, string> {
    // Never reflect an arbitrary Origin together with credentials. Doing so lets any site
    // issue credentialed cross-origin reads (e.g. GET /api/auth/csrf, which would leak the
    // CSRF token, or GET /api/auth/session, which would leak session data). Only echo the
    // Origin when it is same-origin, matches the configured AUTH_URL, or is in the
    // CORS_ALLOWED_ORIGINS allowlist; otherwise omit Access-Control-Allow-Origin so the
    // browser blocks the cross-origin read.
    const cfg = env as { AUTH_URL?: string; CORS_ALLOWED_ORIGINS?: string };
    const requestOrigin = request.headers.get('Origin');
    const allowedOrigins = new Set<string>();
    try {
        allowedOrigins.add(new URL(request.url).origin);
    } catch {
        /* ignore */
    }
    for (const candidate of [cfg.AUTH_URL, ...String(cfg.CORS_ALLOWED_ORIGINS || '').split(',')]) {
        const trimmed = (candidate || '').trim();
        if (!trimmed) continue;
        try {
            allowedOrigins.add(new URL(trimmed).origin);
        } catch {
            /* ignore malformed configured origin */
        }
    }
    const corsOrigin = requestOrigin && allowedOrigins.has(requestOrigin) ? requestOrigin : null;
    return corsOrigin
        ? {
              'Access-Control-Allow-Origin': corsOrigin,
              'Access-Control-Allow-Credentials': 'true',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
              Vary: 'Origin',
          }
        : { Vary: 'Origin' };
}

export function makeApiRouteContext(
    request: Request,
    env: CloudflareEnv,
    url: URL = new URL(request.url),
): ApiRouteContext {
    const corsHeaders = buildCorsHeaders(request, env);
    const route = url.pathname !== '/' && url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
    return {
        request,
        env,
        url,
        route,
        method: request.method,
        corsHeaders,
        withAuthCors: (response) => withHeaders(response, corsHeaders),
    };
}

const ctxOf = (c: WorkerCtx): ApiRouteContext => makeApiRouteContext(c.req, c.env, c.url);

/** Adapt a legacy ApiRouteContext handler to an ottarouter handler. */
const h =
    (handler: ApiHandler) =>
    (c: WorkerCtx): Promise<Response | null> | Response | null =>
        handler(ctxOf(c));

const packages = (c: WorkerCtx) => getOttabaseConfig(c.env).packages;

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
apiRouter.get('/api/health', () =>
    jsonResponse({
        ok: true,
        name: 'otta-web',
        timestamp: Date.now(),
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
// else declines so the request falls through, as before).
//
// Registered as `*` wildcards rather than `:tableName` so the charset
// test runs on the RAW segment: `*` captures are never auto-decoded,
// so a percent-encoded table name (valid or malformed) simply fails
// the charset test and falls through, exactly like the legacy regex
// that matched against the raw pathname.
// -------------------------------------------------------
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
apiRouter.all('/api/demo', h(handleDemo));
apiRouter.all('/api/demo/error', () => handleDemoError());
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
// Ottablog package (request-time gate) — the route table is canonical in
// @ottabase/ottablog/router; handlers stay imported from './blog' so that
// module remains the seam for tests/mocks and app-specific wiring.
// -------------------------------------------------------
apiRouter.mount(
    '/api/blog',
    buildBlogRouter<CloudflareEnv>(
        {
            handleBlogStudioState,
            handleBlogStudioActivateTheme,
            handleBlogStudioPluginEnable,
            handleBlogStudioPluginConfig,
            handleBlogPostsList,
            handleBlogPostBySlug,
            handleBlogPostUnlock,
            handleBlogTagBySlug,
            handleBlogCategoryBySlug,
            handleBlogSeriesBySlug,
            handleBlogRelatedPosts,
            handleBlogRssFeed,
            handleBlogSitemap,
            handleBlogPublishScheduled,
            handleBlogDemoSeed,
            handleBlogPreviewTokenMint,
            handleBlogStudioThemeTokens,
        },
        { makeContext: ctxOf },
    ),
    { when: (c) => packages(c).ottablog },
);

// -------------------------------------------------------
// Shortlinks package (request-time gate) — mounted at '/'
// because the group spans /api/shortlinks/* and /shortlinks/go
// -------------------------------------------------------
const shortlinksRouter = new Router<CloudflareEnv>();
shortlinksRouter.get('/api/shortlinks', h(handleShortlinksList));
shortlinksRouter.get('/api/shortlinks/analytics', h(handleShortlinksAnalytics));
shortlinksRouter.post('/api/shortlinks', h(handleShortlinksCreate));
shortlinksRouter.patch('/api/shortlinks/*', (c) => handleShortlinkById(ctxOf(c), c.params['*'], 'PATCH'));
shortlinksRouter.delete('/api/shortlinks/*', (c) => handleShortlinkById(ctxOf(c), c.params['*'], 'DELETE'));
shortlinksRouter.get('/shortlinks/go', h(handleShortlinkExplicitGo));
apiRouter.mount('/', shortlinksRouter, { when: (c) => packages(c).shortlinks });

// -------------------------------------------------------
// Referrals package (request-time gate)
// -------------------------------------------------------
const referralsRouter = new Router<CloudflareEnv>();
referralsRouter.get('/stats', h(handleReferralStats));
referralsRouter.get('/user', h(handleReferralUser));
referralsRouter.get('/tracking', h(handleReferralTrackingList));
referralsRouter.get('/analytics', h(handleReferralsAnalytics));
referralsRouter.post('/track', h(handleReferralTrack));
referralsRouter.put('/username', h(handleReferralUsernameUpdate));
apiRouter.mount('/api/referrals', referralsRouter, { when: (c) => packages(c).referrals });

// -------------------------------------------------------
// AI provisioning / BYOK (@ottabase/ottaai) — request-time gate
// -------------------------------------------------------
// Credential CRUD is deliberately NOT exposed through /api/ottaorm: the model is absent
// from GENERIC_CRUD_ALLOWLIST, and these handlers come from the package's route factory,
// which owns tenancy stamping, the authorize hook, and the filter/sort deny-list on the
// secret-union columns.
const aiRouter = new Router<CloudflareEnv>();
aiRouter.get('/status', h(handleAiStatus));
aiRouter.get('/providers', h(handleAiProviders));
aiRouter.get('/explain', h(handleAiExplain));
aiRouter.get('/credentials', h(handleAiCredentialsList));
aiRouter.post('/credentials', h(handleAiCredentialsCreate));
// Static beats :param in this router, so /credentials/test cannot be shadowed by :id.
aiRouter.post('/credentials/test', h(handleAiCredentialsTest));
aiRouter.post('/credentials/:id/activate', (c) => handleAiCredentialsActivate(ctxOf(c), c.params.id));
aiRouter.patch('/credentials/:id', (c) => handleAiCredentialsUpdate(ctxOf(c), c.params.id));
aiRouter.delete('/credentials/:id', (c) => handleAiCredentialsDelete(ctxOf(c), c.params.id));
// Registered with the RAW `Ctx`, not `h(...)`: the inference path needs a real
// `waitUntil` or the credential-health and attribution writes it defers are cancelled at
// response — silent data loss, and the one thing the `defer` seam exists to prevent.
aiRouter.post('/complete', (c) => handleAiComplete(ctxOf(c), (promise) => c.ctx.waitUntil(promise)));
aiRouter.post('/embed', (c) => handleAiEmbed(ctxOf(c), (promise) => c.ctx.waitUntil(promise)));
apiRouter.mount('/api/ai', aiRouter, { when: (c) => packages(c).ottaai });

// -------------------------------------------------------
// Error policy — mirrors the worker's top-level mapping, plus
// uniform 400s for malformed percent-encoding in :params
// -------------------------------------------------------
apiRouter.onError((err, c) => {
    if (err instanceof URIError) {
        return errorResponse('Invalid identifier', 400, { code: 'BAD_REQUEST' });
    }
    console.error('Worker unhandled error:', err);
    if (err instanceof ServiceError) {
        return errorResponse(err.message, err.status, err.toApiResponse());
    }
    return errorResponse(err instanceof Error ? err.message : 'An unexpected error occurred', 500, {
        code: 'INTERNAL_SERVER_ERROR',
    });
});

/**
 * Resolve an API request: built-in routes first, then the user-zone custom
 * routes (ottabase/config.routes.ts). Resolves null when nothing claimed the
 * request, so the worker can fall through to shortlinks and static assets.
 */
export async function handleApiRequest(
    request: Request,
    env: CloudflareEnv,
    ctx?: ExecutionContext,
): Promise<Response | null> {
    const response = await apiRouter.handle(request, env, ctx);
    if (response) {
        return response;
    }
    return handleCustomRoutes(makeApiRouteContext(request, env));
}
