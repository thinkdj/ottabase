import { useThemeManager } from "@/ottabase/hooks/useThemeManager";
import { useThemeDetailsManager } from "@/ottabase/hooks/useThemeDetailsManager";

export function ThemeManager() {
    useThemeManager();
    useThemeDetailsManager();
    return null;
}
