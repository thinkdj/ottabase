import { appConfig } from "@/ottabase/config/app.config";
import { ProviderUIMantine } from "@ottabase/ui-mantine";
import { useAtomValue } from "jotai";
import {
    mantineThemePresetAtom,
    themeAtom,
} from "@/ottabase/state/appGlobalState";

export function MantineLayout({ children }: { children: React.ReactNode }) {
    const globalTheme = useAtomValue(themeAtom);
    const mantineThemePreset = useAtomValue(mantineThemePresetAtom);

    const validTheme =
        globalTheme === "light" || globalTheme === "dark" ? globalTheme : "light";

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
