import { buildCriticalCSS } from '@ottabase/brand-engine';
import type { Metadata } from 'next';
import { getHomepageData } from '../lib/get-homepage-data';
import { generateBrandConfig } from '../lib/brand-server';
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
    // Generate brand config server-side (SSR)
    // Note: Using 'light' for initial SSR. BrandProvider will handle dynamic theme switching on client.
    const brandConfig = generateBrandConfig('light');
    const theme = brandConfig.brandKitsMap.default.theme;

    // Generate critical CSS for SSR (prevents FOUC)
    const criticalCSS = buildCriticalCSS(theme);

    // Fetch and validate full homepage data from the worker API (Zod-validated)
    const homepageData = await getHomepageData();

    // Extract display settings for Providers
    const initialHomepageConfig = homepageData.display.variantBySlot ?? null;
    const themePresetId = homepageData.display.themePreset ?? null;

    // Apply SEO overrides from DB if available
    const seoTitle = homepageData.display.seoTitle;
    const seoDescription = homepageData.display.seoDescription;

    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                {/* Runtime SEO injection from DB display settings (bypasses Next.js metadata to support admin-driven content) */}
                {seoTitle && <title>{seoTitle}</title>}
                {seoDescription && <meta name="description" content={seoDescription} />}
                {/* Inject critical CSS for theme variables */}
                <style id="brand-critical" dangerouslySetInnerHTML={{ __html: criticalCSS }} />
                {/* Inject custom CSS from display settings */}
                {homepageData.display.customCss && (
                    <style id="homepage-custom" dangerouslySetInnerHTML={{ __html: homepageData.display.customCss }} />
                )}
                {/* Load fonts - only if URLs are defined */}
                {theme.typography.heading.url && <link rel="stylesheet" href={theme.typography.heading.url} />}
                {theme.typography.body.url && <link rel="stylesheet" href={theme.typography.body.url} />}
                {theme.typography.handwriting.url && <link rel="stylesheet" href={theme.typography.handwriting.url} />}
            </head>
            <body className="flex min-h-screen flex-col bg-background text-foreground">
                <Providers
                    initialBrandConfig={brandConfig}
                    initialHomepageConfig={initialHomepageConfig}
                    themePresetId={themePresetId}
                >
                    <LayoutShell exposedPages={homepageData.exposedPages} homepageData={homepageData}>
                        {children}
                    </LayoutShell>
                </Providers>
            </body>
        </html>
    );
}
