import { ThemeColorMeta } from '@/components/core/ThemeColorMeta';
import { siteConfig } from '@/config';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './tailwind.css';
import './themes/signal-horizon.css';

const FONT_SIGNAL =
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@700;800;900&family=Sora:wght@600;700;800&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap';

/** Root HTML for Signal Horizon — loads `signal-horizon.css` instead of `globals.css`. */
export function SignalThemeRoot({ children }: { children: ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning data-site-theme="signalHorizon">
            <head>
                <meta name="theme-color" content={siteConfig.themeColor.dark} />
                <meta name="color-scheme" content="light dark" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href={FONT_SIGNAL} rel="stylesheet" />
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
