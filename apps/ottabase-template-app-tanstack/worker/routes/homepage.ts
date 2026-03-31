import { buildHomepagePublicPayloadV1, type HomepageDbSectionInput } from '@ottabase/homepage-contract';
import { Post } from '@ottabase/ottablog';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { HomepageAction } from '../../ottabase/models/HomepageAction';
import { HomepageDisplaySettings } from '../../ottabase/models/HomepageDisplaySettings';
import type { HomepageVariantBySlotJson } from '../../ottabase/models/HomepageDisplaySettings.schema';
import { HomepageFeature } from '../../ottabase/models/HomepageFeature';
import { HomepageSection } from '../../ottabase/models/HomepageSection';
import { checkMigrationAuth } from '../lib/db-utils';

const GITHUB_URL = 'https://github.com/thinkdj/ottabase';

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

/**
 * GET /api/homepage/data — public versioned payload for Next.js (Zod-validated v1).
 */
export async function handleHomepageData(context: HomepageRouteContext): Promise<Response> {
    const { env } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const sections = await HomepageSection.getAllActive();
    const enriched: HomepageDbSectionInput[] = await Promise.all(
        sections.map(async (section) => {
            const sid = section.get('id') as string;
            const [features, actions] = await Promise.all([
                HomepageFeature.forSection(sid),
                HomepageAction.forSection(sid),
            ]);

            const sj = section.toJson() as Record<string, unknown>;

            return {
                id: String(sj.id),
                slot: String(sj.slot),
                title: (sj.title as string | null | undefined) ?? null,
                subtitle: (sj.subtitle as string | null | undefined) ?? null,
                description: (sj.description as string | null | undefined) ?? null,
                body: (sj.body as string | null | undefined) ?? null,
                contentJson: sj.contentJson ?? null,
                isActive: sj.isActive as boolean | null | undefined,
                features: features.map((f) => {
                    const j = f.toJson() as Record<string, unknown>;
                    return {
                        id: String(j.id),
                        title: String(j.title),
                        description: String(j.description),
                        icon: (j.icon as string | null | undefined) ?? null,
                        sortOrder: (j.sortOrder as number | null | undefined) ?? null,
                    };
                }),
                actions: actions.map((a) => {
                    const j = a.toJson() as Record<string, unknown>;
                    return {
                        id: String(j.id),
                        label: String(j.label),
                        href: String(j.href),
                        variant: (j.variant as string | null | undefined) ?? null,
                        icon: (j.icon as string | null | undefined) ?? null,
                        isExternal: j.isExternal as boolean | null | undefined,
                        sortOrder: (j.sortOrder as number | null | undefined) ?? null,
                    };
                }),
            };
        }),
    );

    const displayRow = await HomepageDisplaySettings.getDefault();
    const displayInput = displayRow
        ? {
              themePresetId: String(displayRow.get('themePresetId') ?? 'crisp'),
              variantBySlotJson: (displayRow.get('variantBySlotJson') as Record<string, string>) ?? {},
          }
        : null;

    let exposedPages: { slug: string; title: string }[] = [];
    try {
        const pageRows = await Post.where(
            {
                contentType: 'page',
                status: 'published',
                exposeToHomepage: true,
            },
            { orderBy: 'title', orderDirection: 'asc' },
        );
        exposedPages = pageRows
            .map((p) => ({
                slug: String(p.get('slug') ?? ''),
                title: String(p.get('title') ?? ''),
            }))
            .filter((x) => x.slug.length > 0 && x.title.length > 0);
    } catch (e) {
        console.error('[homepage/data] exposedPages query failed:', e);
    }

    const payload = buildHomepagePublicPayloadV1(enriched, displayInput, 'crisp', { exposedPages });

    return jsonResponse(payload);
}

const DEFAULT_VARIANTS: HomepageVariantBySlotJson = {
    navbar: 'default',
    hero: 'centered',
    features: 'grid',
    cta: 'default',
    footer: 'default',
    about: 'default',
};

/**
 * POST /api/homepage/seed — idempotent seed (migration secret in prod).
 */
export async function handleHomepageSeed(context: HomepageRouteContext): Promise<Response> {
    const { env, request } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;

    const isAuthorized = await checkMigrationAuth(request, env);
    if (!isAuthorized) {
        return errorResponse('Unauthorized — MIGRATION_SECRET required in production', 401, {
            code: 'UNAUTHORIZED',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const existing = await HomepageDisplaySettings.getDefault();
    if (existing) {
        return jsonResponse({ ok: true, message: 'Homepage already seeded', seeded: false });
    }

    const sectionsSpec: Array<{
        id: string;
        slot: string;
        sortOrder: number;
        title?: string;
        subtitle?: string;
        description?: string;
        body?: string;
        contentJson?: Record<string, unknown> | null;
    }> = [
        {
            id: 'homepage-section-navbar',
            slot: 'navbar',
            sortOrder: 0,
            contentJson: {
                title: 'Ottabase',
                githubUrl: GITHUB_URL,
                links: [
                    { href: '/about', label: 'About' },
                    { href: '/theme-demo', label: 'Themes' },
                    { href: '/homepage-config', label: 'Config' },
                    { href: GITHUB_URL, label: 'GitHub', external: true },
                ],
            },
        },
        {
            id: 'homepage-section-hero',
            slot: 'hero',
            sortOrder: 1,
            title: 'Ottabase Homepage on Next.js',
            subtitle: 'Ship a themed, edge-deployed homepage on Cloudflare Workers in minutes.',
        },
        {
            id: 'homepage-section-features',
            slot: 'features',
            sortOrder: 2,
            title: 'Features & Capabilities',
        },
        {
            id: 'homepage-section-cta',
            slot: 'cta',
            sortOrder: 3,
            title: 'Ready to Ship?',
            description: 'Clone the template, customize the brand, and deploy to Cloudflare Workers in minutes.',
        },
        {
            id: 'homepage-section-footer',
            slot: 'footer',
            sortOrder: 4,
            contentJson: {
                siteName: 'Ottabase',
                tagline: 'Built with Next.js & Cloudflare Workers',
                links: [
                    { href: '/about', label: 'About' },
                    { href: '/theme-demo', label: 'Themes' },
                    { href: '/homepage-config', label: 'Config' },
                    { href: GITHUB_URL, label: 'GitHub', external: true },
                ],
            },
        },
        {
            id: 'homepage-section-about',
            slot: 'about',
            sortOrder: 5,
            title: 'About',
            body: 'A modern, production-ready Next.js homepage template for Cloudflare Workers.',
        },
    ];

    for (const s of sectionsSpec) {
        await HomepageSection.create({
            id: s.id,
            slot: s.slot,
            title: s.title ?? null,
            subtitle: s.subtitle ?? null,
            description: s.description ?? null,
            body: s.body ?? null,
            contentJson: s.contentJson ?? null,
            isActive: true,
            sortOrder: s.sortOrder,
        });
    }

    await HomepageFeature.create({
        id: 'homepage-feature-0',
        sectionId: 'homepage-section-features',
        title: 'Cloudflare Workers',
        description: 'Edge-deployed via OpenNext. No origin server needed.',
        sortOrder: 0,
    });
    await HomepageFeature.create({
        id: 'homepage-feature-1',
        sectionId: 'homepage-section-features',
        title: 'Brand Engine',
        description: '8 theme presets with live switching and dark mode.',
        sortOrder: 1,
    });
    await HomepageFeature.create({
        id: 'homepage-feature-2',
        sectionId: 'homepage-section-features',
        title: 'Next.js 16',
        description: 'App Router, RSC, and streaming out of the box.',
        sortOrder: 2,
    });
    await HomepageFeature.create({
        id: 'homepage-feature-3',
        sectionId: 'homepage-section-features',
        title: 'TypeScript',
        description: 'End-to-end type safety across client and server.',
        sortOrder: 3,
    });

    await HomepageAction.create({
        id: 'homepage-action-hero-0',
        sectionId: 'homepage-section-hero',
        label: 'About',
        href: '/about',
        variant: 'default',
        sortOrder: 0,
    });
    await HomepageAction.create({
        id: 'homepage-action-hero-1',
        sectionId: 'homepage-section-hero',
        label: 'Theme Demo',
        href: '/theme-demo',
        variant: 'secondary',
        icon: 'palette',
        sortOrder: 1,
    });
    await HomepageAction.create({
        id: 'homepage-action-hero-2',
        sectionId: 'homepage-section-hero',
        label: 'GitHub',
        href: GITHUB_URL,
        variant: 'outline',
        icon: 'github',
        isExternal: true,
        sortOrder: 2,
    });

    await HomepageAction.create({
        id: 'homepage-action-cta-0',
        sectionId: 'homepage-section-cta',
        label: 'Get Started',
        href: GITHUB_URL,
        variant: 'default',
        icon: 'rocket',
        isExternal: true,
        sortOrder: 0,
    });
    await HomepageAction.create({
        id: 'homepage-action-cta-1',
        sectionId: 'homepage-section-cta',
        label: 'Explore Themes',
        href: '/theme-demo',
        variant: 'outline',
        sortOrder: 1,
    });

    await HomepageDisplaySettings.create({
        id: 'default',
        variantBySlotJson: DEFAULT_VARIANTS,
        themePresetId: 'crisp',
    });

    return jsonResponse({ ok: true, message: 'Homepage seeded', seeded: true });
}
