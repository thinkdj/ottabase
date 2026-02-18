import { buildCriticalCSS } from '@ottabase/brand-engine';
import type { Metadata } from 'next';
import { siteContent, homePage } from '../config/landing.config';
import { generateBrandConfig } from '../lib/brand-server';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
    title: homePage.title || siteContent.name,
    description: homePage.metaDescription || siteContent.tagline,
    keywords: ['nextjs', 'cloudflare', 'workers', 'opennext', 'homepage', 'template', 'brand-engine'],
    robots: 'index, follow',
    authors: [{ name: siteContent.name }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    const brandConfig = generateBrandConfig('light');
    const theme = brandConfig.brandKitsMap.default.theme;
    const criticalCSS = buildCriticalCSS(theme);

    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <style id="brand-critical" dangerouslySetInnerHTML={{ __html: criticalCSS }} />
                {theme.typography.heading.url && <link rel="stylesheet" href={theme.typography.heading.url} />}
                {theme.typography.body.url && <link rel="stylesheet" href={theme.typography.body.url} />}
                {theme.typography.handwriting.url && <link rel="stylesheet" href={theme.typography.handwriting.url} />}
            </head>
            <body>
                <Providers initialBrandConfig={brandConfig}>{children}</Providers>
            </body>
        </html>
    );
}
