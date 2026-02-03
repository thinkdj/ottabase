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
    /** The name of the app */
    appName: string;

    /** Current theme mode ('light' or 'dark') */
    theme: Theme;

    /** Theme information (name, mode) */
    themeInfo: ThemeInfo;

    /** Current authenticated user */
    user: TUser | null;

    /** Whether the user is authenticated */
    isAuthenticated: boolean;

    /** Sidebar state (open, collapsed, width) */
    sidebarState: SidebarState;

    /** Global scale multiplier for UI elements */
    scale: number;

    /** Global zoom level for content */
    zoom: number;

    /** Global loading state */
    isLoading: boolean;

    /** Current language code (e.g., 'en', 'es', 'fr', 'de') */
    language: string;
}

// Configuration for creating app state
export interface AppStateConfig<TUser extends BaseUser = BaseUser> {
    appName: string;
    initialState?: Partial<Omit<AppState<TUser>, 'appName'>>;
}
