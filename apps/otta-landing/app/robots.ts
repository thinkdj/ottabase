import { discoverRobots } from '@ottabase/discover/next';
import type { MetadataRoute } from 'next';
import { getSite, isProduction, siteOrigin } from '../lib/content';

export const dynamic = 'force-dynamic';

/**
 * /robots.txt: production invites crawlers, naming the AI search crawlers one by one (a crawler control
 * that splits search from training keeps them allowed that way), keeps them out of the API, and points
 * them at the sitemap. Every other deployment (preview, staging, local) asks them to stay away, like
 * its noindex meta tag.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
    if (!(await isProduction())) return discoverRobots({ closed: true });
    const site = await getSite();
    // Uploaded logos and social images are served from /api/upload/file/; crawlers must still fetch those.
    return discoverRobots({
        sitemap: `${await siteOrigin(site)}/sitemap.xml`,
        disallow: ['/api/'],
        allow: ['/api/upload/file/'],
    });
}
