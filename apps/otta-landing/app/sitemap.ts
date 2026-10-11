import type { MetadataRoute } from 'next';
import { getPublishedPaths, getSite, siteOrigin } from '../lib/content';

// Pages are published from otta-web's admin at any time, so the sitemap is built per request.
export const dynamic = 'force-dynamic';

/** /sitemap.xml — every published page, with when it last changed. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const site = await getSite();
    if (!site) return [];
    const origin = await siteOrigin(site);
    return (await getPublishedPaths()).map(({ path, updatedAt }) => ({
        url: origin + path,
        ...(updatedAt ? { lastModified: updatedAt } : {}),
    }));
}
