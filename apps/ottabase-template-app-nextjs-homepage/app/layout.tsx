import { buildCriticalCSS } from '@ottabase/brand-engine';
import type { Metadata } from 'next';
import { generateBrandConfig } from '../lib/brand-server';
import type { FooterData } from '../components/variants/footer/types';
import type { NavbarData } from '../components/variants/navbar/types';
import { getHomepageData } from '../lib/get-homepage-data';
import { mergeExposedPagesIntoNavbar } from '../lib/merge-exposed-pages-nav';
import { mergeHomepageConfigFromApi } from '../lib/merge-homepage-config';
import './globals.css';
import { LayoutShell } from './layout-shell';
import { Providers } from './providers';

export const metadata: Metadata = {
    title: 'Ottabase Next.js Homepage Template',
    description: 'A barebone Next.js homepage template with OpenNext and Cloudflare Workers deployment',
    keywords: ['nextjs', 'cloudflare', 'workers', 'opennext', 'homepage', 'template', 'brand-engine'],
    robots: 'index, follow',
    authors: [{ name: 'Ottabase' }],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const homepagePayload = await getHomepageData();
    const brandConfig = generateBrandConfig('light', homepagePayload.themePresetId);
    const theme = brandConfig.brandKitsMap.default.theme;
    const initialHomepageConfig = mergeHomepageConfigFromApi(homepagePayload.variantBySlot);
    const navbarData = mergeExposedPagesIntoNavbar(
        homepagePayload.slots.navbar as NavbarData,
        homepagePayload.exposedPages,
    );
    const footerData = homepagePayload.slots.footer as FooterData;

    // Generate critical CSS for SSR (prevents FOUC)
    const criticalCSS = buildCriticalCSS(theme);

    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                {/* Inject critical CSS for theme variables */}
                <style id="brand-critical" dangerouslySetInnerHTML={{ __html: criticalCSS }} />
                {/* Load fonts - only if URLs are defined */}
                {theme.typography.heading.url && <link rel="stylesheet" href={theme.typography.heading.url} />}
                {theme.typography.body.url && <link rel="stylesheet" href={theme.typography.body.url} />}
                {theme.typography.handwriting.url && <link rel="stylesheet" href={theme.typography.handwriting.url} />}
            </head>
            <body className="flex min-h-screen flex-col bg-background text-foreground">
                <Providers
                    initialBrandConfig={brandConfig}
                    initialHomepageConfig={initialHomepageConfig}
                    initialThemePresetId={homepagePayload.themePresetId}
                >
                    <LayoutShell navbarData={navbarData} footerData={footerData}>
                        {children}
                    </LayoutShell>
                </Providers>
            </body>
        </html>
    );
}
