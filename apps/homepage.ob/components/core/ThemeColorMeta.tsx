'use client';

import { siteConfig } from '@/config';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';

/**
 * Keeps <meta name="theme-color"> in sync with resolved light/dark (matches legacy inline script).
 */
export function ThemeColorMeta() {
    const { resolvedTheme } = useTheme();
    const { light, dark } = siteConfig.themeColor;

    useEffect(() => {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (!meta || !resolvedTheme) return;
        meta.setAttribute('content', resolvedTheme === 'dark' ? dark : light);
    }, [resolvedTheme, light, dark]);

    return null;
}
