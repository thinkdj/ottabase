'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
    return (
        <ThemeProvider
            attribute="data-theme"
            defaultTheme="system"
            enableSystem
            storageKey="hp-ob-theme"
            themes={['light', 'dark']}
        >
            {children}
        </ThemeProvider>
    );
}
