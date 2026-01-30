'use client';

import { useThemeManager } from '@/ottabase/hooks/useThemeManager';

/**
 * Null component that exists only to activate the `useThemeManager` hook
 * high up in the component tree. This ensures the Jotai state is always
 * in sync with the `next-themes` state.
 */
export function ThemeManager() {
    useThemeManager();
    return null;
}
