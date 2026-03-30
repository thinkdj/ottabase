'use client';

import { ConfigPanel } from '../components/ConfigPanel';
import { SlotRenderer } from '../components/SlotRenderer';
import type { HomepageDataPayload } from '../lib/api';
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

/**
 * Build slot data overrides from the homepage API sections.
 * Maps section data to the SlotRenderer data contracts.
 * Only includes enabled sections.
 */
function buildSlotDataFromSections(sections: HomepageDataPayload['sections']) {
    const dataBySlot: Record<string, Record<string, unknown>> = {};
    for (const section of sections) {
        // Skip disabled sections
        if (section.enabled === false) continue;

        const slot = section.slot;
        if (slot === 'hero') {
            dataBySlot[slot] = {
                title: section.title ?? '',
                subtitle: section.subtitle ?? undefined,
                body: section.body ?? undefined,
                actions: section.actions.map((a) => ({
                    label: a.label,
                    href: a.href,
                    variant: a.variant ?? 'default',
                    icon: a.icon ?? undefined,
                    external: a.external,
                })),
            };
        } else if (slot === 'features') {
            dataBySlot[slot] = {
                title: section.title ?? undefined,
                features: section.features.map((f) => ({
                    title: f.title,
                    description: f.description,
                    icon: f.icon ?? undefined,
                    imageUrl: f.imageUrl ?? undefined,
                    href: f.href ?? undefined,
                })),
            };
        } else if (slot === 'cta') {
            dataBySlot[slot] = {
                title: section.title ?? '',
                description: section.subtitle ?? undefined,
                actions: section.actions.map((a) => ({
                    label: a.label,
                    href: a.href,
                    variant: a.variant ?? 'default',
                    icon: a.icon ?? undefined,
                    external: a.external,
                })),
            };
        } else if (slot === 'about') {
            dataBySlot[slot] = {
                title: section.title ?? undefined,
                description: section.subtitle ?? undefined,
                githubUrl: section.githubUrl ?? undefined,
            };
        } else if (slot === 'navbar') {
            dataBySlot[slot] = {
                title: section.title ?? 'Ottabase',
                githubUrl: section.githubUrl ?? undefined,
            };
        } else if (slot === 'footer') {
            dataBySlot[slot] = {
                siteName: section.title ?? 'Ottabase',
                tagline: section.subtitle ?? undefined,
            };
        }
    }
    return dataBySlot;
}

export interface LayoutShellProps {
    children: React.ReactNode;
    /** Exposed pages from the CMS, passed from server layout. */
    exposedPages?: { slug: string; title: string }[];
    /** Full homepage data payload from the API. */
    homepageData?: HomepageDataPayload;
}

export function LayoutShell({ children, exposedPages = [], homepageData }: LayoutShellProps) {
    const navbarLinks = mergeNavLinks(BASE_NAVBAR_LINKS, exposedPages);

    // Build slot data overrides from DB sections (if available)
    const dbSlotData = homepageData?.sections ? buildSlotDataFromSections(homepageData.sections) : {};

    const navbarData = {
        title: 'Ottabase',
        githubUrl: GITHUB_URL,
        // Override with DB data if present (title/githubUrl from navbar section)
        ...(dbSlotData.navbar ?? {}),
        // Always include merged links (DB navbar data should not override links)
        links: navbarLinks.length > 0 ? navbarLinks : undefined,
    };

    const footerData = dbSlotData.footer ? { ...FOOTER_DATA, ...dbSlotData.footer } : FOOTER_DATA;

    return (
        <>
            <SlotRenderer slot="navbar" data={navbarData} />
            <main className="flex-1">{children}</main>
            <SlotRenderer slot="footer" data={footerData} />
            <ConfigPanel />
        </>
    );
}
