import { ThemeColorMeta } from '@/components/core/ThemeColorMeta';
import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

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
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <meta name="theme-color" content="#fafaf9" />
                <meta name="color-scheme" content="light dark" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>
                <Providers>
                    <ThemeColorMeta />
                    {children}
                </Providers>
            </body>
        </html>
    );
}
