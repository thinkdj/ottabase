/**
 * @ottabase/state - Type Definitions
 * Simple, essential global state types for Ottabase apps
 */

// Theme type
export type Theme = "light" | "dark";

// Theme details type
export interface ThemeDetails {
  name: string; // e.g., "default", "neo", "crisp", "funky"
  mode: Theme;
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
  theme: Theme;
  themeDetails: ThemeDetails;

  // User
  user: TUser | null;
  isAuthenticated: boolean;

  // UI State
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  scale: number; // UI magnification factor (1.0 = 100%)
  zoom: number; // Browser zoom level (1.0 = 100%)

  // Loading states
  isLoading: boolean;
}

// Configuration for creating app state
export interface AppStateConfig<TUser extends BaseUser = BaseUser> {
  appName: string;
  initialState?: Partial<Omit<AppState<TUser>, "appName">>;
}
