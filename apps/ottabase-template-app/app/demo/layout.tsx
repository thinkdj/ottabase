'use client';

import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';

/**
 * Demo Layout
 *
 * This layout wraps all /demo routes but does NOT include Mantine providers.
 * The main app uses UI Base as the foundation.
 *
 * Provides a consistent dark mode toggle in the top-right for all demo pages.
 * Toggle uses global state (themeAtom) directly.
 *
 * For Mantine-specific demos, see /demo/mantine which has its own nested layout
 * that adds the Mantine providers.
 */

export default function DemoLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="relative min-h-screen">
            {/* Dark Mode Toggle - Fixed top-right */}
            <div className="fixed right-5 top-5 z-50">
                <DarkModeToggle type="button" title="Toggle dark/light mode" />
            </div>

            {children}
        </div>
    );
}
