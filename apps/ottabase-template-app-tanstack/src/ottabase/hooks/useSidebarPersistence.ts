/**
 * Hook to persist sidebar state to localStorage
 * Loads sidebar state on mount and saves on changes
 */
import { useEffect } from "react";
import { useAtom } from "jotai";
import { sidebarStateAtom, type SidebarState } from "@/ottabase/state/appState";

const STORAGE_KEY = "ottabase.sidebar.state";

export function useSidebarPersistence(): void {
  const [sidebarState, setSidebarState] = useAtom(sidebarStateAtom);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state: SidebarState = JSON.parse(stored);
        setSidebarState(state);
      }
    } catch (error) {
      console.warn("Failed to load sidebar state from localStorage:", error);
    }
  }, [setSidebarState]);

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sidebarState));
    } catch (error) {
      console.warn("Failed to save sidebar state to localStorage:", error);
    }
  }, [sidebarState]);
}
