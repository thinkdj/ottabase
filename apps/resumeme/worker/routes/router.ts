import { handleAnalyticsTrack } from '@ottabase/analytics/server';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { handleCustomRoutes } from '../../ottabase/config.routes';
import { getKillSwitchStatus } from '../lib/killswitch';
import { handleAdminCronCreate, handleAdminCronList, handleCronTask } from './admin-cron';
import {
    handleAdminDbRowDelete,
    handleAdminDbTableData,
    handleAdminDbTableDelete,
    handleAdminDbTables,
} from './admin-db';
import { handleAdminPromoteOwner } from './admin-owner';
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
import { handleAdminUserById, handleAdminUsers } from './admin-users';
import {
    handleAuthConfig,
    handleAuthJsRequest,
    handleAuthRegister,
    handlePasswordResetConfirm,
    handlePasswordResetRequest,
    handleUserProfile,
    handleVerifyEmail,
    handleVerifyEmailResend,
} from './auth';
import { handleBrandApi } from './brand';
import {
    handleAIChat,
    handleAIGatewayChat,
    handleAIProviders,
    handleAIStatus,
    handleAIUniversalChat,
} from './cloudflare-ai';
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
import { handleEmailProviders, handleEmailTest } from './email';
import { handleOttaormCrud } from './ottaorm-crud';
import { handleModelsMetadata, handleOttaormInit } from './ottaorm-init';
import {
    handleKnowledgeBaseAnalyse,
    handleKnowledgeBaseById,
    handleKnowledgeBaseCreate,
    handleKnowledgeBaseFileDelete,
    handleKnowledgeBaseFiles,
    handleKnowledgeBaseFileUpload,
    handleKnowledgeBaseList,
} from './knowledge-base';
import { handleResumePdf } from './resume-pdf';
import { handleResumePublic, handleResumePublicByCode, handleResumeShare } from './resume-share';

export interface ApiRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
    route: string;
    method: string;
    withAuthCors: (response: Response) => Response;
    corsHeaders: Record<string, string>;
}

type MethodHandler = (context: ApiRouteContext) => Promise<Response | null> | Response | null;

export async function resolveApiRoute(context: ApiRouteContext): Promise<Response | null> {
    if (context.route.startsWith('/api/') && context.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: context.corsHeaders });
    }

    const handler = METHOD_HANDLERS[context.method];
    if (handler) {
        const response = await handler(context);
        if (response) {
            return response;
        }
    }

    const methodAgnosticResponse = await handleMethodAgnosticRoutes(context);
    if (methodAgnosticResponse) {
        return methodAgnosticResponse;
    }

    // Custom / premium package routes (from ottabase/config.routes.ts)
    const customResponse = await handleCustomRoutes(context);
    if (customResponse) {
        return customResponse;
    }

    return null;
}

const METHOD_HANDLERS: Record<string, MethodHandler> = {
    GET: handleGetRoutes,
    POST: handlePostRoutes,
    PATCH: handlePatchRoutes,
    DELETE: handleDeleteRoutes,
    PUT: handlePutRoutes,
};

async function handleGetRoutes(context: ApiRouteContext): Promise<Response | null> {
    const { route } = context;

    // Public resume routes (no auth required) — must be checked before auth-gated routes
    const publicCodeMatch = route.match(/^\/api\/resume\/public\/code\/([^/]+)$/);
    if (publicCodeMatch) {
        return handleResumePublicByCode(context, publicCodeMatch[1]);
    }

    const publicIdMatch = route.match(/^\/api\/resume\/public\/([^/]+)$/);
    if (publicIdMatch) {
        return handleResumePublic(context, publicIdMatch[1]);
    }

    // Brand API (core — always enabled)
    if (route.startsWith('/api/brand')) {
        const res = await handleBrandApi(context);
        if (res) return res;
    }

    if (route === '/api/health') {
        return jsonResponse({
            ok: true,
            name: 'resumeme',
            timestamp: Date.now(),
        });
    }

    if (route === '/api/system/kill-switches') {
        return jsonResponse({
            ...getKillSwitchStatus(context.env),
        });
    }

    if (route === '/api/auth/config') {
        return handleAuthConfig(context);
    }

    if (route === '/api/auth/verify-email') {
        return handleVerifyEmail(context);
    }

    if (route === '/api/users/me') {
        return handleUserProfile(context);
    }

    if (route === '/api/email/providers') {
        return handleEmailProviders(context);
    }

    if (route === '/api/admin/cron') {
        return handleAdminCronList(context);
    }

    if (route === '/api/analytics/core') {
        return handleCoreAnalytics(context);
    }

    if (route === '/api/cloudflare/realtime/stats') {
        return handleRealtimeStats(context);
    }

    if (route === '/api/ottaorm/models-metadata') {
        return handleModelsMetadata();
    }

    if (route === '/api/ottaorm/init') {
        return handleOttaormInit(context);
    }

    if (route === '/api/admin/queues') {
        return handleAdminQueuesOverview(context);
    }

    if (route === '/api/admin/queues/processed') {
        return handleAdminQueuesProcessed(context);
    }

    if (route === '/api/admin/queues/failed') {
        return handleAdminQueuesFailed(context);
    }

    if (route === '/api/admin/queues/pending') {
        return handleAdminQueuesPending(context);
    }

    if (route === '/api/admin/queues/dlq') {
        return handleAdminQueuesDLQList(context);
    }

    if (route === '/api/cloudflare/kv') {
        return handleCloudflareKV(context);
    }

    if (route === '/api/cloudflare/r2') {
        return handleCloudflareR2(context);
    }

    if (route === '/api/cloudflare/ai/providers') {
        return handleAIProviders(context);
    }

    if (route === '/api/cloudflare/ai/status') {
        return handleAIStatus(context);
    }

    if (route === '/api/admin/users') {
        return handleAdminUsers(context);
    }

    const adminUserMatch = route.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (adminUserMatch) {
        return handleAdminUserById(context, adminUserMatch[1]);
    }

    if (route === '/api/admin/roles') {
        return handleAdminRolesList(context);
    }

    if (route === '/api/admin/db/tables') {
        return handleAdminDbTables(context);
    }

    const tableMatch = route.match(/^\/api\/admin\/db\/tables\/([a-zA-Z0-9_]+)$/);
    if (tableMatch) {
        return handleAdminDbTableData({ ...context, tableName: tableMatch[1] });
    }

    // ── Knowledge Base routes ──
    if (route === '/api/kb') {
        return handleKnowledgeBaseList(context);
    }

    const kbFilesMatch = route.match(/^\/api\/kb\/([^/]+)\/files$/);
    if (kbFilesMatch) {
        return handleKnowledgeBaseFiles(context, kbFilesMatch[1]);
    }

    const kbDetailMatch = route.match(/^\/api\/kb\/([^/]+)$/);
    if (kbDetailMatch) {
        return handleKnowledgeBaseById(context, kbDetailMatch[1]);
    }

    return null;
}

async function handlePostRoutes(context: ApiRouteContext): Promise<Response | null> {
    const { route } = context;

    if (route.startsWith('/api/brand')) {
        const res = await handleBrandApi(context);
        if (res) return res;
    }

    if (route === '/api/auth/verify-email/resend') {
        return handleVerifyEmailResend(context);
    }

    if (route === '/api/auth/password/reset/request') {
        return handlePasswordResetRequest(context);
    }

    if (route === '/api/auth/password/reset/confirm') {
        return handlePasswordResetConfirm(context);
    }

    if (route === '/api/email/test') {
        return handleEmailTest(context);
    }

    if (route === '/api/admin/cron') {
        return handleAdminCronCreate(context);
    }

    if (route === '/api/admin/owner/promote') {
        return handleAdminPromoteOwner(context);
    }

    if (route === '/api/analytics/track') {
        return handleAnalyticsTrack({
            request: context.request,
            dataset: context.env.OBCF_ANALYTICS_CORE,
            defaultAppId: 'ottabase-template',
        });
    }

    if (route === '/api/auth/register') {
        return handleAuthRegister(context);
    }

    if (route === '/api/cloudflare/rate-limiting') {
        return handleRateLimiting(context);
    }

    if (route === '/api/cloudflare/realtime/broadcast') {
        return handleRealtimeBroadcast(context);
    }

    if (route === '/api/admin/queues/reset-stats') {
        return handleAdminQueuesResetStats(context);
    }

    if (route === '/api/admin/queues/dlq/retry-all') {
        return handleAdminQueuesDLQRetryAll(context);
    }

    if (route === '/api/cloudflare/images') {
        return handleCloudflareImages(context);
    }

    if (route === '/api/cloudflare/ai/chat') {
        return handleAIChat(context);
    }

    if (route === '/api/cloudflare/ai/gateway/chat') {
        return handleAIGatewayChat(context);
    }

    if (route === '/api/cloudflare/ai/universal/chat') {
        return handleAIUniversalChat(context);
    }

    if (route === '/api/upload') {
        return handleUpload(context);
    }

    // Server-side PDF generation via Cloudflare Browser Rendering (Puppeteer)
    if (route === '/api/resume/pdf') {
        return handleResumePdf(context);
    }

    // Create a shareable shortlink for a saved resume
    if (route === '/api/resume/share') {
        return handleResumeShare(context);
    }

    if (route === '/api/admin/roles') {
        return handleAdminRoleCreate(context);
    }

    if (route === '/api/ottaorm/init') {
        return handleOttaormInit(context);
    }

    const dlqRetryMatch = context.url.pathname.match(/^\/api\/admin\/queues\/dlq\/([^/]+)\/retry$/);
    if (dlqRetryMatch) {
        return handleAdminQueuesDLQRetryJob(context, dlqRetryMatch[1]);
    }

    // ── Knowledge Base routes ──
    if (route === '/api/kb') {
        return handleKnowledgeBaseCreate(context);
    }

    const kbFileUploadMatch = route.match(/^\/api\/kb\/([^/]+)\/files$/);
    if (kbFileUploadMatch) {
        return handleKnowledgeBaseFileUpload(context, kbFileUploadMatch[1]);
    }

    const kbAnalyseMatch = route.match(/^\/api\/kb\/([^/]+)\/analyse$/);
    if (kbAnalyseMatch) {
        return handleKnowledgeBaseAnalyse(context, kbAnalyseMatch[1]);
    }

    return null;
}

async function handlePatchRoutes(context: ApiRouteContext): Promise<Response | null> {
    const { route } = context;

    if (route === '/api/users/me') {
        return handleUserProfile(context);
    }

    const adminRolePatchMatch = route.match(/^\/api\/admin\/roles\/([^/]+)$/);
    if (adminRolePatchMatch) {
        return handleAdminRoleUpdate(context, adminRolePatchMatch[1]);
    }

    // ── Knowledge Base routes ──
    const kbPatchMatch = route.match(/^\/api\/kb\/([^/]+)$/);
    if (kbPatchMatch) {
        return handleKnowledgeBaseById(context, kbPatchMatch[1]);
    }

    return null;
}

async function handleDeleteRoutes(context: ApiRouteContext): Promise<Response | null> {
    const { route, url } = context;

    if (route.startsWith('/api/brand')) {
        const res = await handleBrandApi(context);
        if (res) return res;
    }

    if (route === '/api/admin/queues/dlq') {
        return handleAdminQueuesDLQPurge(context);
    }

    const tableMatch = route.match(/^\/api\/admin\/db\/tables\/([a-zA-Z0-9_]+)$/);
    if (tableMatch) {
        return handleAdminDbTableDelete({ ...context, tableName: tableMatch[1] });
    }

    const rowMatch = url.pathname.match(/^\/api\/admin\/db\/tables\/([a-zA-Z0-9_]+)\/(.+)$/);
    if (rowMatch) {
        return handleAdminDbRowDelete(
            { ...context, tableName: rowMatch[1] },
            rowMatch[2],
            url.searchParams.get('pk') || 'id',
        );
    }

    const adminRoleDeleteMatch = route.match(/^\/api\/admin\/roles\/([^/]+)$/);
    if (adminRoleDeleteMatch) {
        return handleAdminRoleDelete(context, adminRoleDeleteMatch[1]);
    }

    // ── Knowledge Base routes ──
    const kbFileDeleteMatch = route.match(/^\/api\/kb\/([^/]+)\/files\/([^/]+)$/);
    if (kbFileDeleteMatch) {
        return handleKnowledgeBaseFileDelete(context, kbFileDeleteMatch[1], kbFileDeleteMatch[2]);
    }

    const kbDeleteMatch = route.match(/^\/api\/kb\/([^/]+)$/);
    if (kbDeleteMatch) {
        return handleKnowledgeBaseById(context, kbDeleteMatch[1]);
    }

    return null;
}

async function handlePutRoutes(context: ApiRouteContext): Promise<Response | null> {
    const { route } = context;

    if (route.startsWith('/api/brand')) {
        const res = await handleBrandApi(context);
        if (res) return res;
    }

    return null;
}

async function handleMethodAgnosticRoutes(context: ApiRouteContext): Promise<Response | null> {
    const { route, url } = context;

    if (route === '/api/cloudflare/queues') {
        return handleCloudflareQueue(context);
    }

    if (route === '/api/cloudflare/kv') {
        return handleCloudflareKV(context);
    }

    if (route === '/api/cloudflare/r2') {
        return handleCloudflareR2(context);
    }

    if (route === '/api/cloudflare/realtime/ws') {
        return handleRealtimeWebsocket(context);
    }

    if (route.startsWith('/api/upload/file/')) {
        return handleUploadFile(context);
    }

    const dlqMatch = url.pathname.match(/^\/api\/admin\/queues\/dlq\/([^/]+)$/);
    if (dlqMatch) {
        return handleAdminQueuesDLQJob(context, dlqMatch[1]);
    }

    const cronMatch = route.match(/^\/api\/admin\/cron\/(.+)$/);
    if (cronMatch) {
        const action = cronMatch[1].endsWith('/toggle') ? 'toggle' : cronMatch[1].endsWith('/run') ? 'run' : null;
        const cronResult = await handleCronTask(context, cronMatch[1], action);
        return (
            cronResult ??
            errorResponse('Not found', 404, {
                code: 'NOT_FOUND',
            })
        );
    }

    if (
        route.startsWith('/api/ottaorm/') &&
        route !== '/api/ottaorm/init' &&
        route !== '/api/ottaorm/models-metadata'
    ) {
        return handleOttaormCrud(context);
    }

    if (route.startsWith('/api/auth/')) {
        return handleAuthJsRequest(context);
    }

    return null;
}
