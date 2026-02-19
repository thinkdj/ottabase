/**
 * Landing page configuration — the single source of truth for site content.
 *
 * This defines ALL content for the landing site: site-level config (name, nav,
 * footer) and per-page section content. Themes render this data — change the
 * themeId to swap the visual layer without touching content.
 *
 * In production, this data lives in the database (via OttaORM models).
 * For this static template, it's defined here as typed config.
 */

import type { LandingSiteData, SiteContent, PageContent } from '@ottabase/ottalanding';

// ─── Site config ─────────────────────────────────────────────────────────────

export const siteContent: SiteContent = {
    name: 'Ottabase',
    tagline: 'Open-source monorepo template for production-ready web apps.',
    navLinks: [
        { label: 'Features', href: '/#features' },
        { label: 'Pricing', href: '/#pricing' },
        { label: 'Themes', href: '/theme' },
        { label: 'Docs', href: 'https://github.com/thinkdj/ottabase' },
    ],
    navCta: { label: 'Get started', href: '/about' },
    footerSections: [
        {
            title: 'Product',
            links: [
                { label: 'Features', href: '/#features' },
                { label: 'Pricing', href: '/#pricing' },
                { label: 'Changelog', href: '/about' },
            ],
        },
        {
            title: 'Developers',
            links: [
                { label: 'Documentation', href: 'https://github.com/thinkdj/ottabase' },
                { label: 'Theme gallery', href: '/theme' },
                { label: 'About', href: '/about' },
            ],
        },
        {
            title: 'Company',
            links: [
                { label: 'GitHub', href: 'https://github.com/thinkdj/ottabase' },
                { label: 'Open source', href: 'https://github.com/thinkdj/ottabase' },
            ],
        },
    ],
    socialLinks: [],
    legal: {
        copyright: `\u00A9 ${new Date().getFullYear()} Ottabase. Open source under MIT.`,
        links: [
            { label: 'Privacy', href: '/about' },
            { label: 'Terms', href: '/about' },
        ],
    },
};

// ─── Home page ───────────────────────────────────────────────────────────────

export const homePage: PageContent = {
    slug: 'home',
    title: 'Ottabase — Ship homepages faster',
    metaDescription:
        'A production-ready Next.js template with OpenNext, Cloudflare Workers, Brand Engine theming, and a full suite of marketing components.',
    sections: [
        {
            type: 'hero',
            order: 0,
            content: {
                badge: 'Now on Next.js 16 + Cloudflare',
                headline: 'Ship homepages faster with Ottabase',
                subheadline:
                    'A production-ready Next.js template with OpenNext, Cloudflare Workers, Brand Engine theming, and a full suite of marketing components — all wired up and ready to go.',
                primaryCta: { label: 'Get started free', href: '/about' },
                secondaryCta: { label: 'View on GitHub', href: 'https://github.com/thinkdj/ottabase' },
                socialProof: { count: '10,000+', label: 'developers building with Ottabase' },
            },
        },
        {
            type: 'logo-cloud',
            order: 1,
            content: {
                label: 'Trusted by teams using',
                logos: [
                    { name: 'Next.js' },
                    { name: 'Cloudflare' },
                    { name: 'TypeScript' },
                    { name: 'Tailwind CSS' },
                    { name: 'Radix UI' },
                    { name: 'Prisma' },
                ],
            },
        },
        {
            type: 'features',
            order: 2,
            content: {
                eyebrow: 'Everything you need',
                headline: 'Built for production from day one',
                subheadline:
                    'Stop stitching together boilerplate. Ottabase gives you a battle-tested foundation so you can focus on your product.',
                columns: 3,
                features: [
                    {
                        icon: 'Globe',
                        title: 'Edge-deployed',
                        description:
                            'Deployed globally on Cloudflare Workers via OpenNext for sub-50 ms response times anywhere in the world.',
                    },
                    {
                        icon: 'Layers',
                        title: 'Brand Engine',
                        description:
                            'Built-in theme system with 8+ presets and full CSS-variable customisation. Light/dark mode with zero flash.',
                    },
                    {
                        icon: 'Code2',
                        title: 'Type-safe monorepo',
                        description:
                            'Full TypeScript across every workspace package. Shared configs, strict linting, and end-to-end type safety.',
                    },
                    {
                        icon: 'Shield',
                        title: 'Auth & RBAC',
                        description:
                            'Role-based access control with multi-tenant support baked in. Add users, teams, and permissions in minutes.',
                    },
                    {
                        icon: 'Gauge',
                        title: 'Optimised builds',
                        description:
                            'Turbo-powered with per-package caching and tree-shaken component libraries for the smallest possible bundles.',
                    },
                    {
                        icon: 'Cloud',
                        title: 'Deploy anywhere',
                        description:
                            'One-command deploy to Cloudflare Workers. Works with Vercel, AWS Lambda, and self-hosted environments too.',
                    },
                ],
            },
        },
        {
            type: 'stats',
            order: 3,
            content: {
                eyebrow: 'Ottabase by the numbers',
                headline: 'Built at scale, ready on day one',
                stats: [
                    {
                        value: '43',
                        label: 'workspace packages',
                        description: 'Shared libs for UI, auth, ORM, brand engine, and more.',
                    },
                    {
                        value: '<50ms',
                        label: 'edge response time',
                        description: 'Global Cloudflare Workers deployment via OpenNext.',
                    },
                    {
                        value: '8',
                        label: 'brand themes',
                        description: 'Default, Neo, Crisp, Funky, Artisan, Midnight, Rose, Verdant.',
                    },
                    {
                        value: '100%',
                        label: 'TypeScript',
                        description: 'End-to-end type safety across every package and app.',
                    },
                ],
            },
        },
        {
            type: 'steps',
            order: 4,
            content: {
                eyebrow: 'How it works',
                headline: 'From zero to deployed in minutes',
                subheadline: 'Ottabase removes the setup overhead so you can focus on building your product.',
                steps: [
                    {
                        title: 'Clone the repo',
                        description:
                            'Run git clone and pnpm install. All 43 workspace packages install in one command with the pnpm workspace catalog.',
                    },
                    {
                        title: 'Pick your theme',
                        description:
                            'Choose from 8 built-in brand themes or customise the CSS-variable tokens to match your brand perfectly.',
                    },
                    {
                        title: 'Build your page',
                        description:
                            'Drop in Atlas or Mono marketing components. Each section is typed, responsive, and dark-mode ready.',
                    },
                    {
                        title: 'Deploy to the edge',
                        description:
                            'One wrangler deploy command ships your site globally on Cloudflare Workers in under 60 seconds.',
                    },
                ],
            },
        },
        {
            type: 'testimonials',
            order: 5,
            content: {
                eyebrow: 'What developers say',
                headline: 'Teams ship faster with Ottabase',
                testimonials: [
                    {
                        quote: 'We went from zero to production in a weekend. The Brand Engine alone saved us two weeks of theming work.',
                        author: 'Maya Patel',
                        role: 'CTO',
                        company: 'Finflow',
                        rating: 5,
                    },
                    {
                        quote: 'The Cloudflare Workers integration just works. No weird quirks, no configuration hell — it deploys first time, every time.',
                        author: 'James Okonkwo',
                        role: 'Lead Engineer',
                        company: 'Stackhaus',
                        rating: 5,
                    },
                    {
                        quote: "Finally a monorepo template that doesn't require a PhD to understand. Clean, well-documented, and everything actually connects.",
                        author: 'Sarah Lin',
                        role: 'Solo founder',
                        company: 'Loopboard',
                        rating: 5,
                    },
                ],
            },
        },
        {
            type: 'pricing',
            order: 6,
            content: {
                eyebrow: 'Simple pricing',
                headline: 'Start free, scale as you grow',
                subheadline: 'No hidden fees. Cancel anytime.',
                defaultBilling: 'monthly',
                plans: [
                    {
                        name: 'Starter',
                        description: 'Perfect for personal projects and small sites.',
                        price: { monthly: '$0', annual: '$0', suffix: '/month' },
                        features: [
                            { label: '1 project', included: true },
                            { label: 'Cloudflare Workers deployment', included: true },
                            { label: 'Brand Engine (3 presets)', included: true },
                            { label: 'Community support', included: true },
                            { label: 'Custom domain', included: false },
                            { label: 'Analytics', included: false },
                        ],
                        cta: { label: 'Start for free', href: '/about' },
                    },
                    {
                        name: 'Pro',
                        description: 'For teams shipping real products.',
                        price: { monthly: '$29', annual: '$19', suffix: '/month' },
                        badge: 'Most popular',
                        highlighted: true,
                        features: [
                            { label: 'Unlimited projects', included: true },
                            { label: 'Cloudflare Workers deployment', included: true },
                            { label: 'Brand Engine (all presets)', included: true },
                            { label: 'Priority support', included: true },
                            { label: 'Custom domain', included: true },
                            { label: 'Analytics', included: true },
                        ],
                        cta: { label: 'Start Pro trial', href: '/about' },
                    },
                    {
                        name: 'Enterprise',
                        description: 'Custom contracts, SLAs, and dedicated support.',
                        price: { monthly: 'Custom', suffix: '' },
                        features: [
                            { label: 'Unlimited projects', included: true },
                            { label: 'Cloudflare Workers deployment', included: true },
                            { label: 'Brand Engine (custom themes)', included: true },
                            { label: 'Dedicated support', included: true },
                            { label: 'Custom domain', included: true },
                            { label: 'Advanced analytics', included: true },
                        ],
                        cta: { label: 'Contact sales', href: '/about' },
                    },
                ],
            },
        },
        {
            type: 'faq',
            order: 7,
            content: {
                eyebrow: 'FAQ',
                headline: 'Common questions',
                subheadline: 'Everything you need to know about Ottabase.',
                items: [
                    {
                        question: 'What is Ottabase?',
                        answer: 'Ottabase is an open-source monorepo template built on Next.js 16, Cloudflare Workers, and a full suite of shared packages — including brand theming, UI components, auth, and more.',
                    },
                    {
                        question: 'Do I need a Cloudflare account?',
                        answer: 'For local development, no. For deployment you will need a free Cloudflare account. The Workers free tier covers most hobby and small production workloads.',
                    },
                    {
                        question: 'Can I use a different deployment target?',
                        answer: 'Yes. While Ottabase is optimised for Cloudflare Workers via OpenNext, the Next.js app can be deployed to Vercel, AWS, or any Node.js host by removing the OpenNext config.',
                    },
                    {
                        question: 'Is the Brand Engine required?',
                        answer: 'No. Brand Engine is an optional package. You can swap it out for any CSS variable–based theme system, or remove it entirely and use plain Tailwind.',
                    },
                    {
                        question: 'What licence is this under?',
                        answer: 'Ottabase is MIT licensed. Use it for personal or commercial projects, fork it, and modify it freely.',
                    },
                ],
            },
        },
        {
            type: 'cta',
            order: 8,
            content: {
                headline: 'Ready to build your next product?',
                subheadline:
                    'Clone the repo, run pnpm install, and have a production-ready homepage deployed to Cloudflare in minutes.',
                primaryCta: { label: 'Get started free', href: '/about' },
                secondaryCta: { label: 'Read the docs', href: 'https://github.com/thinkdj/ottabase' },
            },
        },
    ],
};

// ─── About page ──────────────────────────────────────────────────────────────

export const aboutPage: PageContent = {
    slug: 'about',
    title: 'About — Ottabase',
    metaDescription: 'A modern, production-ready Next.js homepage template for Cloudflare Workers.',
    sections: [],
};

// ─── Full site data ──────────────────────────────────────────────────────────

/** Active landing theme ID — change this to swap the entire visual layer */
export const landingThemeId = 'atlas';

/** Brand Engine visual preset — controls colors, typography, spacing */
export const brandPreset = 'artisan';

export const landingSiteData: LandingSiteData = {
    site: siteContent,
    pages: [homePage, aboutPage],
    themeId: landingThemeId,
};
