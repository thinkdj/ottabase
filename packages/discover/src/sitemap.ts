// A sitemap as XML, for hosts without a framework that writes one (a Worker). Next.js apps
// return the same entries from `app/sitemap.ts` and let Next render them.

export interface SitemapEntry {
    /** Absolute URL. */
    url: string;
    lastModified?: Date | string;
    changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    /** 0 to 1. */
    priority?: number;
}

const escapeXml = (s: string): string =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

const isoDate = (v: Date | string): string => {
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
};

export function sitemapXml(entries: SitemapEntry[]): string {
    const items = entries
        .filter((e) => /^https?:\/\//i.test(e.url))
        .map((e) => {
            const parts = [`<loc>${escapeXml(e.url)}</loc>`];
            const mod = e.lastModified ? isoDate(e.lastModified) : '';
            if (mod) parts.push(`<lastmod>${mod}</lastmod>`);
            if (e.changeFrequency) parts.push(`<changefreq>${e.changeFrequency}</changefreq>`);
            if (typeof e.priority === 'number' && e.priority >= 0 && e.priority <= 1)
                parts.push(`<priority>${e.priority.toFixed(1)}</priority>`);
            return `  <url>${parts.join('')}</url>`;
        });
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...items,
        '</urlset>',
        '',
    ].join('\n');
}
