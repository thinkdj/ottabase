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
import { PLATFORM_ORG_SENTINEL } from '@ottabase/config';
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
 * Resolve which organization id should drive the app's active-org state (and the
 * X-Org-Id header) for a given session snapshot + the locally-remembered value.
 *
 * The platform-scope sentinel (organizationId NULL) has no way to persist server-side
 * as distinct from "no preference set" — PATCH activeOrganizationId=null clears the
 * column, and the session then falls back to the user's earliest membership, same as
 * an unset preference. Without special-casing it, that fallback org would silently
 * overwrite the sentinel the instant a platform admin selects Platform (refreshSession()
 * re-runs the sync effect that calls this). So the sentinel is kept sticky client-side
 * instead: once stored, it survives session refreshes/reloads until the admin explicitly
 * switches to a real org (or loses the platformAdmin grant, which drops out of this
 * branch on the next session read).
 */
export function resolveEffectiveOrgId(
    user:
        | {
              permissions?: string[];
              platformAdmin?: boolean;
              activeOrganizationId?: string | null;
              organizationId?: string | null;
          }
        | null
        | undefined,
    isAuthenticated: boolean,
    storedOrgId: string | null,
): string | null {
    const sessionOrgId = user?.activeOrganizationId ?? user?.organizationId ?? null;
    const keepPlatformScope = isPlatformAdmin(user) && storedOrgId === PLATFORM_ORG_SENTINEL;
    if (keepPlatformScope) return PLATFORM_ORG_SENTINEL;
    return sessionOrgId ?? (isAuthenticated ? storedOrgId : null);
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

        // Prefer the server-persisted active org (survives across devices) unless the
        // platform-scope sentinel is stuck client-side (see resolveEffectiveOrgId), then
        // the session's organizationId, then the locally-remembered value.
        const storedOrgId = getStoredOrganizationId();
        const effectiveOrgId = resolveEffectiveOrgId(sessionData.user as any, sessionData.isAuthenticated, storedOrgId);

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
