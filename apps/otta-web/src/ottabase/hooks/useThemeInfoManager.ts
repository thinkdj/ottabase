/**
 * Hook to sync theme info from ThemeContext to global state
 * Syncs the theme name and layout config (mode is synced by useThemeManager)
 */
import { useEffect } from 'react';
import { useAtom } from 'jotai';
import { themeInfoAtom } from '@/ottabase/state/appState';
import { useTheme } from '@/ottabase/providers/ThemeContext';

export function useThemeInfoManager(): void {
    const [, setGlobalThemeInfo] = useAtom(themeInfoAtom);
    const { theme: themeName, layout } = useTheme();

    useEffect(() => {
        setGlobalThemeInfo({
            name: themeName,
            layout: layout ?? undefined,
        });
    }, [themeName, layout, setGlobalThemeInfo]);
}
