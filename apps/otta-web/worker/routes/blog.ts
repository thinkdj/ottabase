// ============================================================
// Blog routes — thin adapter over @ottabase/ottablog/router
// ============================================================
//
// The handler bodies and the canonical route table live in the package
// (packages/ottablog/src/router/). This module only supplies the app-specific
// seams (D1 wiring, blog scopes, guards, cron auth, password verify, demo seed
// fixtures) and exports the built handlers.
// ============================================================

import { verifyPassword } from '@ottabase/auth/backend';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { createBlogHandlers } from '@ottabase/ottablog/router';
import { registerConnection } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { demoBlogPosts } from '../fixtures/demo-blog-content';
import { demoWhatsNewPosts } from '../fixtures/demo-whats-new';
import { requireAdminAccess } from '../lib/admin-guard';
import { bumpProfileVersion } from '../lib/auth-utils';
import {
    canManagePostInOrg,
    canReadLockedPosts,
    requireContentPermission,
    requireStudioAdminForScope,
    resolveEditorialBlog,
} from '../lib/content-guard';
import { checkCronAuth } from '../lib/utils';

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
    // Public reads: the site blog at /blog, and each organization's blog at /blogs/{slug}.
    orgBlogs: (env) => getOttabaseConfig(env).features.ottablog.orgBlogs,
    // Editorial requests work on the caller's active scope: a workspace's blog, or the site blog
    // in Platform scope. Every Studio and object guard below re-checks it.
    resolveEditorialScope: resolveEditorialBlog,
    defaultAppId: (env) => getOttabaseConfig(env).appId,
    requireAdmin: (ctx) => requireAdminAccess(ctx as any, { scope: 'system' }),
    // Studio operations are guarded against their blog: the site blog stays platform-admin-only;
    // each organization's admin runs their own blog's Studio (grants evaluated in that org).
    requireScopedStudioAdmin: (ctx, target) => requireStudioAdminForScope(ctx, target),
    // Editorial gate for preview-token minting: any caller who may edit posts
    // (author/editor/org admin/platform owner), not only platform admins.
    requireContentEditor: (ctx) => requireContentPermission(ctx, 'posts:update'),
    requireContentCreator: (ctx) => requireContentPermission(ctx, 'posts:create'),
    // Object-level check for minting previews of posts the caller does not own:
    // manage-grade grants evaluated in the POST's org (never a request hint).
    canManagePost: (ctx, post) => canManagePostInOrg(ctx, post),
    // Locked (invite-only) categories: posts:read_locked in the blog's scope (system grants for
    // the site blog). A reader grant refreshes that user's live session snapshot.
    canReadLocked: (ctx, target) => canReadLockedPosts(ctx, target),
    onReaderAccessChanged: (env, userId) => bumpProfileVersion(env, userId),
    // Dedicated BLOG_PREVIEW_SECRET wins; AUTH_SECRET is the pragmatic default
    // so preview links work out of the box on any configured deployment.
    previewTokenSecret: (env) => {
        const secrets = env as { BLOG_PREVIEW_SECRET?: string; AUTH_SECRET?: string };
        return secrets.BLOG_PREVIEW_SECRET || secrets.AUTH_SECRET || null;
    },
    checkCronAuth,
    verifyPassword: (password, hash) => verifyPassword(password, hash),
    // Demo seeding (into the site blog) is platform-owner-only via the system-scoped requireAdmin.
    demoPosts: [...demoBlogPosts, ...demoWhatsNewPosts],
});

/** The built handlers; the canonical route table (ottabase/packages/ottablog.ts) dispatches to them. */
export const blogHandlers = handlers;
