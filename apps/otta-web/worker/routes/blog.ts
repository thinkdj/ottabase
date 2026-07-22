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

/**
 * Org-mode tenant resolution for public blog requests, in priority order:
 * explicit `?org=` query param, `x-org-id` header, then the request subdomain
 * (first host label) resolved to an organization by slug. Returns null when
 * nothing resolves — the blog then serves platform-owned content.
 */
async function resolveBlogOrganizationId(ctx: {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}): Promise<string | null> {
    const clean = (value: string | null): string | null => {
        const trimmed = value?.trim();
        return trimmed && trimmed !== 'null' && trimmed !== 'undefined' ? trimmed : null;
    };

    const fromQuery = clean(ctx.url.searchParams.get('org'));
    if (fromQuery) return fromQuery;

    const fromHeader = clean(ctx.request.headers.get('x-org-id'));
    if (fromHeader) return fromHeader;

    // Subdomain lookup: acme.example.com → Organization with slug 'acme'.
    // Skip bare/apex hosts, localhost, and IPs (no subdomain label to read).
    const host = ctx.url.hostname;
    const labels = host.split('.');
    if (labels.length >= 3 && labels[0] && labels[0] !== 'www') {
        try {
            const { Organization } = await import('@ottabase/ottaorm/models');
            // findBySlug returns a plain row (OrganizationType), not a model instance.
            const org = await Organization.findBySlug(labels[0]);
            if (org?.id) return org.id;
        } catch {
            // Unresolvable subdomain → platform content; never fail the request on lookup errors.
        }
    }

    return null;
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
    // Resolved per-request via env so the OTTABLOG_MODE env override applies.
    mode: (env) => getOttabaseConfig(env).features.ottablog.mode,
    resolveOrganizationId: resolveBlogOrganizationId,
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
