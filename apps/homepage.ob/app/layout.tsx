import { siteConfig } from '@/config';
import type { Metadata } from 'next';
import { SignalThemeRoot } from './signal-root';
import { ClassicThemeRoot } from './theme-root';

export const metadata: Metadata = {
    metadataBase: new URL('https://ottabase.dev'),
    title: {
        default: 'Ottabase — The Edge-Native SaaS Framework',
        template: '%s — Ottabase',
    },
    description:
        '47 open-source TypeScript packages for building multi-tenant SaaS on Cloudflare Workers. Auth, RBAC, ORM, realtime, queues, blog, and UI — all wired up and ready to ship.',
    openGraph: {
        title: 'Ottabase — The Edge-Native SaaS Framework',
        description: '47 TypeScript packages for multi-tenant SaaS on Cloudflare Workers. Zero boilerplate.',
        type: 'website',
        url: 'https://ottabase.dev',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Ottabase — The Edge-Native SaaS Framework',
        description: '47 TypeScript packages for multi-tenant SaaS on Cloudflare Workers.',
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    if (siteConfig.theme === 'signalHorizon') {
        return <SignalThemeRoot>{children}</SignalThemeRoot>;
    }
    return <ClassicThemeRoot>{children}</ClassicThemeRoot>;
}
