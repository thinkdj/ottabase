import { atom } from 'jotai';
import type { AppState, AppStateConfig, BaseUser } from './types';

/**
 * Default state values
 */
const DEFAULT_STATE: Omit<AppState, 'appName'> = {
    theme: 'light',
    themeInfo: {
        name: 'default',
    },
    user: null,
    isAuthenticated: false,
    sidebarState: {
        isOpen: true,
        isCollapsed: false,
        width: 250, // Default sidebar width in pixels
    },
    scale: 1.0,
    zoom: 1.0,
    isLoading: false,
};

/**
 * Creates a centralized Jotai atom for the application's global state.
 *
 * @example
 * ```typescript
 * // In your app's state file (e.g., src/ottabase/state/appState.ts)
 * import { createAppState } from "@ottabase/state";
 *
 * const { appStateAtom, atoms } = createAppState({ appName: "My App" });
 *
 * export const { themeAtom, userAtom, sidebarOpenAtom, scaleAtom } = atoms;
 * export { appStateAtom };
 * ```
 */
export function createAppState<TUser extends BaseUser = BaseUser>(config: AppStateConfig<TUser>) {
    const { appName, initialState = {} } = config;

    // Main state atom
    const appStateAtom = atom<AppState<TUser>>({
        appName,
        ...DEFAULT_STATE,
        ...initialState,
    } as AppState<TUser>);

    /**
     * Creates a derived atom that focuses on a specific property.
     * Components using these atoms only re-render when that property changes.
     */
    const createAtom = <K extends keyof AppState<TUser>>(key: K) =>
        atom(
            (get) => get(appStateAtom)[key],
            (get, set, newValue: AppState<TUser>[K]) => {
                set(appStateAtom, { ...get(appStateAtom), [key]: newValue });
            },
        );

    // Pre-created atoms for common properties
    const themeAtom = createAtom('theme');
    const themeInfoAtom = createAtom('themeInfo');
    const userAtom = createAtom('user');
    const isAuthenticatedAtom = createAtom('isAuthenticated');
    const sidebarStateAtom = createAtom('sidebarState');
    const scaleAtom = createAtom('scale');
    const zoomAtom = createAtom('zoom');
    const isLoadingAtom = createAtom('isLoading');

    return {
        /** The main atom containing entire global state */
        appStateAtom,

        /** Function to create a focused atom for any property */
        createAtom,

        /** Pre-created atoms for common properties */
        atoms: {
            themeAtom,
            themeInfoAtom,
            userAtom,
            isAuthenticatedAtom,
            sidebarStateAtom,
            scaleAtom,
            zoomAtom,
            isLoadingAtom,
        },
    };
}

// Re-export types
export type { AppState, AppStateConfig, BaseUser, Theme, ThemeInfo, SidebarState } from './types';
