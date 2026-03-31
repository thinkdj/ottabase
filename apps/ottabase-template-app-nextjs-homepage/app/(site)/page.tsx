'use client';

import { Github, Palette, Rocket } from 'lucide-react';
import { SlotRenderer } from '../../components/SlotRenderer';
import type { HomepageDataPayload } from '../../lib/api';
import { useHomepageData } from '../../lib/homepage-data-context';

/**
 * Fallback homepage data — used when the API is unavailable or returns no sections.
 * These are the built-in template defaults that ensure the homepage always renders.
 */

const FALLBACK_HERO = {
    title: (
        <>
            <span className="text-primary">Ottabase</span>{' '}
            <span className="inline-flex items-baseline gap-2">
                Homepage
                <span className="rounded bg-muted px-2 py-0.5 font-mono text-[0.32em] font-medium text-muted-foreground">
                    on Next.js
                </span>
            </span>
        </>
    ),
    subtitle: 'Ship a themed, edge-deployed homepage on Cloudflare Workers in minutes.',
    actions: [
        { href: '/about', label: 'About', variant: 'default' as const },
        {
            href: '/theme-demo',
            label: (
                <span className="inline-flex items-center gap-1.5">
                    <Palette className="h-4 w-4" /> Theme Demo
                </span>
            ),
            variant: 'secondary' as const,
        },
        {
            href: 'https://github.com/thinkdj/ottabase',
            label: (
                <span className="inline-flex items-center gap-1.5">
                    <Github className="h-4 w-4" /> GitHub
                </span>
            ),
            variant: 'outline' as const,
            external: true,
        },
    ],
};

const FALLBACK_FEATURES = {
    features: [
        { title: 'Cloudflare Workers', description: 'Edge-deployed via OpenNext. No origin server needed.' },
        { title: 'Brand Engine', description: '8 theme presets with live switching and dark mode.' },
        { title: 'Next.js 16', description: 'App Router, RSC, and streaming out of the box.' },
        { title: 'TypeScript', description: 'End-to-end type safety across client and server.' },
    ],
};

const FALLBACK_CTA = {
    title: 'Ready to Ship?',
    description: 'Clone the template, customize the brand, and deploy to Cloudflare Workers in minutes.',
    actions: [
        {
            href: 'https://github.com/thinkdj/ottabase',
            label: (
                <span className="inline-flex items-center gap-1.5">
                    <Rocket className="h-4 w-4" /> Get Started
                </span>
            ),
            external: true,
        },
        { href: '/theme-demo', label: 'Explore Themes', variant: 'outline' as const },
    ],
};

/**
 * Map DB sections to slot-specific data contracts.
 * Filters to enabled sections only and transforms to the shapes expected by SlotRenderer.
 */
function buildPageSlotData(sections: HomepageDataPayload['sections']) {
    const result: {
        hero?: Record<string, unknown>;
        features?: Record<string, unknown>;
        cta?: Record<string, unknown>;
        about?: Record<string, unknown>;
    } = {};

    for (const section of sections) {
        if (section.enabled === false) continue;

        const slot = section.slot;
        if (slot === 'hero') {
            result.hero = {
                title: section.title ?? '',
                subtitle: section.subtitle ?? undefined,
                body: section.body ?? undefined,
                actions:
                    section.actions.length > 0
                        ? section.actions.map((a) => ({
                              label: a.label,
                              href: a.href,
                              variant: (a.variant as 'default' | 'secondary' | 'outline' | 'ghost') ?? 'default',
                              icon: a.icon ?? undefined,
                              external: a.external,
                          }))
                        : undefined,
            };
        } else if (slot === 'features') {
            result.features = {
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
            result.cta = {
                title: section.title ?? '',
                description: section.subtitle ?? undefined,
                actions:
                    section.actions.length > 0
                        ? section.actions.map((a) => ({
                              label: a.label,
                              href: a.href,
                              variant: (a.variant as 'default' | 'secondary' | 'outline' | 'ghost') ?? 'default',
                              icon: a.icon ?? undefined,
                              external: a.external,
                          }))
                        : [],
            };
        } else if (slot === 'about') {
            result.about = {
                title: section.title ?? undefined,
                description: section.subtitle ?? undefined,
                githubUrl: section.githubUrl ?? undefined,
            };
        }
    }

    return result;
}

export default function HomePage() {
    const homepageData = useHomepageData();
    const sections = homepageData?.sections ?? [];

    // Build slot data from DB sections, with fallbacks for missing slots
    const dbSlots = buildPageSlotData(sections);
    const heroData = dbSlots.hero ?? FALLBACK_HERO;
    const featuresData = dbSlots.features ?? FALLBACK_FEATURES;
    const ctaData = dbSlots.cta ?? FALLBACK_CTA;

    return (
        <div className="flex flex-col items-center">
            <SlotRenderer slot="hero" data={heroData as any} />
            <SlotRenderer slot="features" data={featuresData as any} />
            {dbSlots.about && <SlotRenderer slot="about" data={dbSlots.about as any} />}
            <SlotRenderer slot="cta" data={ctaData as any} />
        </div>
    );
}
