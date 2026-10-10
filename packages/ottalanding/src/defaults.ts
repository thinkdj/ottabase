/**
 * Starter content seeded the first time an app's landing site is read by the admin
 * (or by `/api/ottaorm/init`). Everything here is editable afterwards.
 */

import type { Section, SectionData, SectionType } from './sections';
import type { PageInput, SiteSettings } from './site';

const GITHUB = 'https://github.com/thinkdj/ottabase';

export const DEFAULT_SITE: SiteSettings = {
    name: 'Ottabase',
    tagline: 'Ship the product, not the plumbing.',
    theme: 'launch',
    nav: [
        { label: 'Features', href: '/#features' },
        { label: 'Pricing', href: '/#pricing' },
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' },
    ],
    navCtaLabel: 'Get started',
    navCtaHref: GITHUB,
    footerLinks: [
        { label: 'About', href: '/about' },
        { label: 'Contact', href: '/contact' },
        { label: 'GitHub', href: GITHUB },
    ],
    footerNote: 'Built on Cloudflare Workers.',
};

const s = <K extends SectionType>(type: K, data: SectionData<K>) => ({ id: type, type, data }) as Section;

export const DEFAULT_PAGES: PageInput[] = [
    {
        path: '/',
        title: 'Ottabase — ship the product, not the plumbing',
        description: 'Auth, tenancy, an ORM, CMS, uploads and theming — already wired together on Cloudflare Workers.',
        published: true,
        sections: [
            s('hero', {
                eyebrow: 'Cloudflare-native SaaS foundation',
                title: 'Ship the product, not the plumbing.',
                subtitle:
                    'Auth, multi-tenancy, an ORM over D1, a CMS, uploads and runtime theming — already wired together. Open the repo and start on the part only you can build.',
                actions: [
                    { label: 'Get started', href: GITHUB },
                    { label: 'See features', href: '#features' },
                ],
            }),
            s('logos', {
                title: 'Built for makers shipping on',
                items: [
                    { name: 'Workers' },
                    { name: 'D1' },
                    { name: 'R2' },
                    { name: 'KV' },
                    { name: 'Queues' },
                    { name: 'Durable Objects' },
                ],
            }),
            s('features', {
                title: 'Everything a real app needs, on day one',
                subtitle: 'Fifty-plus packages that already know about each other.',
                items: [
                    {
                        title: 'Auth & RBAC',
                        description: 'Sessions, OAuth, magic links, roles and permissions — scoped per tenant.',
                    },
                    {
                        title: 'OttaORM over D1',
                        description: 'Fat models, auto-migrations and row-level security at the edge.',
                    },
                    {
                        title: 'Content built in',
                        description: 'Blog/CMS, media library, uploads, comments and forms, ready to theme.',
                    },
                    {
                        title: 'Brand Engine',
                        description: 'Runtime design tokens: switch the entire look without a rebuild.',
                    },
                    {
                        title: 'Background work',
                        description: 'Queues, cron and email with retries and dead-letter handling.',
                    },
                    {
                        title: 'Edge-fast',
                        description: 'Everything runs on Cloudflare Workers — no origin server to babysit.',
                    },
                ],
            }),
            s('testimonials', {
                title: 'Makers ship faster',
                items: [
                    {
                        quote: 'I skipped three weeks of auth and tenancy work and went straight to the feature my customers asked for.',
                        author: 'Solo founder',
                        role: 'B2B SaaS',
                    },
                    {
                        quote: 'Switching the whole site’s look from the admin, live, sold my client in the first meeting.',
                        author: 'Freelance developer',
                        role: 'Agency work',
                    },
                    {
                        quote: 'Row-level security by default means I stopped worrying about one tenant seeing another’s data.',
                        author: 'CTO',
                        role: 'Early-stage startup',
                    },
                ],
            }),
            s('pricing', {
                title: 'Simple pricing',
                subtitle: 'Start free. Upgrade when it pays for itself.',
                plans: [
                    {
                        name: 'Hobby',
                        price: '$0',
                        period: 'forever',
                        description: 'For side projects.',
                        features: ['1 app', 'Community support', 'All core packages'],
                        ctaLabel: 'Start free',
                        ctaHref: GITHUB,
                    },
                    {
                        name: 'Pro',
                        price: '$29',
                        period: '/month',
                        description: 'For products with customers.',
                        features: ['Unlimited apps', 'Premium packages', 'Priority support'],
                        ctaLabel: 'Go Pro',
                        ctaHref: GITHUB,
                        featured: true,
                    },
                    {
                        name: 'Team',
                        price: '$99',
                        period: '/month',
                        description: 'For small teams.',
                        features: ['Everything in Pro', '5 seats', 'Onboarding call'],
                        ctaLabel: 'Contact us',
                        ctaHref: '/contact',
                    },
                ],
            }),
            s('faq', {
                title: 'Questions',
                items: [
                    {
                        question: 'Do I need to know Cloudflare?',
                        answer: 'No. Bindings, migrations and deploys are already configured — you write product code.',
                    },
                    {
                        question: 'Can I change the design?',
                        answer: 'Yes. Pick a theme in the admin, or bring your own components on top of the same content.',
                    },
                    {
                        question: 'Is my data isolated per customer?',
                        answer: 'Yes. Every query runs through tenant-aware row-level security.',
                    },
                ],
            }),
            s('cta', {
                title: 'Your weekend project, production-ready.',
                subtitle: 'Clone it, name it, ship it.',
                actions: [{ label: 'Get started on GitHub', href: GITHUB }],
            }),
        ],
    },
    {
        path: '/about',
        title: 'About — Ottabase',
        description: 'Why Ottabase exists.',
        published: true,
        sections: [
            s('hero', {
                eyebrow: 'About',
                title: 'The boring parts, done once and done well.',
                subtitle: 'Ottabase exists so the maker can spend their time on the product.',
            }),
            s('text', {
                title: 'Why we built it',
                body: 'The interesting part of a product is never the auth flow, the tenant boundary or the media library — yet those are what burn the maker.\n\nOttabase wires all of that together up front, on Cloudflare Workers, so a solo founder or a small team can open the repo and start on the actual product.',
            }),
            s('cta', {
                title: 'Want to talk?',
                actions: [{ label: 'Contact us', href: '/contact' }],
            }),
        ],
    },
    {
        path: '/contact',
        title: 'Contact — Ottabase',
        description: 'Questions, bugs and ideas.',
        published: true,
        sections: [
            s('hero', {
                eyebrow: 'Contact',
                title: 'Get in touch',
                subtitle: 'Questions, bugs and ideas all go through GitHub — we read everything.',
                actions: [{ label: 'Open an issue', href: `${GITHUB}/issues` }],
            }),
        ],
    },
];
