'use client';

import { BrandProvider } from '@ottabase/brand-engine-react';
import { ShadcnProviders } from '@ottabase/ui-shadcn/providers';
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <BrandProvider>
                <ShadcnProviders enableThemeProvider={false} enableToaster>
                    {children}
                </ShadcnProviders>
            </BrandProvider>
        </ThemeProvider>
    );
}
