'use client';

import { Github, Palette, Rocket } from 'lucide-react';
import { SlotRenderer } from '../components/SlotRenderer';

/**
 * Homepage content data — single source of truth.
 * Each section defines its data once; the active variant determines how it renders.
 */

const HERO_DATA = {
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

const FEATURES_DATA = {
    features: [
        { title: 'Cloudflare Workers', description: 'Edge-deployed via OpenNext. No origin server needed.' },
        { title: 'Brand Engine', description: '8 theme presets with live switching and dark mode.' },
        { title: 'Next.js 16', description: 'App Router, RSC, and streaming out of the box.' },
        { title: 'TypeScript', description: 'End-to-end type safety across client and server.' },
    ],
};

const CTA_DATA = {
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

export default function HomePage() {
    return (
        <div className="flex flex-col items-center">
            <SlotRenderer slot="hero" data={HERO_DATA} />
            <SlotRenderer slot="features" data={FEATURES_DATA} />
            <SlotRenderer slot="cta" data={CTA_DATA} />
        </div>
    );
}
