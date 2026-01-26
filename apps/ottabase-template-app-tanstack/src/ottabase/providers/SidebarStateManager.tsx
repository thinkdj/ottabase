/**
 * Sidebar State Manager
 * Syncs sidebar state with localStorage for persistence across sessions
 */
import { useSidebarPersistence } from "@/ottabase/hooks/useSidebarPersistence";

export function SidebarStateManager(): null {
  useSidebarPersistence();
  return null;
}
