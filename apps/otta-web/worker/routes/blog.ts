// ============================================================
// Blog routes — thin adapter over @ottabase/ottablog/router
// ============================================================
//
// The handler bodies and the canonical route table live in the package
// (packages/ottablog/src/router/). This module only supplies the app-specific
// seams (D1 wiring, admin guard, cron auth, password verify, kitchensink
// fixture) and re-exports the built handlers under their historical names so
// router.ts registrations and the dispatch tests keep working unchanged.
// ============================================================

import { verifyPassword } from '@ottabase/auth/backend';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { createBlogHandlers } from '@ottabase/ottablog/router';
import { registerConnection } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import kitchensinkContentTemplate from '../fixtures/kitchensink-content.json';
import { requireAdminAccess } from '../lib/admin-guard';
import { checkCronAuth } from '../lib/utils';

export interface BlogRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

const handlers = createBlogHandlers<CloudflareEnv>({
    connect: (env) => {
        if (!env.OBCF_D1) {
            return errorResponse('D1 database binding not configured', 500, {
                code: 'CONFIG_ERROR',
            });
        }
        registerConnection('default', createD1Driver(env.OBCF_D1));
        return null;
    },
    defaultAppId: (env) => getOttabaseConfig(env).appId,
    requireAdmin: (ctx) => requireAdminAccess(ctx as any, { scope: 'system' }),
    checkCronAuth,
    verifyPassword: (password, hash) => verifyPassword(password, hash),
    kitchensinkContent: kitchensinkContentTemplate as Record<string, unknown>,
});

export const {
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
    handleBlogKitchensink,
} = handlers;
