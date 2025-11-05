import { atom } from "jotai";
import type { AppGlobalState, AppStateConfig, BaseUser } from "./types";

/**
 * Creates a centralized Jotai atom for the entire application's global state.
 * This function promotes a simple, scalable, and developer-friendly state management pattern.
 *
 * @param config Configuration options for the app state, including the initial state.
 * @returns An object containing the main `appStateAtom` and convenient "lensed" atoms
 *          for accessing and updating individual state properties without re-rendering
 *          unrelated components.
 */
export function createAppState<TUser extends BaseUser = BaseUser>(
  config: AppStateConfig<TUser> = {},
) {
  const { initialState = {} } = config;

  /**
   * The single source of truth for the application's global state.
   * It is created with a default state, which is then merged with any
   * `initialState` provided via the configuration.
   */
  const appStateAtom = atom<AppGlobalState<TUser>>({
    theme: "light", // Default, will be hydrated by `useThemeManager`
    scale: 1.0,
    user: null,
    isMobileSidebarOpen: false,
    isDesktopSidebarOpen: true,
    cursorTheme: "default",
    selectionColor: {
      foreground: "#FFF",
      background: "#3A3A3A",
    },
    layoutProvider: "mantine",
    layoutPreset: "app",
    ...initialState, // User-provided initial state overrides defaults
  });

  /**
   * Creates a derived atom that focuses on a specific property of the main `appStateAtom`.
   * This is an efficient way to interact with a slice of the state. Components
   * using these derived atoms will only re-render when that specific slice changes.
   * This implementation uses only the core `jotai` library.
   */
  const createLensedAtom = <K extends keyof AppGlobalState<TUser>>(key: K) =>
    atom(
      (get) => get(appStateAtom)[key],
      (get, set, newValue: AppGlobalState<TUser>[K]) => {
        const currentState = get(appStateAtom);
        set(appStateAtom, { ...currentState, [key]: newValue });
      },
    );

  // Create lensed atoms for common, top-level properties for convenience.
  const themeAtom = createLensedAtom("theme");
  const scaleAtom = createLensedAtom("scale");
  const userAtom = createLensedAtom("user");
  const isMobileSidebarOpenAtom = createLensedAtom("isMobileSidebarOpen");
  const isDesktopSidebarOpenAtom = createLensedAtom("isDesktopSidebarOpen");

  return {
    /** The main atom containing the entire global state. */
    appStateAtom,
    /** A function to create a focused atom for any property of the global state. */
    createLensedAtom,
    /** Pre-created lensed atoms for common properties, for convenience. */
    atoms: {
      themeAtom,
      scaleAtom,
      userAtom,
      isMobileSidebarOpenAtom,
      isDesktopSidebarOpenAtom,
    },
  };
}

/**
 * A default app state factory for convenience. It creates a state instance
 * with sensible defaults.
 * @returns A new app state instance with default initial values.
 */
export function createDefaultAppState() {
  return createAppState({
    initialState: {
      theme: "light",
      scale: 1.0,
      isDesktopSidebarOpen: true,
      isMobileSidebarOpen: false,
      layoutProvider: "mantine",
      layoutPreset: "app",
    },
  });
}
