'use client';

import type { FullBrandConfig } from '@ottabase/brand-engine-react';
import { BrandProvider } from '@ottabase/brand-engine-react';
import { ShadcnProviders } from '@ottabase/ui-shadcn/providers';
import { ThemeProvider } from 'next-themes';

export function Providers({
    children,
    initialBrandConfig,
}: {
    children: React.ReactNode;
    initialBrandConfig?: FullBrandConfig;
}) {
    return (
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <BrandProvider initialConfig={initialBrandConfig}>
                <ShadcnProviders enableThemeProvider={false} enableToaster>
                    {children}
                </ShadcnProviders>
            </BrandProvider>
        </ThemeProvider>
    );
}
