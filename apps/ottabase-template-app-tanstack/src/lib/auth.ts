// ============================================================
// Session Management - App Glue Code
// ============================================================
//
// Wraps the @ottabase/auth/react hooks to sync with the
// global app state management (@ottabase/state).
//
// ============================================================

import { appIdAtom, isAuthenticatedAtom, organizationIdAtom, userAtom } from '@/ottabase/state/appState';
import { useSession as useAuthSession, type UseSessionOptions } from '@ottabase/auth/react';
import { useSetAtom } from 'jotai';
import { useEffect } from 'react';
import { APP_ID } from '@/ottabase/config';

const CURRENT_ORG_KEY = 'ottabase.current-org-id';

function getStoredOrganizationId(): string | null {
    try {
        return localStorage.getItem(CURRENT_ORG_KEY);
    } catch {
        return null;
    }
}

// Re-export types
export { type Session, type User, type UseSessionOptions } from '@ottabase/auth/react';

/**
 * Custom useSession hook that syncs with global app state
 */
export function useSession(options?: UseSessionOptions) {
    const sessionData = useAuthSession(options);
    const setGlobalUser = useSetAtom(userAtom);
    const setGlobalIsAuthenticated = useSetAtom(isAuthenticatedAtom);
    const setAppId = useSetAtom(appIdAtom);
    const setOrganizationId = useSetAtom(organizationIdAtom);

    // Sync auth user to global state
    useEffect(() => {
        setGlobalUser(sessionData.user);
        setGlobalIsAuthenticated(sessionData.isAuthenticated);
        setAppId(APP_ID);

        const sessionOrgId = (sessionData.user as any)?.organizationId ?? null;
        const storedOrgId = getStoredOrganizationId();
        const effectiveOrgId = sessionOrgId ?? (sessionData.isAuthenticated ? storedOrgId : null);

        setOrganizationId(effectiveOrgId);

        try {
            if (effectiveOrgId) {
                localStorage.setItem(CURRENT_ORG_KEY, effectiveOrgId);
            } else {
                localStorage.removeItem(CURRENT_ORG_KEY);
            }
        } catch {
            // ignore storage failures
        }
    }, [
        sessionData.user,
        sessionData.isAuthenticated,
        setGlobalUser,
        setGlobalIsAuthenticated,
        setAppId,
        setOrganizationId,
    ]);

    return sessionData;
}
