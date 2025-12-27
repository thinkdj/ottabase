import { createDefaultAppState } from "@ottabase/state";
import { atom } from "jotai";

// Mantine theme preset type
export type MantineThemePreset = "mantine-shadcn" | "mantine-vercel" | "mantine-ant" | "mantine-stripe";

// Mantine theme preset atom (separate from main app state)
export const mantineThemePresetAtom = atom<MantineThemePreset>("mantine-shadcn");

// Create app state using the shared state package
const appState = createDefaultAppState();

// Export the main atom containing the entire state object.
export const appStateAtom = appState.appStateAtom;

// Export the convenient, pre-created lensed atoms.
// These are the recommended way to interact with state slices.
export const themeAtom = appState.atoms.themeAtom;
export const scaleAtom = appState.atoms.scaleAtom;
export const userAtom = appState.atoms.userAtom;
export const isMobileSidebarOpenAtom = appState.atoms.isMobileSidebarOpenAtom;
export const isDesktopSidebarOpenAtom = appState.atoms.isDesktopSidebarOpenAtom;

// Export the lensed atom creator for advanced use cases.
export const createLensedAtom = appState.createLensedAtom;

// Export the complete state object for modern usage
export default appState;
