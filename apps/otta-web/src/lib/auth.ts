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

type AdminUserLike = { permissions?: string[]; platformAdmin?: boolean } | null | undefined;

/** Wildcard-aware permission match (2-segment resource:action; '*:*' grants all). */
function hasPermission(permissions: string[] | undefined, required: string): boolean {
    const list = permissions ?? [];
    if (list.includes(required)) return true;
    const [reqResource, reqAction] = required.split(':');
    return list.some((perm) => {
        const [permResource, permAction] = perm.split(':');
        if (permResource === '*' && permAction === '*') return true;
        return (
            (permResource === '*' || permResource === reqResource) && (permAction === '*' || permAction === reqAction)
        );
    });
}

/**
 * PLATFORM administrator — the SaaS control plane (all users/orgs, RBAC, infrastructure, app-global
 * appearance/content). Trust ONLY the server-derived, scope-aware `user.platformAdmin` flag (set from
 * a SYSTEM-scoped grant). Deliberately NO `*:*` fallback: the session's merged permission list is
 * scope-blind, so an ORG-scoped `*:*` (e.g. a legacy/stale `owner=['*:*']` row on an un-migrated DB)
 * would otherwise masquerade as platform admin here. The server enforces the same boundary; this is
 * just what the client renders.
 */
export function isPlatformAdmin(user: AdminUserLike): boolean {
    if (!user) return false;
    return user.platformAdmin === true;
}

/**
 * ORGANIZATION administrator — can administer their own tenant. True for `org:admin` (which a
 * legacy org-scoped `*:*` also matches, correctly: such a user IS an org owner) or a platform owner.
 */
export function isOrgAdmin(user: AdminUserLike): boolean {
    if (!user) return false;
    return isPlatformAdmin(user) || hasPermission(user.permissions, 'org:admin');
}

/**
 * True when the user has ANY admin surface (platform or org). Drives visibility of the top-nav
 * "Admin" entry. The two distinct capabilities gate WHAT they see once inside /admin.
 */
export function isAdminUser(user: AdminUserLike): boolean {
    return isOrgAdmin(user);
}

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

        // Prefer the server-persisted active org (survives across devices), then the session's
        // organizationId, then the locally-remembered value.
        const sessionOrgId =
            (sessionData.user as any)?.activeOrganizationId ?? (sessionData.user as any)?.organizationId ?? null;
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
