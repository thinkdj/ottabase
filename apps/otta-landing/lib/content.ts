// Reads the landing site from the D1 database shared with otta-web, whose admin
// (/admin/content/landing) writes it. Read-only: this app never creates or edits content.

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { DEFAULT_APP_ID } from '@ottabase/config';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { LandingPage, LandingSite, type LandingPageData, type SiteSettings } from '@ottabase/ottalanding';
import { registerConnection } from '@ottabase/ottaorm';
import { headers } from 'next/headers';
import { cache } from 'react';

/** Point the models at the shared D1 and return the app whose landing site to show. */
export async function connect(): Promise<string> {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.OBCF_D1) throw new Error('OBCF_D1 is not bound. See apps/otta-landing/README.md → Database.');
    registerConnection('default', createD1Driver(env.OBCF_D1));
    return env.APP_ID || DEFAULT_APP_ID;
}

/** Before otta-web's first migration the tables don't exist yet; that is "not set up", not an error. */
function isMissingTable(error: unknown): boolean {
    for (let e: unknown = error; e; e = (e as { cause?: unknown }).cause) {
        if (/no such table/i.test(String((e as Error).message ?? e))) return true;
    }
    return false;
}

// ponytail: one D1 read per request (two with the page). Add a KV/edge cache keyed by appId,
// invalidated by /api/landing writes, if traffic ever makes that matter.

/** The site's settings, or null until otta-web has created the tables and starter content. */
export const getSite = cache(async (): Promise<SiteSettings | null> => {
    const appId = await connect();
    try {
        return (await LandingSite.findForApp(appId))?.getSettings() ?? null;
    } catch (error) {
        if (isMissingTable(error)) return null;
        throw error;
    }
});

/**
 * The page at `path`: the published one, or — with the page's preview token from otta-web's
 * "Share preview" link — its saved draft. A wrong token on a draft is a plain 404.
 */
export const getPage = cache(async (path: string, previewToken?: string): Promise<LandingPageData | null> => {
    const appId = await connect();
    // A stale token on a page that has since been published still shows the public page.
    const page =
        (previewToken ? await LandingPage.findForPreview(appId, path, previewToken) : null) ??
        (await LandingPage.findPublished(appId, path));
    return page?.toPage() ?? null;
});

/** `[[...slug]]` segments → `/`, `/about`, `/docs/intro`. Pages only use [a-z0-9-], so odd input just 404s. */
export function toPath(slug: string[] = []): string {
    return '/' + slug.join('/');
}

/** True only on the production deployment (wrangler `ENVIRONMENT`); preview, staging and local are not. */
export async function isProduction(): Promise<boolean> {
    const { env } = await getCloudflareContext({ async: true });
    return env.ENVIRONMENT === 'production';
}

/** Every published page's path and last change, for the sitemap. */
export async function getPublishedPaths(): Promise<{ path: string; updatedAt?: Date }[]> {
    const appId = await connect();
    try {
        return await LandingPage.publishedPaths(appId);
    } catch (error) {
        if (isMissingTable(error)) return [];
        throw error;
    }
}

/**
 * The site's public origin: its configured Public URL, else the address this request came in on
 * (crawlers need absolute URLs for the sitemap and social images, even before one is set).
 */
export async function siteOrigin(site: SiteSettings | null): Promise<string> {
    const configured = site?.siteUrl?.replace(/\/+$/, '');
    if (configured && URL.canParse(configured)) return configured;
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
    return `${h.get('x-forwarded-proto') ?? (local ? 'http' : 'https')}://${host}`;
}
