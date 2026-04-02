// ============================================================
// Pages public API routes
// ============================================================
// GET /api/pages/:slug — returns page content by slug
// GET /api/pages/nav — returns nav-enabled pages for menus
// POST /api/pages/seed — seeds default homepage content
//
// This is the flexible page system that replaces the hardcoded
// homepage routes. Pages can be "block" type (sections-based)
// or "content" type (links to ottablog Post for rich text).
// ============================================================

import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { Post } from '@ottabase/ottablog';
import { registerConnection } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { Page } from '../../ottabase/models/Page';
import { PageAction } from '../../ottabase/models/PageAction';
import { PageFeature } from '../../ottabase/models/PageFeature';
import { PageSection } from '../../ottabase/models/PageSection';

export interface PagesRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

function ensureD1(env: CloudflareEnv): Response | null {
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }
    return null;
}

// ── Type definitions for API responses ──────────────────────────────────────

export interface PageSectionPayload {
    id: string;
    slot: string;
    title: string | null;
    subtitle: string | null;
    body: string | null;
    variant: string | null;
    githubUrl: string | null;
    icon: string | null;
    imageUrl: string | null;
    enabled: boolean;
    cssClasses: string | null;
    metadata: Record<string, unknown> | null;
    sortOrder: number;
    features: Array<{
        id: string;
        title: string;
        description: string;
        icon: string | null;
        imageUrl: string | null;
        href: string | null;
    }>;
    actions: Array<{
        id: string;
        label: string;
        href: string;
        variant: string | null;
        icon: string | null;
        external: boolean;
    }>;
}

export interface PageDisplayPayload {
    variantBySlot: Record<string, string> | null;
    themePreset: string | null;
    fallbackThemePresetId: string | null;
    customCss: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    seoImage: string | null;
}

export interface PageDataPayload {
    page: {
        id: string;
        slug: string;
        title: string;
        type: 'block' | 'content';
        status: 'draft' | 'published' | 'archived';
        showInNav: boolean;
        navOrder: number;
        navLabel: string | null;
        icon: string | null;
    };
    sections: PageSectionPayload[];
    display: PageDisplayPayload;
    // For content-type pages, includes the linked Post content
    content: {
        title: string;
        body: string;
        excerpt: string | null;
    } | null;
}

export interface NavPagePayload {
    slug: string;
    title: string;
    navLabel: string | null;
    navOrder: number;
    icon: string | null;
}

/**
 * GET /api/pages/:slug
 *
 * Returns full page content by slug for the frontend consumer.
 * For "block" pages: includes sections, features, actions.
 * For "content" pages: includes linked ottablog Post content.
 */
export async function handlePageBySlug(context: PagesRouteContext, slug: string): Promise<Response> {
    const { env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId = url.searchParams.get('appId') || null;
    const preview = url.searchParams.get('preview') === 'true';

    try {
        // Find the page by slug
        // In preview mode, allow draft/archived pages; otherwise only published
        const pageWhere: Record<string, unknown> = { slug };
        if (!preview) {
            pageWhere.status = 'published';
        }
        if (appId) pageWhere.appId = appId;

        const pages = await Page.where(pageWhere);
        if (pages.length === 0) {
            return errorResponse(`Page not found: ${slug}`, 404, { code: 'PAGE_NOT_FOUND' });
        }

        const page = pages[0];
        const pageId = page.get('id') as string;
        const pageType = page.get('type') as 'block' | 'content';

        // Build page metadata
        const pageData = {
            id: pageId,
            slug: page.get('slug') as string,
            title: page.get('title') as string,
            type: pageType,
            status: page.get('status') as 'draft' | 'published' | 'archived',
            showInNav: (page.get('showInNav') as boolean) ?? false,
            navOrder: (page.get('navOrder') as number) ?? 0,
            navLabel: (page.get('navLabel') as string) ?? null,
            icon: (page.get('icon') as string) ?? null,
        };

        // Build display settings from the page itself
        const display: PageDisplayPayload = {
            variantBySlot: (page.get('variantBySlotJson') as Record<string, string>) ?? null,
            themePreset: (page.get('themePreset') as string) ?? null,
            fallbackThemePresetId: (page.get('fallbackThemePresetId') as string) ?? null,
            customCss: (page.get('customCss') as string) ?? null,
            seoTitle: (page.get('seoTitle') as string) ?? null,
            seoDescription: (page.get('seoDescription') as string) ?? null,
            seoImage: (page.get('seoImage') as string) ?? null,
        };

        // For content-type pages, load the linked Post
        let content: PageDataPayload['content'] = null;
        if (pageType === 'content') {
            const postId = page.get('postId') as string | null;
            if (postId) {
                try {
                    const post = await Post.find(postId);
                    if (post) {
                        content = {
                            title: post.get('title') as string,
                            body: post.get('body') as string,
                            excerpt: (post.get('excerpt') as string) ?? null,
                        };
                    }
                } catch (err) {
                    console.error(`[pages/:slug] Failed to load linked post ${postId}:`, err);
                }
            }
        }

        // For block-type pages, load sections with features/actions
        let sections: PageSectionPayload[] = [];
        if (pageType === 'block') {
            const sectionRecords = await PageSection.where(
                { pageId, enabled: true },
                { orderBy: 'sortOrder', orderDirection: 'asc' },
            );

            const sectionIds = sectionRecords.map((s) => s.get('id') as string);

            let allFeatures: InstanceType<typeof PageFeature>[] = [];
            let allActions: InstanceType<typeof PageAction>[] = [];

            if (sectionIds.length > 0) {
                allFeatures = (await PageFeature.where(
                    { sectionId: sectionIds },
                    { orderBy: 'sortOrder', orderDirection: 'asc' },
                )) as InstanceType<typeof PageFeature>[];

                allActions = (await PageAction.where(
                    { sectionId: sectionIds },
                    { orderBy: 'sortOrder', orderDirection: 'asc' },
                )) as InstanceType<typeof PageAction>[];
            }

            // Group by sectionId
            const featuresBySectionId = new Map<string, PageSectionPayload['features']>();
            for (const f of allFeatures) {
                const sid = f.get('sectionId') as string;
                if (!featuresBySectionId.has(sid)) featuresBySectionId.set(sid, []);
                featuresBySectionId.get(sid)!.push({
                    id: f.get('id') as string,
                    title: f.get('title') as string,
                    description: f.get('description') as string,
                    icon: (f.get('icon') as string) ?? null,
                    imageUrl: (f.get('imageUrl') as string) ?? null,
                    href: (f.get('href') as string) ?? null,
                });
            }

            const actionsBySectionId = new Map<string, PageSectionPayload['actions']>();
            for (const a of allActions) {
                const sid = a.get('sectionId') as string;
                if (!actionsBySectionId.has(sid)) actionsBySectionId.set(sid, []);
                actionsBySectionId.get(sid)!.push({
                    id: a.get('id') as string,
                    label: a.get('label') as string,
                    href: a.get('href') as string,
                    variant: (a.get('variant') as string) ?? null,
                    icon: (a.get('icon') as string) ?? null,
                    external: (a.get('external') as boolean) ?? false,
                });
            }

            sections = sectionRecords.map((s) => {
                const id = s.get('id') as string;
                return {
                    id,
                    slot: s.get('slot') as string,
                    title: (s.get('title') as string) ?? null,
                    subtitle: (s.get('subtitle') as string) ?? null,
                    body: (s.get('body') as string) ?? null,
                    variant: (s.get('variant') as string) ?? null,
                    githubUrl: (s.get('githubUrl') as string) ?? null,
                    icon: (s.get('icon') as string) ?? null,
                    imageUrl: (s.get('imageUrl') as string) ?? null,
                    enabled: (s.get('enabled') as boolean) ?? true,
                    cssClasses: (s.get('cssClasses') as string) ?? null,
                    metadata: (s.get('metadata') as Record<string, unknown>) ?? null,
                    sortOrder: (s.get('sortOrder') as number) ?? 0,
                    features: featuresBySectionId.get(id) ?? [],
                    actions: actionsBySectionId.get(id) ?? [],
                };
            });
        }

        const payload: PageDataPayload = {
            page: pageData,
            sections,
            display,
            content,
        };

        return jsonResponse(payload);
    } catch (err: unknown) {
        console.error('[pages/:slug] Failed:', err);
        return errorResponse((err as Error).message ?? 'Failed to load page', 500);
    }
}

/**
 * GET /api/pages/nav
 *
 * Returns pages marked for navigation (showInNav=true).
 * Used for building nav menus in the frontend.
 */
export async function handleNavPages(context: PagesRouteContext): Promise<Response> {
    const { env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId = url.searchParams.get('appId') || null;

    try {
        const where: Record<string, unknown> = { showInNav: true, status: 'published' };
        if (appId) where.appId = appId;

        const pages = await Page.where(where, { orderBy: 'navOrder', orderDirection: 'asc' });

        const navPages: NavPagePayload[] = pages.map((p) => ({
            slug: p.get('slug') as string,
            title: p.get('title') as string,
            navLabel: (p.get('navLabel') as string) ?? null,
            navOrder: (p.get('navOrder') as number) ?? 0,
            icon: (p.get('icon') as string) ?? null,
        }));

        return jsonResponse({ pages: navPages });
    } catch (err: unknown) {
        console.error('[pages/nav] Failed:', err);
        return errorResponse((err as Error).message ?? 'Failed to load nav pages', 500);
    }
}

// ── Default seed content for homepage ───────────────────────────────────────

const SEED_SECTIONS = [
    {
        slot: 'navbar',
        title: 'Ottabase',
        subtitle: null,
        body: null,
        variant: 'default',
        githubUrl: 'https://github.com/thinkdj/ottabase',
        icon: 'Navigation',
        imageUrl: null,
        enabled: true,
        sortOrder: 0,
    },
    {
        slot: 'hero',
        title: 'Ottabase Homepage',
        subtitle: 'Ship a themed, edge-deployed homepage on Cloudflare Workers in minutes.',
        body: null,
        variant: 'centered',
        githubUrl: null,
        icon: 'Sparkles',
        imageUrl: null,
        enabled: true,
        sortOrder: 1,
    },
    {
        slot: 'features',
        title: 'Why Ottabase?',
        subtitle: null,
        body: null,
        variant: 'grid',
        githubUrl: null,
        icon: 'Grid3X3',
        imageUrl: null,
        enabled: true,
        sortOrder: 2,
    },
    {
        slot: 'cta',
        title: 'Ready to Ship?',
        subtitle: 'Clone the template, customize the brand, and deploy to Cloudflare Workers in minutes.',
        body: null,
        variant: 'default',
        githubUrl: null,
        icon: 'Megaphone',
        imageUrl: null,
        enabled: true,
        sortOrder: 3,
    },
    {
        slot: 'about',
        title: 'About Ottabase',
        subtitle: 'A modern full-stack framework for edge-first applications.',
        body: null,
        variant: 'default',
        githubUrl: 'https://github.com/thinkdj/ottabase',
        icon: 'FileText',
        imageUrl: null,
        enabled: true,
        sortOrder: 4,
    },
    {
        slot: 'footer',
        title: 'Ottabase',
        subtitle: 'Built with Next.js & Cloudflare Workers',
        body: null,
        variant: 'default',
        githubUrl: null,
        icon: 'Rows3',
        imageUrl: null,
        enabled: true,
        sortOrder: 5,
    },
];

const SEED_FEATURES = [
    { title: 'Cloudflare Workers', description: 'Edge-deployed via OpenNext. No origin server needed.', icon: 'Globe' },
    { title: 'Brand Engine', description: '8 theme presets with live switching and dark mode.', icon: 'Palette' },
    { title: 'Next.js 16', description: 'App Router, RSC, and streaming out of the box.', icon: 'Zap' },
    { title: 'TypeScript', description: 'End-to-end type safety across client and server.', icon: 'Shield' },
    {
        title: 'OttaORM',
        description: 'Fat model system with auto-migrations, relationships, and CRUD.',
        icon: 'Database',
    },
    {
        title: 'Admin Dashboard',
        description: 'Full admin UI for content, users, and settings management.',
        icon: 'LayoutDashboard',
    },
];

const SEED_HERO_ACTIONS = [
    { label: 'About', href: '/about', variant: 'default', icon: null, external: false, sortOrder: 0 },
    { label: 'Theme Demo', href: '/theme-demo', variant: 'secondary', icon: 'Palette', external: false, sortOrder: 1 },
    {
        label: 'GitHub',
        href: 'https://github.com/thinkdj/ottabase',
        variant: 'outline',
        icon: 'Github',
        external: true,
        sortOrder: 2,
    },
];

const SEED_CTA_ACTIONS = [
    {
        label: 'Get Started',
        href: 'https://github.com/thinkdj/ottabase',
        variant: 'default',
        icon: 'Rocket',
        external: true,
        sortOrder: 0,
    },
    { label: 'Explore Themes', href: '/theme-demo', variant: 'outline', icon: null, external: false, sortOrder: 1 },
];

/**
 * POST /api/pages/seed
 *
 * Seeds default homepage content. Creates a "homepage" page with slug "homepage"
 * and all the standard sections, features, and actions.
 * Skips seeding if the homepage already exists. Idempotent.
 */
export async function handlePagesSeed(context: PagesRouteContext): Promise<Response> {
    const { env, url, request } = context;

    if (request.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId = url.searchParams.get('appId') || null;

    try {
        // Check if homepage already exists
        const pageWhere: Record<string, unknown> = { slug: 'homepage' };
        if (appId) pageWhere.appId = appId;

        const existing = await Page.where(pageWhere);
        if (existing.length > 0) {
            return jsonResponse({
                success: true,
                seeded: false,
                message: 'Homepage page already exists. Skipping seed.',
            });
        }

        // Create the homepage page
        const homepage = await Page.create({
            slug: 'homepage',
            title: 'Homepage',
            type: 'block',
            status: 'published',
            themePreset: 'neo',
            variantBySlotJson: {
                navbar: 'default',
                hero: 'centered',
                features: 'grid',
                cta: 'default',
                footer: 'default',
                about: 'default',
            },
            showInNav: false, // Homepage itself not shown in nav
            navOrder: 0,
            ...(appId ? { appId } : {}),
        });

        const pageId = homepage.get('id') as string;

        // Create sections
        const sectionMap: Record<string, string> = {}; // slot → id
        for (const s of SEED_SECTIONS) {
            const record = await PageSection.create({
                pageId,
                ...s,
                cssClasses: null,
                metadata: null,
                ...(appId ? { appId } : {}),
            });
            sectionMap[s.slot] = record.get('id') as string;
        }

        // Create features for the "features" section
        const featuresSectionId = sectionMap.features;
        if (featuresSectionId) {
            for (let i = 0; i < SEED_FEATURES.length; i++) {
                await PageFeature.create({
                    sectionId: featuresSectionId,
                    title: SEED_FEATURES[i].title,
                    description: SEED_FEATURES[i].description,
                    icon: SEED_FEATURES[i].icon,
                    imageUrl: null,
                    href: null,
                    sortOrder: i,
                    ...(appId ? { appId } : {}),
                });
            }
        }

        // Create hero actions
        const heroSectionId = sectionMap.hero;
        if (heroSectionId) {
            for (const a of SEED_HERO_ACTIONS) {
                await PageAction.create({
                    sectionId: heroSectionId,
                    ...a,
                    ...(appId ? { appId } : {}),
                });
            }
        }

        // Create CTA actions
        const ctaSectionId = sectionMap.cta;
        if (ctaSectionId) {
            for (const a of SEED_CTA_ACTIONS) {
                await PageAction.create({
                    sectionId: ctaSectionId,
                    ...a,
                    ...(appId ? { appId } : {}),
                });
            }
        }

        return jsonResponse({
            success: true,
            seeded: true,
            pageId,
            sections: Object.keys(sectionMap).length,
            features: SEED_FEATURES.length,
            actions: SEED_HERO_ACTIONS.length + SEED_CTA_ACTIONS.length,
        });
    } catch (err: unknown) {
        console.error('[pages/seed] Failed:', err);
        return errorResponse((err as Error).message ?? 'Seed failed', 500);
    }
}

/**
 * GET /api/pages
 *
 * Returns a list of all pages (for admin purposes).
 * Note: This is admin-accessible via generic OttaORM CRUD, but we provide
 * a public-friendly version here that only shows published pages.
 */
export async function handlePagesList(context: PagesRouteContext): Promise<Response> {
    const { env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId = url.searchParams.get('appId') || null;
    const includeAll = url.searchParams.get('all') === 'true'; // Admin flag

    try {
        const where: Record<string, unknown> = {};
        if (appId) where.appId = appId;
        if (!includeAll) where.status = 'published';

        const pages = await Page.where(where, { orderBy: 'createdAt', orderDirection: 'desc' });

        const list = pages.map((p) => ({
            id: p.get('id') as string,
            slug: p.get('slug') as string,
            title: p.get('title') as string,
            type: p.get('type') as string,
            status: p.get('status') as string,
            showInNav: (p.get('showInNav') as boolean) ?? false,
            navOrder: (p.get('navOrder') as number) ?? 0,
            createdAt: p.get('createdAt') as string,
            updatedAt: p.get('updatedAt') as string,
        }));

        return jsonResponse({ pages: list });
    } catch (err: unknown) {
        console.error('[pages] Failed:', err);
        return errorResponse((err as Error).message ?? 'Failed to load pages', 500);
    }
}
