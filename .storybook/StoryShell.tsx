import type { ReactNode } from 'react';
import { ProviderState } from '@ottabase/state';
import { UIProviders } from '@ottabase/ui/providers';
import { ThemeProvider } from 'next-themes';

interface StoryShellProps {
    children: ReactNode;
}

/**
 * StoryShell wraps stories in the appropriate providers
 * to ensure they have the same context as in the real application
 */
export function StoryShell({ children }: StoryShellProps) {
    return (
        <ProviderState>
            {/*
          ThemeProvider needs to come before UIProviders for dark mode toggle to work.
          This matches the app structure where ProviderNextThemes wraps UIProviders.
        */}
            <ThemeProvider
                attribute="class"
                storageKey="ottabase.theme"
                defaultTheme="light"
                enableSystem={false}
                disableTransitionOnChange={false}
            >
                <UIProviders
                    enableThemeProvider={false} // We're already providing next-themes above
                    enableTooltipProvider={true}
                    enableToaster={true}
                >
                    <div className="story-shell p-4">{children}</div>
                </UIProviders>
            </ThemeProvider>
        </ProviderState>
    );
}
