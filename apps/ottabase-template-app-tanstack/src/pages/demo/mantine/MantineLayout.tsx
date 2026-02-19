import { appConfig } from '@/ottabase/config/app.config';
import { themeAtom } from '@/ottabase/state/appState';
import { ProviderUIMantine } from '@ottabase/ui-mantine';
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
            themeColors={appConfig.theme.colors}
            primaryColor={appConfig.theme.colorDefault}
            baseTheme={mantineThemePreset}
            colorScheme={validTheme}
        >
            {children}
        </ProviderUIMantine>
    );
}
