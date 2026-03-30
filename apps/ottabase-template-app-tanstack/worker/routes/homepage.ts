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
    sortOrder: number;
    features: Array<{ title: string; description: string }>;
    actions: Array<{
        label: string;
        href: string;
        variant: string | null;
        external: boolean;
    }>;
}

/** Shape of display settings in the public payload */
interface PublicDisplay {
    variantBySlot: Record<string, string> | null;
    themePreset: string | null;
    fallbackThemePresetId: string | null;
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
        const featuresBySectionId = new Map<string, Array<{ title: string; description: string }>>();
        for (const f of allFeatures) {
            const sid = f.get('sectionId') as string;
            if (!featuresBySectionId.has(sid)) featuresBySectionId.set(sid, []);
            featuresBySectionId.get(sid)!.push({
                title: f.get('title') as string,
                description: f.get('description') as string,
            });
        }

        const actionsBySectionId = new Map<
            string,
            Array<{ label: string; href: string; variant: string | null; external: boolean }>
        >();
        for (const a of allActions) {
            const sid = a.get('sectionId') as string;
            if (!actionsBySectionId.has(sid)) actionsBySectionId.set(sid, []);
            actionsBySectionId.get(sid)!.push({
                label: a.get('label') as string,
                href: a.get('href') as string,
                variant: (a.get('variant') as string) ?? null,
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
    let display: PublicDisplay = { variantBySlot: null, themePreset: null, fallbackThemePresetId: null };
    try {
        const settings = await HomepageDisplaySettings.getOrCreateDefault(appId);
        display = {
            variantBySlot: (settings.get('variantBySlotJson') as Record<string, string>) ?? null,
            themePreset: (settings.get('themePreset') as string) ?? null,
            fallbackThemePresetId: (settings.get('fallbackThemePresetId') as string) ?? null,
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
