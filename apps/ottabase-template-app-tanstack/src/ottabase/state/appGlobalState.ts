import { createDefaultAppState } from "@ottabase/state";
import { atom } from "jotai";

export type MantineThemePreset =
  | "mantine-shadcn"
  | "mantine-vercel"
  | "mantine-ant"
  | "mantine-stripe";

export const mantineThemePresetAtom = atom<MantineThemePreset>(
  "mantine-shadcn"
);

const appState = createDefaultAppState();

export const appStateAtom = appState.appStateAtom;
export const themeAtom = appState.atoms.themeAtom;
export const scaleAtom = appState.atoms.scaleAtom;
export const userAtom = appState.atoms.userAtom;
export const isMobileSidebarOpenAtom = appState.atoms.isMobileSidebarOpenAtom;
export const isDesktopSidebarOpenAtom = appState.atoms.isDesktopSidebarOpenAtom;
export const createLensedAtom = appState.createLensedAtom;

export default appState;
