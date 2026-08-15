/**
 * Route-dispatch PARITY test for the worker API router.
 *
 * Written BEFORE the router refactor so it can prove route-for-route parity
 * after. It deliberately depends on ZERO router internals — only on:
 *   - which HANDLER gets called for a given (method, path),
 *   - the extra args that handler receives (slugs / ids / actions),
 *   - the returned Response (body/status) or null.
 *
 * Every handler module router.ts imports from is mocked; each mocked export
 * resolves to `new Response('<export-name>')` so the winning handler is also
 * identifiable from the response body. Two exceptions default to null because
 * they are decline-and-continue / null-capable handlers: handleBrandApi and
 * handleCronTask.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handlerMock } = vi.hoisted(() => ({
    // Each call returns a fresh Response so bodies can be read per-test.
    handlerMock: (name: string) => vi.fn(async () => new Response(name)),
}));

vi.mock('../admin-cron', () => ({
    handleAdminCronCreate: handlerMock('handleAdminCronCreate'),
    handleAdminCronList: handlerMock('handleAdminCronList'),
    // Decline-capable: router turns null into its own 404 for /api/admin/cron/*
    handleCronTask: vi.fn(async () => null),
}));

vi.mock('../admin-db', () => ({
    handleAdminDbRowDelete: handlerMock('handleAdminDbRowDelete'),
    handleAdminDbTableData: handlerMock('handleAdminDbTableData'),
    handleAdminDbTableDelete: handlerMock('handleAdminDbTableDelete'),
    handleAdminDbTables: handlerMock('handleAdminDbTables'),
}));

vi.mock('../admin-dev-mail', () => ({
    handleAdminDevMailClear: handlerMock('handleAdminDevMailClear'),
    handleAdminDevMailDelete: handlerMock('handleAdminDevMailDelete'),
    handleAdminDevMailGet: handlerMock('handleAdminDevMailGet'),
    handleAdminDevMailList: handlerMock('handleAdminDevMailList'),
}));

vi.mock('../admin-organization-members', () => ({
    handleAdminOrganizationInviteMember: handlerMock('handleAdminOrganizationInviteMember'),
    handleAdminOrganizationMembersList: handlerMock('handleAdminOrganizationMembersList'),
    handleAdminOrganizationRemoveMember: handlerMock('handleAdminOrganizationRemoveMember'),
    handleAdminOrganizationUpdateMember: handlerMock('handleAdminOrganizationUpdateMember'),
}));

vi.mock('../admin-owner', () => ({
    handleAdminPromotePlatformOwner: handlerMock('handleAdminPromotePlatformOwner'),
}));

vi.mock('../admin-queues', () => ({
    handleAdminQueuesDLQJob: handlerMock('handleAdminQueuesDLQJob'),
    handleAdminQueuesDLQList: handlerMock('handleAdminQueuesDLQList'),
    handleAdminQueuesDLQPurge: handlerMock('handleAdminQueuesDLQPurge'),
    handleAdminQueuesDLQRetryAll: handlerMock('handleAdminQueuesDLQRetryAll'),
    handleAdminQueuesDLQRetryJob: handlerMock('handleAdminQueuesDLQRetryJob'),
    handleAdminQueuesFailed: handlerMock('handleAdminQueuesFailed'),
    handleAdminQueuesOverview: handlerMock('handleAdminQueuesOverview'),
    handleAdminQueuesPending: handlerMock('handleAdminQueuesPending'),
    handleAdminQueuesProcessed: handlerMock('handleAdminQueuesProcessed'),
    handleAdminQueuesResetStats: handlerMock('handleAdminQueuesResetStats'),
}));

vi.mock('../admin-roles', () => ({
    handleAdminRoleCreate: handlerMock('handleAdminRoleCreate'),
    handleAdminRoleDelete: handlerMock('handleAdminRoleDelete'),
    handleAdminRoleUpdate: handlerMock('handleAdminRoleUpdate'),
    handleAdminRolesList: handlerMock('handleAdminRolesList'),
}));

vi.mock('../admin-users', () => ({
    handleAdminUserById: handlerMock('handleAdminUserById'),
    handleAdminUserSearch: handlerMock('handleAdminUserSearch'),
    handleAdminUsers: handlerMock('handleAdminUsers'),
}));

vi.mock('../audit', () => ({
    handleAuditLogs: handlerMock('handleAuditLogs'),
}));

vi.mock('../auth', () => ({
    handleAuthConfig: handlerMock('handleAuthConfig'),
    handleAuthApiRequest: handlerMock('handleAuthApiRequest'),
    handleAuthRegister: handlerMock('handleAuthRegister'),
    handlePasswordChange: handlerMock('handlePasswordChange'),
    handlePasswordResetConfirm: handlerMock('handlePasswordResetConfirm'),
    handlePasswordResetRequest: handlerMock('handlePasswordResetRequest'),
    handleUserProfile: handlerMock('handleUserProfile'),
    handleVerifyEmail: handlerMock('handleVerifyEmail'),
    handleVerifyEmailResend: handlerMock('handleVerifyEmailResend'),
}));

vi.mock('../blog', () => ({
    handleBlogBlurbCreate: handlerMock('handleBlogBlurbCreate'),
    handleBlogBlurbUpdate: handlerMock('handleBlogBlurbUpdate'),
    handleBlogPhotoJournalCreate: handlerMock('handleBlogPhotoJournalCreate'),
    handleBlogPhotoJournalUpdate: handlerMock('handleBlogPhotoJournalUpdate'),
    handleBlogCategoryBySlug: handlerMock('handleBlogCategoryBySlug'),
    handleBlogDemoSeed: handlerMock('handleBlogDemoSeed'),
    handleBlogPostBySlug: handlerMock('handleBlogPostBySlug'),
    handleBlogPostUnlock: handlerMock('handleBlogPostUnlock'),
    handleBlogPostsList: handlerMock('handleBlogPostsList'),
    handleBlogPreviewTokenMint: handlerMock('handleBlogPreviewTokenMint'),
    handleBlogPublishScheduled: handlerMock('handleBlogPublishScheduled'),
    handleBlogRelatedPosts: handlerMock('handleBlogRelatedPosts'),
    handleBlogRssFeed: handlerMock('handleBlogRssFeed'),
    handleBlogSeriesBySlug: handlerMock('handleBlogSeriesBySlug'),
    handleBlogSitemap: handlerMock('handleBlogSitemap'),
    handleBlogStudioActivateTheme: handlerMock('handleBlogStudioActivateTheme'),
    handleBlogStudioPluginConfig: handlerMock('handleBlogStudioPluginConfig'),
    handleBlogStudioPluginEnable: handlerMock('handleBlogStudioPluginEnable'),
    handleBlogStudioState: handlerMock('handleBlogStudioState'),
    handleBlogStudioThemeTokens: handlerMock('handleBlogStudioThemeTokens'),
    handleBlogTagBySlug: handlerMock('handleBlogTagBySlug'),
}));

vi.mock('../brand', () => ({
    // Decline-and-continue prefix handler: default null so matching continues.
    handleBrandApi: vi.fn(async () => null),
}));

vi.mock('../cloudflare-d1', () => ({
    handleD1Init: handlerMock('handleD1Init'),
    handleD1TodoById: handlerMock('handleD1TodoById'),
    handleD1Todos: handlerMock('handleD1Todos'),
}));

vi.mock('../cloudflare-queue', () => ({
    handleCloudflareQueue: handlerMock('handleCloudflareQueue'),
}));

vi.mock('../cloudflare-rate', () => ({
    handleRateLimiting: handlerMock('handleRateLimiting'),
}));

vi.mock('../cloudflare-realtime', () => ({
    handleRealtimeBroadcast: handlerMock('handleRealtimeBroadcast'),
    handleRealtimeStats: handlerMock('handleRealtimeStats'),
    handleRealtimeWebsocket: handlerMock('handleRealtimeWebsocket'),
}));

vi.mock('../cloudflare-storage', () => ({
    handleCloudflareImages: handlerMock('handleCloudflareImages'),
    handleCloudflareKV: handlerMock('handleCloudflareKV'),
    handleCloudflareR2: handlerMock('handleCloudflareR2'),
    handleUpload: handlerMock('handleUpload'),
    handleUploadFile: handlerMock('handleUploadFile'),
}));

vi.mock('../core-analytics', () => ({
    handleCoreAnalytics: handlerMock('handleCoreAnalytics'),
}));

vi.mock('../demo', () => ({
    handleDemo: handlerMock('handleDemo'),
    handleDemoError: handlerMock('handleDemoError'),
}));

vi.mock('../email', () => ({
    handleEmailProviders: handlerMock('handleEmailProviders'),
    handleEmailTest: handlerMock('handleEmailTest'),
}));

vi.mock('../ottaorm-crud', () => ({
    handleOttaormCrud: handlerMock('handleOttaormCrud'),
}));

vi.mock('../ottaorm-init', () => ({
    handleModelsMetadata: handlerMock('handleModelsMetadata'),
    handleOttaormInit: handlerMock('handleOttaormInit'),
}));

vi.mock('../referrals', () => ({
    handleReferralStats: handlerMock('handleReferralStats'),
    handleReferralTrack: handlerMock('handleReferralTrack'),
    handleReferralTrackingList: handlerMock('handleReferralTrackingList'),
    handleReferralUser: handlerMock('handleReferralUser'),
    handleReferralUsernameUpdate: handlerMock('handleReferralUsernameUpdate'),
    handleReferralsAnalytics: handlerMock('handleReferralsAnalytics'),
}));

vi.mock('../shortlinks', () => ({
    handleShortlinkById: handlerMock('handleShortlinkById'),
    handleShortlinkExplicitGo: handlerMock('handleShortlinkExplicitGo'),
    handleShortlinksAnalytics: handlerMock('handleShortlinksAnalytics'),
    handleShortlinksCreate: handlerMock('handleShortlinksCreate'),
    handleShortlinksList: handlerMock('handleShortlinksList'),
}));

vi.mock('../../../ottabase/config.routes', () => ({
    handleCustomRoutes: vi.fn(async () => null),
}));

vi.mock('../../../ottabase/config.loader', () => ({
    getOttabaseConfig: vi.fn(() => ({
        appId: 'otta-web',
        packages: { ottablog: true, shortlinks: true, referrals: true },
    })),
}));

vi.mock('../../lib/killswitch', () => ({
    getKillSwitchStatus: vi.fn(() => ({ killSwitches: {} })),
}));

vi.mock('@ottabase/analytics/server', () => ({
    handleAnalyticsTrack: handlerMock('handleAnalyticsTrack'),
}));

import { handleAnalyticsTrack } from '@ottabase/analytics/server';
import { getOttabaseConfig } from '../../../ottabase/config.loader';
import { handleCustomRoutes } from '../../../ottabase/config.routes';
import { handleAdminCronCreate, handleAdminCronList, handleCronTask } from '../admin-cron';
import {
    handleAdminDbRowDelete,
    handleAdminDbTableData,
    handleAdminDbTableDelete,
    handleAdminDbTables,
} from '../admin-db';
import {
    handleAdminDevMailClear,
    handleAdminDevMailDelete,
    handleAdminDevMailGet,
    handleAdminDevMailList,
} from '../admin-dev-mail';
import {
    handleAdminOrganizationInviteMember,
    handleAdminOrganizationMembersList,
    handleAdminOrganizationRemoveMember,
    handleAdminOrganizationUpdateMember,
} from '../admin-organization-members';
import { handleAdminPromotePlatformOwner } from '../admin-owner';
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
} from '../admin-queues';
import {
    handleAdminRoleCreate,
    handleAdminRoleDelete,
    handleAdminRoleUpdate,
    handleAdminRolesList,
} from '../admin-roles';
import { handleAdminUserById, handleAdminUserSearch, handleAdminUsers } from '../admin-users';
import { handleAuditLogs } from '../audit';
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
} from '../auth';
import {
    handleBlogBlurbCreate,
    handleBlogBlurbUpdate,
    handleBlogPhotoJournalCreate,
    handleBlogPhotoJournalUpdate,
    handleBlogCategoryBySlug,
    handleBlogDemoSeed,
    handleBlogPostBySlug,
    handleBlogPostUnlock,
    handleBlogPostsList,
    handleBlogPreviewTokenMint,
    handleBlogPublishScheduled,
    handleBlogRelatedPosts,
    handleBlogRssFeed,
    handleBlogSeriesBySlug,
    handleBlogSitemap,
    handleBlogStudioActivateTheme,
    handleBlogStudioPluginConfig,
    handleBlogStudioPluginEnable,
    handleBlogStudioState,
    handleBlogStudioThemeTokens,
    handleBlogTagBySlug,
} from '../blog';
import { handleBrandApi } from '../brand';
import { handleD1Init, handleD1TodoById, handleD1Todos } from '../cloudflare-d1';
import { handleCloudflareQueue } from '../cloudflare-queue';
import { handleRateLimiting } from '../cloudflare-rate';
import { handleRealtimeBroadcast, handleRealtimeStats, handleRealtimeWebsocket } from '../cloudflare-realtime';
import {
    handleCloudflareImages,
    handleCloudflareKV,
    handleCloudflareR2,
    handleUpload,
    handleUploadFile,
} from '../cloudflare-storage';
import { handleCoreAnalytics } from '../core-analytics';
import { handleDemo, handleDemoError } from '../demo';
import { handleEmailProviders, handleEmailTest } from '../email';
import { handleOttaormCrud } from '../ottaorm-crud';
import { handleModelsMetadata, handleOttaormInit } from '../ottaorm-init';
import {
    handleReferralStats,
    handleReferralTrack,
    handleReferralTrackingList,
    handleReferralUser,
    handleReferralUsernameUpdate,
    handleReferralsAnalytics,
} from '../referrals';
import { apiRouter, handleApiRequest } from '../router';
import {
    handleShortlinkById,
    handleShortlinkExplicitGo,
    handleShortlinksAnalytics,
    handleShortlinksCreate,
    handleShortlinksList,
} from '../shortlinks';

/**
 * The ONLY place in this file that knows how routing is invoked.
 * After the router refactor, ONLY this helper should need to change —
 * every test below asserts observable dispatch behavior (which handler,
 * which extra args, which response), never router internals.
 */
async function dispatch(method: string, path: string) {
    const request = new Request('http://localhost' + path, { method });
    const url = new URL(request.url);
    const route = url.pathname !== '/' && url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
    const context = {
        request,
        env: {},
        url,
        route,
        method,
        corsHeaders: { 'X-CORS': '1' },
        withAuthCors: (r: Response) => r,
    } as any;
    return { response: await handleApiRequest(request, context.env), context };
}

/** Every mocked route handler — used to assert "nothing was called". */
const ALL_HANDLER_MOCKS: Record<string, ReturnType<typeof vi.fn>> = {
    handleAdminCronCreate,
    handleAdminCronList,
    handleCronTask,
    handleAdminDbRowDelete,
    handleAdminDbTableData,
    handleAdminDbTableDelete,
    handleAdminDbTables,
    handleAdminDevMailClear,
    handleAdminDevMailDelete,
    handleAdminDevMailGet,
    handleAdminDevMailList,
    handleAdminOrganizationInviteMember,
    handleAdminOrganizationMembersList,
    handleAdminOrganizationRemoveMember,
    handleAdminOrganizationUpdateMember,
    handleAdminPromotePlatformOwner,
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
    handleAdminRoleCreate,
    handleAdminRoleDelete,
    handleAdminRoleUpdate,
    handleAdminRolesList,
    handleAdminUserById,
    handleAdminUserSearch,
    handleAdminUsers,
    handleAuditLogs,
    handleAuthConfig,
    handleAuthApiRequest,
    handleAuthRegister,
    handlePasswordChange,
    handlePasswordResetConfirm,
    handlePasswordResetRequest,
    handleUserProfile,
    handleVerifyEmail,
    handleVerifyEmailResend,
    handleBlogBlurbCreate,
    handleBlogBlurbUpdate,
    handleBlogPhotoJournalCreate,
    handleBlogPhotoJournalUpdate,
    handleBlogCategoryBySlug,
    handleBlogDemoSeed,
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
    handleBrandApi,
    handleD1Init,
    handleD1TodoById,
    handleD1Todos,
    handleCloudflareQueue,
    handleRateLimiting,
    handleRealtimeBroadcast,
    handleRealtimeStats,
    handleRealtimeWebsocket,
    handleCloudflareImages,
    handleCloudflareKV,
    handleCloudflareR2,
    handleUpload,
    handleUploadFile,
    handleCoreAnalytics,
    handleDemo,
    handleDemoError,
    handleEmailProviders,
    handleEmailTest,
    handleOttaormCrud,
    handleModelsMetadata,
    handleOttaormInit,
    handleReferralStats,
    handleReferralTrack,
    handleReferralTrackingList,
    handleReferralUser,
    handleReferralUsernameUpdate,
    handleReferralsAnalytics,
    handleShortlinkById,
    handleShortlinkExplicitGo,
    handleShortlinksAnalytics,
    handleShortlinksCreate,
    handleShortlinksList,
    handleAnalyticsTrack,
    handleCustomRoutes,
} as any;

function expectNoHandlersCalled(except: string[] = []) {
    for (const [name, mock] of Object.entries(ALL_HANDLER_MOCKS)) {
        if (except.includes(name)) continue;
        expect(mock, `${name} should not have been called`).not.toHaveBeenCalled();
    }
}

const GATES_ON = {
    appId: 'otta-web',
    packages: { ottablog: true, shortlinks: true, referrals: true },
};

const GATES_OFF = {
    appId: 'otta-web',
    packages: { ottablog: false, shortlinks: false, referrals: false },
};

beforeEach(() => {
    vi.clearAllMocks();
    // Re-establish defaults every test so per-test overrides never leak.
    vi.mocked(getOttabaseConfig).mockImplementation(() => GATES_ON as any);
    vi.mocked(handleBrandApi).mockImplementation(async () => null as any);
    vi.mocked(handleCronTask).mockImplementation(async () => null as any);
    vi.mocked(handleCustomRoutes).mockImplementation(async () => null as any);
});

describe('router dispatch parity', () => {
    describe('CORS preflight', () => {
        it('OPTIONS /api/anything returns 204 and calls no handler', async () => {
            const { response } = await dispatch('OPTIONS', '/api/anything');
            expect(response).not.toBeNull();
            // Per parity rules: assert status only, not specific headers.
            expect(response!.status).toBe(204);
            expectNoHandlersCalled();
        });
    });

    describe('inline health route', () => {
        it('GET /api/health returns 200 ok:true JSON from the real inline handler', async () => {
            const { response } = await dispatch('GET', '/api/health');
            expect(response).not.toBeNull();
            expect(response!.status).toBe(200);
            const body = (await response!.json()) as any;
            expect(body.ok).toBe(true);
            expect(body.name).toBe('otta-web');
            expectNoHandlersCalled();
        });

        it('HEAD /api/health matches nothing (no auto-HEAD)', async () => {
            const { response } = await dispatch('HEAD', '/api/health');
            expect(response).toBeNull();
        });
    });

    describe('admin users', () => {
        it('GET /api/admin/users/search dispatches to search, not user-by-id', async () => {
            const { response, context } = await dispatch('GET', '/api/admin/users/search');
            expect(handleAdminUserSearch).toHaveBeenCalledTimes(1);
            expect(vi.mocked(handleAdminUserSearch).mock.calls[0][0].request).toBe(context.request);
            expect(handleAdminUserById).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleAdminUserSearch');
        });

        it('GET /api/admin/users/u1 dispatches to user-by-id with "u1"', async () => {
            const { response } = await dispatch('GET', '/api/admin/users/u1');
            expect(handleAdminUserById).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }), 'u1');
            expect(handleAdminUserSearch).not.toHaveBeenCalled();
            expect(handleAdminUsers).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleAdminUserById');
        });

        it('GET /api/admin/users/ (trailing slash) normalizes to the users list route', async () => {
            const { response } = await dispatch('GET', '/api/admin/users/');
            expect(handleAdminUsers).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }));
            expect(handleAdminUserById).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleAdminUsers');
        });
    });

    describe('admin cron', () => {
        it('GET /api/admin/cron lists, does not create', async () => {
            const { response } = await dispatch('GET', '/api/admin/cron');
            expect(handleAdminCronList).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }));
            expect(handleAdminCronCreate).not.toHaveBeenCalled();
            expect(handleCronTask).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleAdminCronList');
        });

        it('POST /api/admin/cron creates, does not list', async () => {
            const { response } = await dispatch('POST', '/api/admin/cron');
            expect(handleAdminCronCreate).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
            expect(handleAdminCronList).not.toHaveBeenCalled();
            expect(handleCronTask).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleAdminCronCreate');
        });

        it('PATCH /api/admin/cron matches nothing', async () => {
            const { response } = await dispatch('PATCH', '/api/admin/cron');
            expect(response).toBeNull();
            expect(handleAdminCronList).not.toHaveBeenCalled();
            expect(handleAdminCronCreate).not.toHaveBeenCalled();
            expect(handleCronTask).not.toHaveBeenCalled();
        });

        it('GET /api/admin/cron/task-1/run dispatches to handleCronTask with rest + action', async () => {
            vi.mocked(handleCronTask).mockResolvedValueOnce(new Response('handleCronTask'));
            const { response } = await dispatch('GET', '/api/admin/cron/task-1/run');
            expect(handleCronTask).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'GET' }),
                'task-1/run',
                'run',
            );
            expect(await response!.text()).toBe('handleCronTask');
        });

        it('handleCronTask returning null yields a 404 Response, not null', async () => {
            const { response } = await dispatch('GET', '/api/admin/cron/unknown-task');
            expect(handleCronTask).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'GET' }),
                'unknown-task',
                null,
            );
            expect(response).not.toBeNull();
            expect(response!.status).toBe(404);
        });
    });

    describe('ottaorm', () => {
        it('GET /api/ottaorm/init dispatches to handleOttaormInit', async () => {
            const { response } = await dispatch('GET', '/api/ottaorm/init');
            expect(handleOttaormInit).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }));
            expect(handleOttaormCrud).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleOttaormInit');
        });

        it('POST /api/ottaorm/init dispatches to handleOttaormInit', async () => {
            const { response } = await dispatch('POST', '/api/ottaorm/init');
            expect(handleOttaormInit).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
            expect(handleOttaormCrud).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleOttaormInit');
        });

        it('PATCH /api/ottaorm/init matches nothing — the crud catch-all excludes init', async () => {
            const { response } = await dispatch('PATCH', '/api/ottaorm/init');
            expect(response).toBeNull();
            expect(handleOttaormInit).not.toHaveBeenCalled();
            expect(handleOttaormCrud).not.toHaveBeenCalled();
        });

        it('GET /api/ottaorm/User dispatches to the crud catch-all', async () => {
            const { response } = await dispatch('GET', '/api/ottaorm/User');
            expect(handleOttaormCrud).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }));
            expect(handleOttaormInit).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleOttaormCrud');
        });
    });

    describe('auth', () => {
        it('GET /api/auth/config dispatches to handleAuthConfig, not the auth catch-all', async () => {
            const { response } = await dispatch('GET', '/api/auth/config');
            expect(handleAuthConfig).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }));
            expect(handleAuthApiRequest).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleAuthConfig');
        });

        it('POST /api/auth/config falls through to the auth catch-all', async () => {
            const { response } = await dispatch('POST', '/api/auth/config');
            expect(handleAuthApiRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
            expect(handleAuthConfig).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleAuthApiRequest');
        });

        it('GET /api/auth/callback/google dispatches to the auth catch-all', async () => {
            const { response } = await dispatch('GET', '/api/auth/callback/google');
            expect(handleAuthApiRequest).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }));
            expect(await response!.text()).toBe('handleAuthApiRequest');
        });

        it('GET /api/auth (bare, no trailing segment) matches nothing', async () => {
            const { response } = await dispatch('GET', '/api/auth');
            expect(response).toBeNull();
            expect(handleAuthApiRequest).not.toHaveBeenCalled();
            expect(handleAuthConfig).not.toHaveBeenCalled();
        });
    });

    describe('blog (gate on)', () => {
        it('POST /api/blog/blurbs dispatches to blurb creation', async () => {
            const { response } = await dispatch('POST', '/api/blog/blurbs');
            expect(handleBlogBlurbCreate).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
            expect(await response!.text()).toBe('handleBlogBlurbCreate');
        });

        it('PATCH /api/blog/blurbs/b1 dispatches to blurb update with "b1"', async () => {
            const { response } = await dispatch('PATCH', '/api/blog/blurbs/b1');
            expect(handleBlogBlurbUpdate).toHaveBeenCalledWith(expect.objectContaining({ method: 'PATCH' }), 'b1');
            expect(await response!.text()).toBe('handleBlogBlurbUpdate');
        });

        it('POST /api/blog/photo-journals dispatches to photo journal creation', async () => {
            const { response } = await dispatch('POST', '/api/blog/photo-journals');
            expect(handleBlogPhotoJournalCreate).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
            expect(await response!.text()).toBe('handleBlogPhotoJournalCreate');
        });

        it('PATCH /api/blog/photo-journals/p1 dispatches to photo journal update with "p1"', async () => {
            const { response } = await dispatch('PATCH', '/api/blog/photo-journals/p1');
            expect(handleBlogPhotoJournalUpdate).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'PATCH' }),
                'p1',
            );
            expect(await response!.text()).toBe('handleBlogPhotoJournalUpdate');
        });

        it('GET /api/blog/posts/by-slug/hello%20world decodes the slug', async () => {
            const { response } = await dispatch('GET', '/api/blog/posts/by-slug/hello%20world');
            expect(handleBlogPostBySlug).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'GET' }),
                'hello world',
            );
            expect(await response!.text()).toBe('handleBlogPostBySlug');
        });

        it('GET /api/blog/posts dispatches to the posts list', async () => {
            const { response } = await dispatch('GET', '/api/blog/posts');
            expect(handleBlogPostsList).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }));
            expect(handleBlogPostBySlug).not.toHaveBeenCalled();
            expect(handleBlogRelatedPosts).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleBlogPostsList');
        });

        it('GET /api/blog/posts/p1/related dispatches to related posts with "p1"', async () => {
            const { response } = await dispatch('GET', '/api/blog/posts/p1/related');
            expect(handleBlogRelatedPosts).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }), 'p1');
            expect(handleBlogPostsList).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleBlogRelatedPosts');
        });

        it('POST /api/blog/posts/preview-token dispatches to the preview mint', async () => {
            const { response } = await dispatch('POST', '/api/blog/posts/preview-token');
            expect(handleBlogPreviewTokenMint).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
            expect(handleBlogPostUnlock).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleBlogPreviewTokenMint');
        });

        it('POST /api/blog/seed-demo dispatches to the demo content seed', async () => {
            const { response } = await dispatch('POST', '/api/blog/seed-demo');
            expect(handleBlogDemoSeed).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
            expect(await response!.text()).toBe('handleBlogDemoSeed');
        });

        it('POST /api/blog/studio/theme/tokens dispatches to the theme tokens handler', async () => {
            const { response } = await dispatch('POST', '/api/blog/studio/theme/tokens');
            expect(handleBlogStudioThemeTokens).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
            expect(handleBlogStudioActivateTheme).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleBlogStudioThemeTokens');
        });
    });

    describe('package gates off', () => {
        beforeEach(() => {
            vi.mocked(getOttabaseConfig).mockImplementation(() => GATES_OFF as any);
        });

        it('GET /api/blog/posts matches nothing when ottablog is disabled', async () => {
            const { response } = await dispatch('GET', '/api/blog/posts');
            expect(response).toBeNull();
            expect(handleBlogPostsList).not.toHaveBeenCalled();
        });

        it('GET /api/shortlinks matches nothing when shortlinks is disabled', async () => {
            const { response } = await dispatch('GET', '/api/shortlinks');
            expect(response).toBeNull();
            expect(handleShortlinksList).not.toHaveBeenCalled();
        });

        it('PATCH /api/shortlinks/abc matches nothing when shortlinks is disabled', async () => {
            const { response } = await dispatch('PATCH', '/api/shortlinks/abc');
            expect(response).toBeNull();
            expect(handleShortlinkById).not.toHaveBeenCalled();
        });
    });

    describe('shortlinks (gate on)', () => {
        it('PATCH /api/shortlinks/abc dispatches with id and method literal', async () => {
            const { response } = await dispatch('PATCH', '/api/shortlinks/abc');
            expect(handleShortlinkById).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'PATCH' }),
                'abc',
                'PATCH',
            );
            expect(await response!.text()).toBe('handleShortlinkById');
        });

        it('DELETE /api/shortlinks/a/b captures the rest-of-path id including slashes', async () => {
            const { response } = await dispatch('DELETE', '/api/shortlinks/a/b');
            expect(handleShortlinkById).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'DELETE' }),
                'a/b',
                'DELETE',
            );
            expect(await response!.text()).toBe('handleShortlinkById');
        });

        it('GET /shortlinks/go (outside /api) dispatches to the explicit-go handler', async () => {
            const { response } = await dispatch('GET', '/shortlinks/go?code=x');
            expect(handleShortlinkExplicitGo).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }));
            expect(await response!.text()).toBe('handleShortlinkExplicitGo');
        });
    });

    describe('referrals (gate on)', () => {
        it('PUT /api/referrals/username dispatches to the username update handler', async () => {
            const { response } = await dispatch('PUT', '/api/referrals/username');
            expect(handleReferralUsernameUpdate).toHaveBeenCalledWith(expect.objectContaining({ method: 'PUT' }));
            expect(await response!.text()).toBe('handleReferralUsernameUpdate');
        });
    });

    describe('brand prefix handler', () => {
        it('GET /api/brand/colors returns the brand response when brand handles it', async () => {
            vi.mocked(handleBrandApi).mockResolvedValueOnce(new Response('brand-response'));
            const { response, context } = await dispatch('GET', '/api/brand/colors');
            expect(handleBrandApi).toHaveBeenCalledTimes(1);
            expect(vi.mocked(handleBrandApi).mock.calls[0][0].request).toBe(context.request);
            expect(await response!.text()).toBe('brand-response');
        });

        it('GET /api/brand/colors with brand declining (null) yields overall null', async () => {
            const { response } = await dispatch('GET', '/api/brand/colors');
            expect(handleBrandApi).toHaveBeenCalledTimes(1);
            expect(response).toBeNull();
        });

        it('brand declining does not block other routes: GET /api/health still works', async () => {
            const { response } = await dispatch('GET', '/api/health');
            expect(response!.status).toBe(200);
            expect(((await response!.json()) as any).ok).toBe(true);
        });
    });

    describe('admin queues DLQ', () => {
        it('POST /api/admin/queues/dlq/retry-all dispatches to retry-all, not the job route', async () => {
            const { response } = await dispatch('POST', '/api/admin/queues/dlq/retry-all');
            expect(handleAdminQueuesDLQRetryAll).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
            expect(handleAdminQueuesDLQJob).not.toHaveBeenCalled();
            expect(handleAdminQueuesDLQRetryJob).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleAdminQueuesDLQRetryAll');
        });

        it('POST /api/admin/queues/dlq/j1/retry dispatches to retry-job with "j1"', async () => {
            const { response } = await dispatch('POST', '/api/admin/queues/dlq/j1/retry');
            expect(handleAdminQueuesDLQRetryJob).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'POST' }),
                'j1',
            );
            expect(handleAdminQueuesDLQJob).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleAdminQueuesDLQRetryJob');
        });

        it('PUT /api/admin/queues/dlq/j9 dispatches to the method-agnostic DLQ job route with "j9"', async () => {
            const { response } = await dispatch('PUT', '/api/admin/queues/dlq/j9');
            expect(handleAdminQueuesDLQJob).toHaveBeenCalledWith(expect.objectContaining({ method: 'PUT' }), 'j9');
            expect(handleAdminQueuesDLQRetryJob).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleAdminQueuesDLQJob');
        });
    });

    describe('admin db tables', () => {
        it('GET /api/admin/db/tables/users injects tableName into the context arg', async () => {
            const { response, context } = await dispatch('GET', '/api/admin/db/tables/users');
            expect(handleAdminDbTableData).toHaveBeenCalledTimes(1);
            const firstArg = vi.mocked(handleAdminDbTableData).mock.calls[0][0] as any;
            expect(firstArg.tableName).toBe('users');
            expect(firstArg.request).toBe(context.request);
            expect(await response!.text()).toBe('handleAdminDbTableData');
        });

        it('DELETE /api/admin/db/tables/users injects tableName into the context arg', async () => {
            const { response, context } = await dispatch('DELETE', '/api/admin/db/tables/users');
            expect(handleAdminDbTableDelete).toHaveBeenCalledTimes(1);
            const firstArg = vi.mocked(handleAdminDbTableDelete).mock.calls[0][0] as any;
            expect(firstArg.tableName).toBe('users');
            expect(firstArg.request).toBe(context.request);
            expect(handleAdminDbRowDelete).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleAdminDbTableDelete');
        });

        it('DELETE /api/admin/db/tables/users/row-1?pk=uid dispatches to row-delete with rowId and pk', async () => {
            const { response } = await dispatch('DELETE', '/api/admin/db/tables/users/row-1?pk=uid');
            expect(handleAdminDbRowDelete).toHaveBeenCalledTimes(1);
            const [firstArg, rowId, pk] = vi.mocked(handleAdminDbRowDelete).mock.calls[0] as any[];
            expect(firstArg.tableName).toBe('users');
            expect(rowId).toBe('row-1');
            expect(pk).toBe('uid');
            expect(handleAdminDbTableDelete).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleAdminDbRowDelete');
        });

        it('DELETE /api/admin/db/tables/bad-table! violates the table charset and matches nothing', async () => {
            const { response } = await dispatch('DELETE', '/api/admin/db/tables/bad-table!');
            expect(response).toBeNull();
            expect(handleAdminDbTableDelete).not.toHaveBeenCalled();
            expect(handleAdminDbRowDelete).not.toHaveBeenCalled();
        });

        it('GET /api/admin/db/tables/us%65rs (percent-encoded, decodes to alnum) still matches nothing — charset is checked on the raw segment', async () => {
            const { response } = await dispatch('GET', '/api/admin/db/tables/us%65rs');
            expect(response).toBeNull();
            expect(handleAdminDbTableData).not.toHaveBeenCalled();
        });

        it('DELETE /api/admin/db/tables/%zz (malformed percent-encoding) falls through instead of 400-walling', async () => {
            const { response } = await dispatch('DELETE', '/api/admin/db/tables/%zz');
            expect(response).toBeNull();
            expect(handleAdminDbTableDelete).not.toHaveBeenCalled();
        });

        it('DELETE /api/admin/db/tables/us%65rs/row-1 (percent-encoded table name) falls through, not routed as a row delete', async () => {
            const { response } = await dispatch('DELETE', '/api/admin/db/tables/us%65rs/row-1');
            expect(response).toBeNull();
            expect(handleAdminDbRowDelete).not.toHaveBeenCalled();
        });
    });

    describe('admin dev-mail', () => {
        it('GET /api/admin/dev-mail/msg%2F1 decodes the message id', async () => {
            const { response } = await dispatch('GET', '/api/admin/dev-mail/msg%2F1');
            expect(handleAdminDevMailGet).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }), 'msg/1');
            expect(handleAdminDevMailList).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleAdminDevMailGet');
        });
    });

    describe('all-methods (method-agnostic) routes', () => {
        it('PATCH /api/cloudflare/d1/todos/t1 dispatches with id and method literal', async () => {
            const { response } = await dispatch('PATCH', '/api/cloudflare/d1/todos/t1');
            expect(handleD1TodoById).toHaveBeenCalledWith(expect.objectContaining({ method: 'PATCH' }), 't1', 'PATCH');
            expect(await response!.text()).toBe('handleD1TodoById');
        });

        it('DELETE /api/cloudflare/d1/todos/t1 dispatches with id and method literal', async () => {
            const { response } = await dispatch('DELETE', '/api/cloudflare/d1/todos/t1');
            expect(handleD1TodoById).toHaveBeenCalledWith(
                expect.objectContaining({ method: 'DELETE' }),
                't1',
                'DELETE',
            );
            expect(await response!.text()).toBe('handleD1TodoById');
        });

        it('PUT /api/cloudflare/kv dispatches to the KV handler via the agnostic block', async () => {
            const { response } = await dispatch('PUT', '/api/cloudflare/kv');
            expect(handleCloudflareKV).toHaveBeenCalledWith(expect.objectContaining({ method: 'PUT' }));
            expect(await response!.text()).toBe('handleCloudflareKV');
        });

        it('HEAD /api/demo dispatches to handleDemo (agnostic block serves HEAD)', async () => {
            const { response } = await dispatch('HEAD', '/api/demo');
            expect(handleDemo).toHaveBeenCalledWith(expect.objectContaining({ method: 'HEAD' }));
            expect(response).not.toBeNull();
        });

        it('POST /api/upload/file/x/y dispatches to the upload-file prefix handler', async () => {
            const { response } = await dispatch('POST', '/api/upload/file/x/y');
            expect(handleUploadFile).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST' }));
            expect(handleUpload).not.toHaveBeenCalled();
            expect(await response!.text()).toBe('handleUploadFile');
        });
    });

    describe('user profile', () => {
        it('GET /api/users/me dispatches to handleUserProfile', async () => {
            const { response } = await dispatch('GET', '/api/users/me');
            expect(handleUserProfile).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET' }));
            expect(await response!.text()).toBe('handleUserProfile');
        });

        it('PATCH /api/users/me dispatches to handleUserProfile', async () => {
            const { response } = await dispatch('PATCH', '/api/users/me');
            expect(handleUserProfile).toHaveBeenCalledWith(expect.objectContaining({ method: 'PATCH' }));
            expect(await response!.text()).toBe('handleUserProfile');
        });
    });

    describe('custom routes and fall-through', () => {
        it('unmatched GET /api/nope returns null after consulting custom routes', async () => {
            const { response, context } = await dispatch('GET', '/api/nope');
            expect(response).toBeNull();
            expect(handleCustomRoutes).toHaveBeenCalledTimes(1);
            expect(vi.mocked(handleCustomRoutes).mock.calls[0][0].request).toBe(context.request);
        });

        it('a Response from custom routes is returned (DELETE /api/medialibrary/m1/purge)', async () => {
            vi.mocked(handleCustomRoutes).mockResolvedValueOnce(new Response('handleCustomRoutes'));
            const { response } = await dispatch('DELETE', '/api/medialibrary/m1/purge');
            expect(handleCustomRoutes).toHaveBeenCalledWith(expect.objectContaining({ method: 'DELETE' }));
            expect(await response!.text()).toBe('handleCustomRoutes');
        });

        it('GET / returns null', async () => {
            const { response } = await dispatch('GET', '/');
            expect(response).toBeNull();
        });
    });

    describe('ExecutionContext propagation', () => {
        it('handleApiRequest forwards the ctx argument through to apiRouter.handle', async () => {
            const handleSpy = vi.spyOn(apiRouter, 'handle');
            const ctx = { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext;
            const request = new Request('http://localhost/api/health');
            const env = {} as any;

            await handleApiRequest(request, env, ctx);

            expect(handleSpy).toHaveBeenCalledWith(request, env, ctx);
            handleSpy.mockRestore();
        });

        it('handleApiRequest works without a ctx argument (optional, unlike env)', async () => {
            const request = new Request('http://localhost/api/health');
            const response = await handleApiRequest(request, {} as any);
            expect(response).not.toBeNull();
        });
    });
});
