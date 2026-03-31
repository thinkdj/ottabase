import type { NavbarData } from '../components/variants/navbar/types';
import type { HomepagePayload } from './get-homepage-data';

/**
 * Appends links for Ottablog marketing pages (`/page/:slug`) after configured navbar links.
 * Skips duplicates by href.
 */
export function mergeExposedPagesIntoNavbar(
    navbar: NavbarData,
    exposedPages: HomepagePayload['exposedPages'],
): NavbarData {
    if (!exposedPages?.length) return navbar;
    const links = [...(navbar.links ?? [])];
    const seen = new Set(links.map((l) => l.href));
    for (const p of exposedPages) {
        if (!p.slug?.trim() || !p.title?.trim()) continue;
        const href = `/page/${p.slug.trim()}`;
        if (seen.has(href)) continue;
        seen.add(href);
        links.push({ href, label: p.title.trim() });
    }
    return { ...navbar, links };
}
