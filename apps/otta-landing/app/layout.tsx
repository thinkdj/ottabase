import { getTheme, schemeInitScript, themeStyles } from '@ottabase/ottalanding';
import { sanitizeCssForStyleTag } from '@ottabase/utils/sanitize';
import type { Metadata } from 'next';
import { getSite, isProduction } from '../lib/content';
import './globals.css';

// Content is edited live in otta-web's admin, so every request reads the current site.
export const dynamic = 'force-dynamic';

/** A URL, or undefined for empty/unparseable input (metadata must never throw). */
function toUrl(value?: string): URL | undefined {
    try {
        return value ? new URL(value) : undefined;
    } catch {
        return undefined;
    }
}

export async function generateMetadata(): Promise<Metadata> {
    const [site, production] = await Promise.all([getSite(), isProduction()]);
    return {
        title: site?.name ?? 'Landing site',
        description: site?.tagline,
        // Only the production deployment may be indexed; preview/staging copies must not compete with it.
        robots: production ? 'index, follow' : 'noindex, nofollow',
        // Resolves canonical and Open Graph URLs against the configured public address.
        metadataBase: toUrl(site?.siteUrl),
    };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const site = await getSite();
    // The theme's design tokens on :root, rendered server-side so the first paint is already on-brand.
    const theme = getTheme(site?.theme ?? 'launch');
    const { css, fonts } = themeStyles(theme.id);
    return (
        // data-scheme starts as the theme's default; the inline script swaps in the visitor's
        // saved light/dark choice before first paint (hence suppressHydrationWarning).
        <html lang="en" data-scheme={theme.scheme} suppressHydrationWarning>
            <head>
                <script dangerouslySetInnerHTML={{ __html: schemeInitScript() }} />
                <style id="landing-theme" dangerouslySetInnerHTML={{ __html: sanitizeCssForStyleTag(css) }} />
                {fonts.map((href) => (
                    <link key={href} rel="stylesheet" href={href} />
                ))}
            </head>
            <body className="bg-background text-foreground">{children}</body>
        </html>
    );
}
