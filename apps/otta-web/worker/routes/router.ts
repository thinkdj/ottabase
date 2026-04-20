import { handleAnalyticsTrack } from '@ottabase/analytics/server';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { handleCustomRoutes } from '../../ottabase/config.routes';
import { getKillSwitchStatus } from '../lib/killswitch';
import { handleAccountOnboardingOrganizationCreate, handleAccountOrganizationsList } from './account-organizations';
import { handleAccountSwitchOrg } from './account-switch-org';
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
    handleAdminOrganizationInviteCreate,
    handleAdminOrganizationInviteResend,
    handleAdminOrganizationInviteRevoke,
    handleAdminOrganizationInvitesList,
    handleCurrentOrganizationInviteCreate,
    handleCurrentOrganizationInviteResend,
    handleCurrentOrganizationInviteRevoke,
    handleCurrentOrganizationInvitesList,
} from './admin-organization-invites';
import {
    handleAdminOrganizationInviteMember,
    handleAdminOrganizationMembersList,
    handleAdminOrganizationRemoveMember,
    handleAdminOrganizationUpdateMember,
    handleCurrentOrganizationInviteMember,
    handleCurrentOrganizationMembersList,
    handleCurrentOrganizationRemoveMember,
    handleCurrentOrganizationUpdateMember,
} from './admin-organization-members';
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
import { handleAdminUserById, handleAdminUserSearch, handleAdminUsers } from './admin-users';
import { handleAuditLogs } from './audit';
import {
    handleAuthConfig,
    handleAuthJsRequest,
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
    handleBlogKitchensink,
    handleBlogPostBySlug,
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
import {
    handleAIChat,
    handleAIGatewayChat,
    handleAIProviders,
    handleAIStatus,
    handleAIUniversalChat,
} from './cloudflare-ai';
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
import { handleCurrentOrganizationGet, handleCurrentOrganizationUpdate } from './current-organization';
import { handleDemo, handleDemoError } from './demo';
import { handleEmailProviders, handleEmailTest } from './email';
import {
    handlePublicOrgInviteAccept,
    handlePublicOrgInviteDecline,
    handlePublicOrgInvitePreview,
} from './org-invites-public';
import { handleOttaormCrud } from './ottaorm-crud';
import { handleModelsMetadata, handleOttaormInit } from './ottaorm-init';
import {
    handlePlatformOrganizationAvailability,
    handlePlatformOrganizationCreate,
    handlePlatformOrganizationDelete,
    handlePlatformOrganizationGet,
    handlePlatformOrganizationOffboard,
    handlePlatformOrganizationUpdate,
    handlePlatformOrganizationsList,
} from './platform-organizations';
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
    const { route, env } = context;
    const packages = getOttabaseConfig(env).packages;

    // Brand API (core — always enabled)
    if (route.startsWith('/api/brand')) {
        const res = await handleBrandApi(context);
        if (res) return res;
    }

    if (route === '/api/health') {
        return jsonResponse({
            ok: true,
            name: 'otta-web',
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

    // Ottablog package
    if (packages.ottablog) {
        if (route.startsWith('/api/blog/studio/') && route === '/api/blog/studio/state') {
            return handleBlogStudioState(context);
        }
        if (route === '/api/blog/rss') {
            return handleBlogRssFeed(context);
        }
        if (route === '/api/blog/sitemap.xml') {
            return handleBlogSitemap(context);
        }
        if (route === '/api/blog/posts') {
            return handleBlogPostsList(context);
        }
        const blogRelatedMatch = route.match(/^\/api\/blog\/posts\/([^/]+)\/related$/);
        if (blogRelatedMatch) {
            const postId = decodeURIComponent(blogRelatedMatch[1]);
            return handleBlogRelatedPosts(context, postId);
        }
        const blogBySlugMatch = route.match(/^\/api\/blog\/posts\/by-slug\/([^/]+)$/);
        if (blogBySlugMatch) {
            const slug = decodeURIComponent(blogBySlugMatch[1]);
            return handleBlogPostBySlug(context, slug);
        }
        // Archive endpoints: tag/category/series by slug
        const tagBySlugMatch = route.match(/^\/api\/blog\/tags\/by-slug\/([^/]+)$/);
        if (tagBySlugMatch) {
            const slug = decodeURIComponent(tagBySlugMatch[1]);
            return handleBlogTagBySlug(context, slug);
        }
        const categoryBySlugMatch = route.match(/^\/api\/blog\/categories\/by-slug\/([^/]+)$/);
        if (categoryBySlugMatch) {
            const slug = decodeURIComponent(categoryBySlugMatch[1]);
            return handleBlogCategoryBySlug(context, slug);
        }
        const seriesBySlugMatch = route.match(/^\/api\/blog\/series\/by-slug\/([^/]+)$/);
        if (seriesBySlugMatch) {
            const slug = decodeURIComponent(seriesBySlugMatch[1]);
            return handleBlogSeriesBySlug(context, slug);
        }
    }

    // Shortlinks package
    if (packages.shortlinks) {
        if (route === '/api/shortlinks') {
            return handleShortlinksList(context);
        }
        if (route === '/api/shortlinks/analytics') {
            return handleShortlinksAnalytics(context);
        }
        if (route === '/shortlinks/go') {
            return handleShortlinkExplicitGo(context);
        }
    }

    // Referrals package
    if (packages.referrals) {
        if (route === '/api/referrals/stats') {
            return handleReferralStats(context);
        }
        if (route === '/api/referrals/user') {
            return handleReferralUser(context);
        }
        if (route === '/api/referrals/tracking') {
            return handleReferralTrackingList(context);
        }
        if (route === '/api/referrals/analytics') {
            return handleReferralsAnalytics(context);
        }
    }

    if (route === '/api/analytics/core') {
        return handleCoreAnalytics(context);
    }

    if (route === '/api/audit/logs') {
        return handleAuditLogs(context);
    }

    if (route === '/api/rbac/roles') {
        const { handleRBACRolesList } = await import('./rbac-roles');
        return handleRBACRolesList(context);
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

    if (route === '/api/admin/users/search') {
        return handleAdminUserSearch(context);
    }

    if (route === '/api/account/organizations') {
        return handleAccountOrganizationsList(context);
    }

    if (route === '/api/admin/organization') {
        return handleCurrentOrganizationGet(context);
    }

    if (route === '/api/admin/organization/invites') {
        return handleCurrentOrganizationInvitesList(context);
    }

    if (route === '/api/admin/organization/members') {
        return handleCurrentOrganizationMembersList(context);
    }

    if (route === '/api/admin-platform/organizations') {
        return handlePlatformOrganizationsList(context);
    }

    if (route === '/api/admin-platform/organizations/availability') {
        return handlePlatformOrganizationAvailability(context);
    }

    const publicOrgInvitePreviewMatch = route.match(/^\/api\/public\/org-invites\/([^/]+)$/);
    if (publicOrgInvitePreviewMatch) {
        return handlePublicOrgInvitePreview(context);
    }

    const platformOrganizationInvitesListMatch = route.match(
        /^\/api\/admin-platform\/organizations\/([^/]+)\/invites$/,
    );
    if (platformOrganizationInvitesListMatch) {
        return handleAdminOrganizationInvitesList(context, platformOrganizationInvitesListMatch[1]);
    }

    const platformOrganizationMembersListMatch = route.match(
        /^\/api\/admin-platform\/organizations\/([^/]+)\/members$/,
    );
    if (platformOrganizationMembersListMatch) {
        return handleAdminOrganizationMembersList(context, platformOrganizationMembersListMatch[1]);
    }

    const platformOrganizationGetMatch = route.match(/^\/api\/admin-platform\/organizations\/([^/]+)$/);
    if (platformOrganizationGetMatch) {
        return handlePlatformOrganizationGet(context, platformOrganizationGetMatch[1]);
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

    if (route === '/api/admin/dev-mail') {
        return handleAdminDevMailList(context);
    }

    const devMailGetMatch = route.match(/^\/api\/admin\/dev-mail\/([^/]+)$/);
    if (devMailGetMatch) {
        let devMailId: string;
        try {
            devMailId = decodeURIComponent(devMailGetMatch[1]);
        } catch {
            return errorResponse('Invalid message id', 400, { code: 'BAD_REQUEST' });
        }
        return handleAdminDevMailGet(context, devMailId);
    }

    const tableMatch = route.match(/^\/api\/admin\/db\/tables\/([a-zA-Z0-9_]+)$/);
    if (tableMatch) {
        return handleAdminDbTableData({ ...context, tableName: tableMatch[1] });
    }

    return null;
}

async function handlePostRoutes(context: ApiRouteContext): Promise<Response | null> {
    const { route, env } = context;
    const packages = getOttabaseConfig(env).packages;

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

    if (route === '/api/auth/password/change') {
        return handlePasswordChange(context);
    }

    if (route === '/api/email/test') {
        return handleEmailTest(context);
    }

    const publicOrgInviteDeclineMatch = route.match(/^\/api\/public\/org-invites\/([^/]+)\/decline$/);
    if (publicOrgInviteDeclineMatch) {
        return handlePublicOrgInviteDecline(context);
    }

    const publicOrgInviteAcceptMatch = route.match(/^\/api\/public\/org-invites\/([^/]+)\/accept$/);
    if (publicOrgInviteAcceptMatch) {
        return handlePublicOrgInviteAccept(context);
    }

    const platformOrganizationOffboardMatch = route.match(/^\/api\/admin-platform\/organizations\/([^/]+)\/offboard$/);
    if (platformOrganizationOffboardMatch) {
        return handlePlatformOrganizationOffboard(context, platformOrganizationOffboardMatch[1]);
    }

    const currentOrganizationInviteRevokeMatch = route.match(/^\/api\/admin\/organization\/invites\/([^/]+)\/revoke$/);
    if (currentOrganizationInviteRevokeMatch) {
        return handleCurrentOrganizationInviteRevoke(context, currentOrganizationInviteRevokeMatch[1]);
    }

    const platformOrganizationInviteRevokeMatch = route.match(
        /^\/api\/admin-platform\/organizations\/([^/]+)\/invites\/([^/]+)\/revoke$/,
    );
    if (platformOrganizationInviteRevokeMatch) {
        return handleAdminOrganizationInviteRevoke(
            context,
            platformOrganizationInviteRevokeMatch[1],
            platformOrganizationInviteRevokeMatch[2],
        );
    }

    const currentOrganizationInviteResendMatch = route.match(/^\/api\/admin\/organization\/invites\/([^/]+)\/resend$/);
    if (currentOrganizationInviteResendMatch) {
        return handleCurrentOrganizationInviteResend(context, currentOrganizationInviteResendMatch[1]);
    }

    const platformOrganizationInviteResendMatch = route.match(
        /^\/api\/admin-platform\/organizations\/([^/]+)\/invites\/([^/]+)\/resend$/,
    );
    if (platformOrganizationInviteResendMatch) {
        return handleAdminOrganizationInviteResend(
            context,
            platformOrganizationInviteResendMatch[1],
            platformOrganizationInviteResendMatch[2],
        );
    }

    if (route === '/api/admin/organization/invites') {
        return handleCurrentOrganizationInviteCreate(context);
    }

    const platformOrganizationInviteEmailMatch = route.match(
        /^\/api\/admin-platform\/organizations\/([^/]+)\/invites$/,
    );
    if (platformOrganizationInviteEmailMatch) {
        return handleAdminOrganizationInviteCreate(context, platformOrganizationInviteEmailMatch[1]);
    }

    if (route === '/api/admin/cron') {
        return handleAdminCronCreate(context);
    }

    if (route === '/api/admin/owner/promote') {
        return handleAdminPromoteOwner(context);
    }

    if (route === '/api/admin/organization/members/invite') {
        return handleCurrentOrganizationInviteMember(context);
    }

    const platformOrganizationInviteMatch = route.match(
        /^\/api\/admin-platform\/organizations\/([^/]+)\/members\/invite$/,
    );
    if (platformOrganizationInviteMatch) {
        return handleAdminOrganizationInviteMember(context, platformOrganizationInviteMatch[1]);
    }

    if (packages.ottablog) {
        if (route === '/api/blog/studio/theme/activate') {
            return handleBlogStudioActivateTheme(context);
        }
        if (route === '/api/blog/studio/plugin/enable') {
            return handleBlogStudioPluginEnable(context);
        }
        if (route === '/api/blog/studio/plugin/config') {
            return handleBlogStudioPluginConfig(context);
        }
        if (route === '/api/blog/posts/unlock') {
            return handleBlogPostUnlock(context);
        }
        if (route === '/api/blog/publish-scheduled') {
            return handleBlogPublishScheduled(context);
        }
        if (route === '/api/blog/kitchensink') {
            return handleBlogKitchensink(context);
        }
    }

    if (packages.shortlinks && route === '/api/shortlinks') {
        return handleShortlinksCreate(context);
    }

    if (packages.referrals && route === '/api/referrals/track') {
        return handleReferralTrack(context);
    }

    if (route === '/api/analytics/track') {
        return handleAnalyticsTrack({
            request: context.request,
            dataset: context.env.OBCF_ANALYTICS_CORE,
            defaultAppId: getOttabaseConfig(context.env).appId,
        });
    }

    if (route === '/api/auth/register') {
        return handleAuthRegister(context);
    }

    if (route === '/api/cloudflare/d1/init') {
        return handleD1Init(context);
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

    if (route === '/api/admin/roles') {
        return handleAdminRoleCreate(context);
    }

    if (route === '/api/rbac/roles') {
        const { handleRBACRoleCreate } = await import('./rbac-roles');
        return handleRBACRoleCreate(context);
    }

    if (route === '/api/onboarding/organizations') {
        return handleAccountOnboardingOrganizationCreate(context);
    }

    if (route === '/api/account/switch-org') {
        return handleAccountSwitchOrg(context);
    }

    if (route === '/api/admin-platform/organizations') {
        return handlePlatformOrganizationCreate(context);
    }

    if (route === '/api/ottaorm/init') {
        return handleOttaormInit(context);
    }

    const dlqRetryMatch = context.url.pathname.match(/^\/api\/admin\/queues\/dlq\/([^/]+)\/retry$/);
    if (dlqRetryMatch) {
        return handleAdminQueuesDLQRetryJob(context, dlqRetryMatch[1]);
    }

    return null;
}

async function handlePatchRoutes(context: ApiRouteContext): Promise<Response | null> {
    const { route, env } = context;
    const packages = getOttabaseConfig(env).packages;

    if (route === '/api/admin/organization') {
        return handleCurrentOrganizationUpdate(context);
    }

    const currentOrganizationUpdateMatch = route.match(/^\/api\/admin\/organization\/members\/([^/]+)$/);
    if (currentOrganizationUpdateMatch) {
        return handleCurrentOrganizationUpdateMember(context, decodeURIComponent(currentOrganizationUpdateMatch[1]));
    }

    const platformOrganizationPatchMatch = route.match(/^\/api\/admin-platform\/organizations\/([^/]+)$/);
    if (platformOrganizationPatchMatch) {
        return handlePlatformOrganizationUpdate(context, platformOrganizationPatchMatch[1]);
    }

    const platformOrganizationUpdateMatch = route.match(
        /^\/api\/admin-platform\/organizations\/([^/]+)\/members\/([^/]+)$/,
    );
    if (platformOrganizationUpdateMatch) {
        return handleAdminOrganizationUpdateMember(
            context,
            platformOrganizationUpdateMatch[1],
            decodeURIComponent(platformOrganizationUpdateMatch[2]),
        );
    }

    if (route === '/api/users/me') {
        return handleUserProfile(context);
    }

    if (packages.shortlinks) {
        const shortlinkMatch = route.match(/^\/api\/shortlinks\/(.+)$/);
        if (shortlinkMatch) {
            return handleShortlinkById(context, shortlinkMatch[1], 'PATCH');
        }
    }

    const d1TodoMatch = route.match(/^\/api\/cloudflare\/d1\/todos\/(.+)$/);
    if (d1TodoMatch) {
        return handleD1TodoById(context, d1TodoMatch[1], 'PATCH');
    }

    const adminRolePatchMatch = route.match(/^\/api\/admin\/roles\/([^/]+)$/);
    if (adminRolePatchMatch) {
        return handleAdminRoleUpdate(context, adminRolePatchMatch[1]);
    }

    const rbacRolePatchMatch = route.match(/^\/api\/rbac\/roles\/([^/]+)$/);
    if (rbacRolePatchMatch) {
        const { handleRBACRoleUpdate } = await import('./rbac-roles');
        return handleRBACRoleUpdate(context, rbacRolePatchMatch[1]);
    }

    return null;
}

async function handleDeleteRoutes(context: ApiRouteContext): Promise<Response | null> {
    const { route, url, env } = context;
    const packages = getOttabaseConfig(env).packages;

    if (route.startsWith('/api/brand')) {
        const res = await handleBrandApi(context);
        if (res) return res;
    }

    if (packages.shortlinks) {
        const shortlinkMatch = route.match(/^\/api\/shortlinks\/(.+)$/);
        if (shortlinkMatch) {
            return handleShortlinkById(context, shortlinkMatch[1], 'DELETE');
        }
    }

    if (route === '/api/admin/queues/dlq') {
        return handleAdminQueuesDLQPurge(context);
    }

    if (route === '/api/admin/dev-mail') {
        return handleAdminDevMailClear(context);
    }

    const tableMatch = route.match(/^\/api\/admin\/db\/tables\/([a-zA-Z0-9_]+)$/);
    if (tableMatch) {
        return handleAdminDbTableDelete({ ...context, tableName: tableMatch[1] });
    }

    const devMailDeleteMatch = route.match(/^\/api\/admin\/dev-mail\/([^/]+)$/);
    if (devMailDeleteMatch) {
        let devMailId: string;
        try {
            devMailId = decodeURIComponent(devMailDeleteMatch[1]);
        } catch {
            return errorResponse('Invalid message id', 400, { code: 'BAD_REQUEST' });
        }
        return handleAdminDevMailDelete(context, devMailId);
    }

    const rowMatch = url.pathname.match(/^\/api\/admin\/db\/tables\/([a-zA-Z0-9_]+)\/(.+)$/);
    if (rowMatch) {
        return handleAdminDbRowDelete(
            { ...context, tableName: rowMatch[1] },
            rowMatch[2],
            url.searchParams.get('pk') || 'id',
        );
    }

    const d1TodoMatch = route.match(/^\/api\/cloudflare\/d1\/todos\/(.+)$/);
    if (d1TodoMatch) {
        return handleD1TodoById(context, d1TodoMatch[1], 'DELETE');
    }

    const adminRoleDeleteMatch = route.match(/^\/api\/admin\/roles\/([^/]+)$/);
    if (adminRoleDeleteMatch) {
        return handleAdminRoleDelete(context, adminRoleDeleteMatch[1]);
    }

    const rbacRoleDeleteMatch = route.match(/^\/api\/rbac\/roles\/([^/]+)$/);
    if (rbacRoleDeleteMatch) {
        const { handleRBACRoleDelete } = await import('./rbac-roles');
        return handleRBACRoleDelete(context, rbacRoleDeleteMatch[1]);
    }

    const platformOrganizationEntityDeleteMatch = route.match(/^\/api\/admin-platform\/organizations\/([^/]+)$/);
    if (platformOrganizationEntityDeleteMatch) {
        return handlePlatformOrganizationDelete(context, platformOrganizationEntityDeleteMatch[1]);
    }

    const currentOrganizationDeleteMatch = route.match(/^\/api\/admin\/organization\/members\/([^/]+)$/);
    if (currentOrganizationDeleteMatch) {
        return handleCurrentOrganizationRemoveMember(context, decodeURIComponent(currentOrganizationDeleteMatch[1]));
    }

    const platformOrganizationDeleteMatch = route.match(
        /^\/api\/admin-platform\/organizations\/([^/]+)\/members\/([^/]+)$/,
    );
    if (platformOrganizationDeleteMatch) {
        return handleAdminOrganizationRemoveMember(
            context,
            platformOrganizationDeleteMatch[1],
            decodeURIComponent(platformOrganizationDeleteMatch[2]),
        );
    }

    return null;
}

async function handlePutRoutes(context: ApiRouteContext): Promise<Response | null> {
    const { route, env } = context;
    const packages = getOttabaseConfig(env).packages;

    if (route.startsWith('/api/brand')) {
        const res = await handleBrandApi(context);
        if (res) return res;
    }

    if (packages.referrals && route === '/api/referrals/username') {
        return handleReferralUsernameUpdate(context);
    }

    return null;
}

async function handleMethodAgnosticRoutes(context: ApiRouteContext): Promise<Response | null> {
    const { route, url } = context;

    if (route === '/api/demo') {
        return handleDemo(context);
    }

    if (route === '/api/demo/error') {
        return handleDemoError();
    }

    if (route === '/api/cloudflare/queues') {
        return handleCloudflareQueue(context);
    }

    if (route === '/api/cloudflare/d1/todos') {
        return handleD1Todos(context);
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
