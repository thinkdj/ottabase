import { appConfig } from '@/ottabase/config';
import { themeAtom } from '@/ottabase/state/appState';
import { MANTINE_DEMO_COLOR_DEFAULT, MANTINE_DEMO_THEME_COLORS, ProviderUIMantine } from '@ottabase/ui-mantine';
import { atom, useAtomValue } from 'jotai';

// Mantine theme preset (local to this demo component)
export type MantineThemePreset =
    | 'mantine-slate'
    | 'mantine-graphite'
    | 'mantine-azure'
    | 'mantine-aurora'
    | 'mantine-artisan';

export const mantineThemePresetAtom = atom<MantineThemePreset>('mantine-slate');

export function MantineLayout({ children }: { children: React.ReactNode }) {
    const globalTheme = useAtomValue(themeAtom);
    const mantineThemePreset = useAtomValue(mantineThemePresetAtom);

    const validTheme = globalTheme === 'light' || globalTheme === 'dark' ? globalTheme : 'light';

    return (
        <ProviderUIMantine
            storagePrefix={appConfig.storage.prefix}
            themeColors={MANTINE_DEMO_THEME_COLORS}
            primaryColor={MANTINE_DEMO_COLOR_DEFAULT}
            baseTheme={mantineThemePreset}
            colorScheme={validTheme}
        >
            {children}
        </ProviderUIMantine>
    );
}
