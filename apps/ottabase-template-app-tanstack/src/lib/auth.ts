// ============================================================
// Session Management - App Glue Code
// ============================================================
//
// Wraps the @ottabase/auth/react hooks to sync with the
// global app state management (@ottabase/state).
//
// ============================================================

import { userAtom } from "@/ottabase/state/appGlobalState";
import {
  useSession as useAuthSession,
  type UseSessionOptions,
} from "@ottabase/auth/react";
import { useSetAtom } from "jotai";
import { useEffect } from "react";

// Re-export types
export {
  type Session,
  type User,
  type UseSessionOptions,
} from "@ottabase/auth/react";

/**
 * Custom useSession hook that syncs with global app state
 */
export function useSession(options?: UseSessionOptions) {
  const sessionData = useAuthSession(options);
  const setGlobalUser = useSetAtom(userAtom);

  // Sync auth user to global state
  useEffect(() => {
    setGlobalUser(sessionData.user);
  }, [sessionData.user, setGlobalUser]);

  return sessionData;
}
