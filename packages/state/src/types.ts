/**
 * @ottabase/state - Type Definitions
 * Simple, essential global state types for Ottabase apps
 */

// Theme type
export type Theme = 'light' | 'dark';

// Theme details type
export interface ThemeInfo {
    name: string; // e.g., "default", "neo", "crisp", "funky"
}

// Sidebar state type
export interface SidebarState {
    isOpen: boolean;
    isCollapsed: boolean;
    width: number; // Width in pixels
}

// Base user interface - apps can extend this
export interface BaseUser {
    id: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
}

// Core app global state interface
export interface AppState<TUser extends BaseUser = BaseUser> {
    // App identity
    appName: string;

    // Theme
    theme: Theme; // "light" | "dark" - the current mode
    themeInfo: ThemeInfo; // Theme name and metadata

    // User
    user: TUser | null;
    isAuthenticated: boolean;

    // UI State
    sidebarState: SidebarState; // Consolidated sidebar state
    scale: number; // UI magnification factor (1.0 = 100%)
    zoom: number; // Browser zoom level (1.0 = 100%)

    // Loading states
    isLoading: boolean;
}

// Configuration for creating app state
export interface AppStateConfig<TUser extends BaseUser = BaseUser> {
    appName: string;
    initialState?: Partial<Omit<AppState<TUser>, 'appName'>>;
}
