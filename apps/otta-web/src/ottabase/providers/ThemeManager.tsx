import { useThemeManager } from '@/ottabase/hooks/useThemeManager';
import { useThemeInfoManager } from '@/ottabase/hooks/useThemeInfoManager';

export function ThemeManager() {
    useThemeManager();
    useThemeInfoManager();
    return null;
}
