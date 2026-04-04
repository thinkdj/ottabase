import { ThemeColorMeta } from '@/components/core/ThemeColorMeta';
import { siteConfig } from '@/config';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './tailwind.css';
import './globals.css';

const FONT_CLASSIC =
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap';

export function ClassicThemeRoot({ children }: { children: ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning data-site-theme="classic">
            <head>
                <meta name="theme-color" content={siteConfig.themeColor.light} />
                <meta name="color-scheme" content="light dark" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href={FONT_CLASSIC} rel="stylesheet" />
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
