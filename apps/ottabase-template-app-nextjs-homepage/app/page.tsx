import { AtlasCTABanner } from '@ottabase/ui-marketing/atlas/cta';
import { AtlasFAQAccordion } from '@ottabase/ui-marketing/atlas/faq';
import { AtlasFeaturesGrid } from '@ottabase/ui-marketing/atlas/features';
import { AtlasFooterMarketing } from '@ottabase/ui-marketing/atlas/footer';
import { AtlasHeroSection } from '@ottabase/ui-marketing/atlas/hero';
import { AtlasLogoCloud } from '@ottabase/ui-marketing/atlas/logo-cloud';
import { AtlasPricingTable } from '@ottabase/ui-marketing/atlas/pricing';
import { AtlasTestimonialsCarousel } from '@ottabase/ui-marketing/atlas/testimonials';
import { Cloud, Code2, Gauge, Globe, Layers, Shield } from 'lucide-react';

export default function HomePage() {
    return (
        <main className="flex min-h-screen flex-col bg-background text-foreground">
            <AtlasHeroSection
                badge="Now on Next.js 16 + Cloudflare"
                headline="Ship homepages faster with Ottabase"
                subheadline="A production-ready Next.js template with OpenNext, Cloudflare Workers, Brand Engine theming, and a full suite of marketing components — all wired up and ready to go."
                primaryCta={{ label: 'Get started free', href: '/about' }}
                secondaryCta={{ label: 'View on GitHub', href: 'https://github.com/thinkdj/ottabase' }}
                socialProof={{ count: '10,000+', label: 'developers building with Ottabase' }}
            />

            <AtlasLogoCloud
                label="Trusted by teams using"
                logos={[
                    { name: 'Next.js' },
                    { name: 'Cloudflare' },
                    { name: 'TypeScript' },
                    { name: 'Tailwind CSS' },
                    { name: 'Radix UI' },
                    { name: 'Prisma' },
                ]}
            />

            <AtlasFeaturesGrid
                eyebrow="Everything you need"
                headline="Built for production from day one"
                subheadline="Stop stitching together boilerplate. Ottabase gives you a battle-tested foundation so you can focus on your product."
                columns={3}
                features={[
                    {
                        icon: <Globe className="h-5 w-5" />,
                        title: 'Edge-deployed',
                        description:
                            'Deployed globally on Cloudflare Workers via OpenNext for sub-50 ms response times anywhere in the world.',
                    },
                    {
                        icon: <Layers className="h-5 w-5" />,
                        title: 'Brand Engine',
                        description:
                            'Built-in theme system with 8+ presets and full CSS-variable customisation. Light/dark mode with zero flash.',
                    },
                    {
                        icon: <Code2 className="h-5 w-5" />,
                        title: 'Type-safe monorepo',
                        description:
                            'Full TypeScript across every workspace package. Shared configs, strict linting, and end-to-end type safety.',
                    },
                    {
                        icon: <Shield className="h-5 w-5" />,
                        title: 'Auth & RBAC',
                        description:
                            'Role-based access control with multi-tenant support baked in. Add users, teams, and permissions in minutes.',
                    },
                    {
                        icon: <Gauge className="h-5 w-5" />,
                        title: 'Optimised builds',
                        description:
                            'Turbo-powered with per-package caching and tree-shaken component libraries for the smallest possible bundles.',
                    },
                    {
                        icon: <Cloud className="h-5 w-5" />,
                        title: 'Deploy anywhere',
                        description:
                            'One-command deploy to Cloudflare Workers. Works with Vercel, AWS Lambda, and self-hosted environments too.',
                    },
                ]}
            />

            <AtlasTestimonialsCarousel
                eyebrow="What developers say"
                headline="Teams ship faster with Ottabase"
                testimonials={[
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
                ]}
            />

            <AtlasPricingTable
                eyebrow="Simple pricing"
                headline="Start free, scale as you grow"
                subheadline="No hidden fees. Cancel anytime."
                defaultBilling="monthly"
                plans={[
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
                ]}
            />

            <AtlasFAQAccordion
                eyebrow="FAQ"
                headline="Common questions"
                subheadline="Everything you need to know about Ottabase."
                items={[
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
                ]}
            />

            <AtlasCTABanner
                headline="Ready to build your next product?"
                subheadline="Clone the repo, run pnpm install, and have a production-ready homepage deployed to Cloudflare in minutes."
                primaryCta={{ label: 'Get started free', href: '/about' }}
                secondaryCta={{ label: 'Read the docs', href: 'https://github.com/thinkdj/ottabase' }}
            />

            <AtlasFooterMarketing
                brand={{
                    name: 'Ottabase',
                    description: 'Open-source monorepo template for production-ready web apps.',
                }}
                sections={[
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
                            { label: 'Theme demo', href: '/theme-demo' },
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
                ]}
                legal={{
                    copyright: `© ${new Date().getFullYear()} Ottabase. Open source under MIT.`,
                    links: [
                        { label: 'Privacy', href: '/about' },
                        { label: 'Terms', href: '/about' },
                    ],
                }}
            />
        </main>
    );
}
