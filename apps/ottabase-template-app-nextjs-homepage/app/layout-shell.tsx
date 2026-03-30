'use client';

import { ConfigPanel } from '../components/ConfigPanel';
import { SlotRenderer } from '../components/SlotRenderer';
import type { NavLink } from '../components/variants/navbar/types';

const GITHUB_URL = 'https://github.com/thinkdj/ottabase';

const BASE_NAVBAR_LINKS: NavLink[] = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/theme-demo', label: 'Themes' },
];

const FOOTER_DATA = {
    siteName: 'Ottabase',
    tagline: 'Built with Next.js & Cloudflare Workers',
    links: [
        { href: '/about', label: 'About' },
        { href: '/theme-demo', label: 'Themes' },
        { href: '/homepage-config', label: 'Config' },
        { href: GITHUB_URL, label: 'GitHub', external: true },
    ],
};

/** Merge exposed CMS pages into navbar links, deduplicating by href. */
export function mergeNavLinks(baseLinks: NavLink[], exposedPages: { slug: string; title: string }[]): NavLink[] {
    const pageLinks: NavLink[] = exposedPages.map((p) => ({
        href: `/page/${p.slug}`,
        label: p.title,
    }));
    const seen = new Set(baseLinks.map((l) => l.href));
    const merged = [...baseLinks];
    for (const link of pageLinks) {
        if (!seen.has(link.href)) {
            seen.add(link.href);
            merged.push(link);
        }
    }
    return merged;
}

export interface LayoutShellProps {
    children: React.ReactNode;
    /** Exposed pages from the CMS, passed from server layout. */
    exposedPages?: { slug: string; title: string }[];
}

export function LayoutShell({ children, exposedPages = [] }: LayoutShellProps) {
    const navbarLinks = mergeNavLinks(BASE_NAVBAR_LINKS, exposedPages);
    const navbarData = {
        title: 'Ottabase',
        githubUrl: GITHUB_URL,
        links: navbarLinks.length > 0 ? navbarLinks : undefined,
    };

    return (
        <>
            <SlotRenderer slot="navbar" data={navbarData} />
            <main className="flex-1">{children}</main>
            <SlotRenderer slot="footer" data={FOOTER_DATA} />
            <ConfigPanel />
        </>
    );
}
