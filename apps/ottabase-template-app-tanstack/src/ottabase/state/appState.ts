/**
 * App Global State
 * Central state management for ottabase-template-app-tanstack
 */
import { createAppState, type BaseUser, type SidebarState } from '@ottabase/state';

// Extend BaseUser if needed
export interface AppUser extends BaseUser {
    role?: string;
}

// Create app state with appName
const { appStateAtom, atoms, createAtom } = createAppState<AppUser>({
    appName: 'Ottabase',
    initialState: {
        theme: 'light',
        themeInfo: {
            name: 'default',
        },
        sidebarState: {
            isOpen: true,
            isCollapsed: false,
            width: 250,
        },
    },
});

// Export individual atoms for component use
export const {
    themeAtom,
    themeInfoAtom,
    userAtom,
    isAuthenticatedAtom,
    sidebarStateAtom,
    scaleAtom,
    zoomAtom,
    isLoadingAtom,
    languageAtom,
} = atoms;

// Export main atom and factory
export { appStateAtom, createAtom };

// Export types
export type { SidebarState };
