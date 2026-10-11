import type { MetadataRoute } from 'next';
import { getSite, isProduction, siteOrigin } from '../lib/content';

export const dynamic = 'force-dynamic';

/**
 * /robots.txt — production invites crawlers and points them at the sitemap. Every other
 * deployment (preview, staging, local) asks them to stay away, like its noindex meta tag.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
    if (!(await isProduction())) return { rules: { userAgent: '*', disallow: '/' } };
    const site = await getSite();
    return { rules: { userAgent: '*', allow: '/' }, sitemap: `${await siteOrigin(site)}/sitemap.xml` };
}
