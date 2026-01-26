/**
 * Hook to persist sidebar state to localStorage
 * Loads sidebar state on mount and saves on changes
 */
import { useEffect } from "react";
import { useAtom } from "jotai";
import { sidebarOpenAtom, sidebarCollapsedAtom, sidebarWidthAtom } from "@/ottabase/state/appState";

const STORAGE_KEY = "ottabase.sidebar.state";

interface StoredSidebarState {
  isOpen: boolean;
  isCollapsed: boolean;
  width: number;
}

export function useSidebarPersistence(): void {
  const [sidebarOpen, setSidebarOpen] = useAtom(sidebarOpenAtom);
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(sidebarCollapsedAtom);
  const [sidebarWidth, setSidebarWidth] = useAtom(sidebarWidthAtom);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const state: StoredSidebarState = JSON.parse(stored);
        setSidebarOpen(state.isOpen);
        setSidebarCollapsed(state.isCollapsed);
        setSidebarWidth(state.width);
      }
    } catch (error) {
      console.warn("Failed to load sidebar state from localStorage:", error);
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      const state: StoredSidebarState = {
        isOpen: sidebarOpen,
        isCollapsed: sidebarCollapsed,
        width: sidebarWidth,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn("Failed to save sidebar state to localStorage:", error);
    }
  }, [sidebarOpen, sidebarCollapsed, sidebarWidth]);
}
