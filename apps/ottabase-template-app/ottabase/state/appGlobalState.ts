/**
 * App Global State
 * Central state management for ottabase-template-app (Next.js)
 */
import { createAppState, type BaseUser } from '@ottabase/state';
import { atom } from 'jotai';

// Mantine theme preset type (specific to this app)
export type MantineThemePreset =
    | 'mantine-slate'
    | 'mantine-graphite'
    | 'mantine-azure'
    | 'mantine-aurora'
    | 'mantine-artisan';

// Mantine theme preset atom (separate from main app state)
export const mantineThemePresetAtom = atom<MantineThemePreset>('mantine-slate');

// Extend BaseUser if needed
export interface AppUser extends BaseUser {
    role?: string;
}

// Create app state with appName
const { appStateAtom, atoms, createAtom } = createAppState<AppUser>({
    appName: 'Ottabase',
    initialState: {
        theme: 'light',
        sidebarOpen: true,
        sidebarCollapsed: false,
    },
});

// Export individual atoms for component use
export const { themeAtom, userAtom, isAuthenticatedAtom, sidebarOpenAtom, sidebarCollapsedAtom, isLoadingAtom } = atoms;

// Export main atom and factory
export { appStateAtom, createAtom };

/*
    USAGE EXAMPLES
    ----------------------------------------------------------------

    1. Reading and Writing a specific value (e.g., theme)
       Best for performance, as this only re-renders when `theme` changes.
    ----------------------------------------------------------------
    import { useAtom } from 'jotai';
    import { themeAtom } from '@/ottabase/state/appGlobalState';

    function ThemeToggle() {
      const [theme, setTheme] = useAtom(themeAtom);
      return <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>Toggle</button>;
    }

    2. Reading the entire state object
    ----------------------------------------------------------------
    import { useAtomValue } from 'jotai';
    import { appStateAtom } from '@/ottabase/state/appGlobalState';

    function GlobalStateViewer() {
      const state = useAtomValue(appStateAtom);
      return <pre>{JSON.stringify(state, null, 2)}</pre>;
    }
*/
