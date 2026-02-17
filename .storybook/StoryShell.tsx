import type { ReactNode } from 'react';
import { ProviderState } from '@ottabase/state';
import { ShadcnProviders } from '@ottabase/ui-shadcn/providers';
import { ProviderCodeHighlight } from '@ottabase/ui-code-highlight';
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
          ThemeProvider needs to come before ShadcnProviders for dark mode toggle to work.
          This matches the app structure where ProviderNextThemes wraps ShadcnProviders.
        */}
            <ThemeProvider
                attribute="class"
                storageKey="ottabase.theme"
                defaultTheme="light"
                enableSystem={false}
                disableTransitionOnChange={false}
            >
                <ShadcnProviders
                    enableThemeProvider={false} // We're already providing next-themes above
                    enableTooltipProvider={true}
                    enableToaster={true}
                >
                    <ProviderCodeHighlight>
                        <div className="story-shell p-4">{children}</div>
                    </ProviderCodeHighlight>
                </ShadcnProviders>
            </ThemeProvider>
        </ProviderState>
    );
}
