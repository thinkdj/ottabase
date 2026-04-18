/**
 * App Global State
 * Central state management for otta-web
 */
import { APP_ID, APP_NAME } from '@/ottabase/config';
import { createAppState, type BaseUser, type SidebarState } from '@ottabase/state';
import { createStore } from 'jotai';

// Extend BaseUser if needed
export interface AppUser extends BaseUser {
    role?: string;
    organizationId?: string | null;
    appId?: string;
}

// Create app state with appName
const { appStateAtom, atoms, createAtom } = createAppState<AppUser>({
    appName: APP_NAME,
    initialState: {
        appId: APP_ID,
        organizationId: null,
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

// Create global store for accessing atoms outside React components
// This allows the API client to read appId and organizationId
export const globalStore = createStore();

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
    appIdAtom,
    organizationIdAtom,
} = atoms;

// Export main atom and factory
export { appStateAtom, createAtom };

// Export types
export type { SidebarState };
