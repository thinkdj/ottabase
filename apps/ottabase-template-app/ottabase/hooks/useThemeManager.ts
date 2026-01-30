'use client';

import { themeAtom } from '@/ottabase/state/appGlobalState';
import { useAtom } from 'jotai';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import type { WritableAtom } from 'jotai';

// Define the theme type for clarity and reuse.
type Theme = 'light' | 'dark';

// Create more specific types for the Jotai atom and its setter.
type ThemeAtomType = WritableAtom<Theme, [Theme], void>;
type SetThemeType = (update: Theme) => void;

/**
 * A synchronization hook that keeps the global Jotai `themeAtom` in sync
 * with the state from `next-themes`.
 *
 * This establishes a one-way data flow:
 * `next-themes` (via a component like DarkModeToggle) -> This Hook -> Jotai Atom
 *
 * Other systems (like Mantine) can then react to changes in the Jotai atom.
 * This hook should be used once high up in the component tree, such as in the root layout.
 */
export function useThemeManager(): void {
    const [globalTheme, setGlobalTheme] = useAtom(themeAtom as ThemeAtomType);
    const { resolvedTheme } = useTheme();
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        // This effect runs whenever the theme from `next-themes` is resolved or changes.
        // It's responsible for keeping our global Jotai atom in sync.
        const validTheme = resolvedTheme === 'light' || resolvedTheme === 'dark' ? resolvedTheme : null;

        if (validTheme && globalTheme !== validTheme) {
            setGlobalTheme(validTheme);
        }

        // On the very first run, this also serves to hydrate the Jotai atom with the
        // correct initial value that `next-themes` has read from localStorage.
        if (!isHydrated) {
            setIsHydrated(true);
        }
    }, [resolvedTheme, globalTheme, setGlobalTheme, isHydrated]);
}
