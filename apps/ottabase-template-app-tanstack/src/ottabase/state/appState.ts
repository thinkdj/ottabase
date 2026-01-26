/**
 * App Global State
 * Central state management for ottabase-template-app-tanstack
 */
import { createAppState, type BaseUser } from "@ottabase/state";

// Extend BaseUser if needed
export interface AppUser extends BaseUser {
  role?: string;
}

// Create app state with appName
const { appStateAtom, atoms, createAtom } = createAppState<AppUser>({
  appName: "Ottabase",
  initialState: {
    theme: "light",
    sidebarOpen: true,
    sidebarCollapsed: false,
    sidebarWidth: 250, // Default sidebar width
  },
});

// Export individual atoms for component use
export const {
  themeAtom,
  themeDetailsAtom,
  userAtom,
  isAuthenticatedAtom,
  sidebarOpenAtom,
  sidebarCollapsedAtom,
  sidebarWidthAtom,
  scaleAtom,
  zoomAtom,
  isLoadingAtom,
} = atoms;

// Export main atom and factory
export { appStateAtom, createAtom };
