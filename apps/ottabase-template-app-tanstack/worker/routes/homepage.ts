// ============================================================
// Homepage public API route
// ============================================================
// GET /api/homepage/data — returns all homepage content:
//   sections (with features and actions), display settings, and exposed CMS pages.
//
// Pattern follows worker/routes/changelog.ts (public, read-only, no auth).
// ============================================================

import { Post } from '@ottabase/ottablog';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { HomepageAction } from '../../ottabase/models/HomepageAction';
import { HomepageDisplaySettings } from '../../ottabase/models/HomepageDisplaySettings';
import { HomepageFeature } from '../../ottabase/models/HomepageFeature';
import { HomepageSection } from '../../ottabase/models/HomepageSection';

export interface HomepageRouteContext {
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

/** Shape of a section in the public payload */
interface PublicSection {
    id: string;
    slot: string;
    title: string | null;
    subtitle: string | null;
    body: string | null;
    githubUrl: string | null;
    icon: string | null;
    enabled: boolean;
    cssClasses: string | null;
    metadata: Record<string, unknown> | null;
    sortOrder: number;
    features: Array<{
        title: string;
        description: string;
        icon: string | null;
        imageUrl: string | null;
        href: string | null;
    }>;
    actions: Array<{
        label: string;
        href: string;
        variant: string | null;
        icon: string | null;
        external: boolean;
    }>;
}

/** Shape of display settings in the public payload */
interface PublicDisplay {
    variantBySlot: Record<string, string> | null;
    themePreset: string | null;
    fallbackThemePresetId: string | null;
    customCss: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
}

/** Shape of the full public payload */
export interface HomepagePublicPayload {
    sections: PublicSection[];
    display: PublicDisplay;
    exposedPages: Array<{ slug: string; title: string }>;
}

/**
 * GET /api/homepage/data
 *
 * Returns the full homepage content payload for the Next.js consumer.
 * All content comes from D1 via OttaORM; the Next.js app has no D1 binding.
 */
export async function handleHomepageData(context: HomepageRouteContext): Promise<Response> {
    const { env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId = url.searchParams.get('appId') || null;

    // ── 1. Sections with child features + actions ──────────────────────
    let sections: PublicSection[] = [];
    try {
        const sectionWhere: Record<string, unknown> = {};
        if (appId) sectionWhere.appId = appId;

        const sectionRecords = await HomepageSection.where(sectionWhere, {
            orderBy: 'sortOrder',
            orderDirection: 'asc',
        });

        // Batch-load all features and actions for these sections
        const sectionIds = sectionRecords.map((s) => s.get('id') as string);

        let allFeatures: InstanceType<typeof HomepageFeature>[] = [];
        let allActions: InstanceType<typeof HomepageAction>[] = [];

        if (sectionIds.length > 0) {
            allFeatures = (await HomepageFeature.where(
                { sectionId: { $in: sectionIds } },
                { orderBy: 'sortOrder', orderDirection: 'asc' },
            )) as InstanceType<typeof HomepageFeature>[];

            allActions = (await HomepageAction.where(
                { sectionId: { $in: sectionIds } },
                { orderBy: 'sortOrder', orderDirection: 'asc' },
            )) as InstanceType<typeof HomepageAction>[];
        }

        // Group by sectionId
        const featuresBySectionId = new Map<
            string,
            Array<{
                title: string;
                description: string;
                icon: string | null;
                imageUrl: string | null;
                href: string | null;
            }>
        >();
        for (const f of allFeatures) {
            const sid = f.get('sectionId') as string;
            if (!featuresBySectionId.has(sid)) featuresBySectionId.set(sid, []);
            featuresBySectionId.get(sid)!.push({
                title: f.get('title') as string,
                description: f.get('description') as string,
                icon: (f.get('icon') as string) ?? null,
                imageUrl: (f.get('imageUrl') as string) ?? null,
                href: (f.get('href') as string) ?? null,
            });
        }

        const actionsBySectionId = new Map<
            string,
            Array<{ label: string; href: string; variant: string | null; icon: string | null; external: boolean }>
        >();
        for (const a of allActions) {
            const sid = a.get('sectionId') as string;
            if (!actionsBySectionId.has(sid)) actionsBySectionId.set(sid, []);
            actionsBySectionId.get(sid)!.push({
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
                githubUrl: (s.get('githubUrl') as string) ?? null,
                icon: (s.get('icon') as string) ?? null,
                enabled: (s.get('enabled') as boolean) ?? true,
                cssClasses: (s.get('cssClasses') as string) ?? null,
                metadata: (s.get('metadata') as Record<string, unknown>) ?? null,
                sortOrder: (s.get('sortOrder') as number) ?? 0,
                features: featuresBySectionId.get(id) ?? [],
                actions: actionsBySectionId.get(id) ?? [],
            };
        });
    } catch (err) {
        // Non-fatal: return empty sections
        console.error('[homepage/data] Failed to load sections:', err);
        sections = [];
    }

    // ── 2. Display settings ────────────────────────────────────────────
    let display: PublicDisplay = {
        variantBySlot: null,
        themePreset: null,
        fallbackThemePresetId: null,
        customCss: null,
        seoTitle: null,
        seoDescription: null,
    };
    try {
        const settings = await HomepageDisplaySettings.getOrCreateDefault(appId);
        display = {
            variantBySlot: (settings.get('variantBySlotJson') as Record<string, string>) ?? null,
            themePreset: (settings.get('themePreset') as string) ?? null,
            fallbackThemePresetId: (settings.get('fallbackThemePresetId') as string) ?? null,
            customCss: (settings.get('customCss') as string) ?? null,
            seoTitle: (settings.get('seoTitle') as string) ?? null,
            seoDescription: (settings.get('seoDescription') as string) ?? null,
        };
    } catch (err) {
        // Non-fatal: keep defaults
        console.error('[homepage/data] Failed to load display settings:', err);
    }

    // ── 3. Exposed CMS pages (for navbar links) ───────────────────────
    let exposedPages: Array<{ slug: string; title: string }> = [];
    try {
        const pageWhere: Record<string, unknown> = {
            contentType: 'page',
            status: 'published',
            exposeToHomepage: true,
        };
        if (appId) pageWhere.appId = appId;

        const pages = await Post.where(pageWhere, { orderBy: 'title', orderDirection: 'asc' });
        exposedPages = pages.map((p) => ({
            slug: p.get('slug') as string,
            title: p.get('title') as string,
        }));
    } catch (err) {
        // Non-fatal: return empty
        console.error('[homepage/data] Failed to load exposed pages:', err);
    }

    const payload: HomepagePublicPayload = { sections, display, exposedPages };
    return jsonResponse(payload);
}

// ── Default demo content for seeding ────────────────────────────────────────

const SEED_SECTIONS = [
    {
        slot: 'navbar',
        title: 'Ottabase',
        subtitle: null,
        body: null,
        githubUrl: 'https://github.com/thinkdj/ottabase',
        icon: 'Navigation',
        enabled: true,
        sortOrder: 0,
    },
    {
        slot: 'hero',
        title: 'Ottabase Homepage',
        subtitle: 'Ship a themed, edge-deployed homepage on Cloudflare Workers in minutes.',
        body: null,
        githubUrl: null,
        icon: 'Sparkles',
        enabled: true,
        sortOrder: 1,
    },
    {
        slot: 'features',
        title: 'Why Ottabase?',
        subtitle: null,
        body: null,
        githubUrl: null,
        icon: 'Grid3X3',
        enabled: true,
        sortOrder: 2,
    },
    {
        slot: 'cta',
        title: 'Ready to Ship?',
        subtitle: 'Clone the template, customize the brand, and deploy to Cloudflare Workers in minutes.',
        body: null,
        githubUrl: null,
        icon: 'Megaphone',
        enabled: true,
        sortOrder: 3,
    },
    {
        slot: 'about',
        title: 'About Ottabase',
        subtitle: 'A modern full-stack framework for edge-first applications.',
        body: null,
        githubUrl: 'https://github.com/thinkdj/ottabase',
        icon: 'FileText',
        enabled: true,
        sortOrder: 4,
    },
    {
        slot: 'footer',
        title: 'Ottabase',
        subtitle: 'Built with Next.js & Cloudflare Workers',
        body: null,
        githubUrl: null,
        icon: 'Rows3',
        enabled: true,
        sortOrder: 5,
    },
];

const SEED_FEATURES = [
    { title: 'Cloudflare Workers', description: 'Edge-deployed via OpenNext. No origin server needed.', icon: 'Globe' },
    { title: 'Brand Engine', description: '8 theme presets with live switching and dark mode.', icon: 'Palette' },
    { title: 'Next.js 16', description: 'App Router, RSC, and streaming out of the box.', icon: 'Zap' },
    {
        title: 'TypeScript',
        description: 'End-to-end type safety across client and server.',
        icon: 'Shield',
    },
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

const SEED_DISPLAY = {
    variantBySlotJson: {
        navbar: 'default',
        hero: 'centered',
        features: 'grid',
        cta: 'default',
        footer: 'default',
        about: 'default',
    },
    themePreset: 'neo',
};

/**
 * POST /api/homepage/seed
 *
 * Seeds default homepage content (sections, features, actions, display settings).
 * Skips seeding if any sections already exist. Idempotent.
 */
export async function handleHomepageSeed(context: HomepageRouteContext): Promise<Response> {
    const { env, url, request } = context;

    if (request.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appId = url.searchParams.get('appId') || null;

    try {
        // Check if sections already exist — skip if so
        const sectionWhere: Record<string, unknown> = {};
        if (appId) sectionWhere.appId = appId;
        const existing = await HomepageSection.where(sectionWhere);
        if (existing.length > 0) {
            return jsonResponse({
                success: true,
                seeded: false,
                message: `Homepage already has ${existing.length} section(s). Skipping seed.`,
            });
        }

        // Create sections
        const sectionMap: Record<string, string> = {}; // slot → id
        for (const s of SEED_SECTIONS) {
            const record = await HomepageSection.create({
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
                await HomepageFeature.create({
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
                await HomepageAction.create({
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
                await HomepageAction.create({
                    sectionId: ctaSectionId,
                    ...a,
                    ...(appId ? { appId } : {}),
                });
            }
        }

        // Create display settings
        await HomepageDisplaySettings.create({
            id: 'default',
            ...SEED_DISPLAY,
            fallbackThemePresetId: null,
            customCss: null,
            seoTitle: null,
            seoDescription: null,
            ...(appId ? { appId } : {}),
        });

        return jsonResponse({
            success: true,
            seeded: true,
            sections: Object.keys(sectionMap).length,
            features: SEED_FEATURES.length,
            actions: SEED_HERO_ACTIONS.length + SEED_CTA_ACTIONS.length,
        });
    } catch (err: any) {
        console.error('[homepage/seed] Failed:', err);
        return errorResponse(err.message ?? 'Seed failed', 500);
    }
}
