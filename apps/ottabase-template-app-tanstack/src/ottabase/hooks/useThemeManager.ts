import { themeAtom } from '@/ottabase/state/appState';
import type { WritableAtom } from 'jotai';
import { useAtom } from 'jotai';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type ThemeAtomType = WritableAtom<Theme, [Theme], void>;

export function useThemeManager(): void {
    const [globalTheme, setGlobalTheme] = useAtom(themeAtom as ThemeAtomType);
    const { resolvedTheme } = useTheme();
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        const validTheme = resolvedTheme === 'light' || resolvedTheme === 'dark' ? resolvedTheme : null;

        if (validTheme && globalTheme !== validTheme) {
            setGlobalTheme(validTheme);
        }

        if (!isHydrated) {
            setIsHydrated(true);
        }
    }, [resolvedTheme, globalTheme, setGlobalTheme, isHydrated]);
}
