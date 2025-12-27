import { useThemeManager } from "@/ottabase/hooks/useThemeManager";

/**
 * ThemeManager - Activates theme synchronization
 * 
 * This is a null component that exists only to activate the useThemeManager hook
 * high up in the component tree. This ensures the theme state is synced with
 * localStorage and document class.
 */
export function ThemeManager() {
  useThemeManager();
  return null;
}
