// ============================================================
// @ottabase/auth - React Session Hook
// ============================================================
//
// Reusable React hook for session management with Jotai.
// Automatically syncs with Auth.js backend and persists to localStorage.
//
// Usage:
//   import { useSession } from "@ottabase/auth/react";
//
//   function MyComponent() {
//     const { session, user, isAuthenticated, logout } = useSession();
//     return <div>Welcome {user?.name}</div>;
//   }
//
// ============================================================

import { atom, useAtom, type Getter } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { useCallback, useEffect } from 'react';
import { signOut as authSignOut, getSession as getAuthSession, type AuthSession } from './client-api';

/**
 * User type
 */
export interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role?: string;
    [key: string]: any;
}

/**
 * Session type
 */
export interface Session extends AuthSession {
    user: User;
}

// Persistent session storage using localStorage
const sessionAtom = atomWithStorage<Session | null>('auth_session', null);

// Auth loading state
const authLoadingAtom = atom(false);

// Is authenticated derived atom
const isAuthenticatedAtom = atom((get: Getter) => {
    const session = get(sessionAtom);
    if (!session) return false;

    // Check if session is expired
    const expiresAt = new Date(session.expires);
    return expiresAt > new Date();
});

/**
 * Hook options
 */
export interface UseSessionOptions {
    /**
     * Skip auto-sync with backend (default: false)
     */
    skipAutoSync?: boolean;

    /**
     * Custom base URL for auth API
     */
    baseUrl?: string;
}

/**
 * React hook for session management
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { session, user, isAuthenticated, logout, refreshSession } = useSession();
 *
 *   if (!isAuthenticated) {
 *     return <LoginPrompt />;
 *   }
 *
 *   return (
 *     <div>
 *       <h1>Welcome {user.name}</h1>
 *       <button onClick={logout}>Sign Out</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useSession(options?: UseSessionOptions) {
    const [session, setSession] = useAtom(sessionAtom);
    const [isLoading, setIsLoading] = useAtom(authLoadingAtom);
    const [isAuthenticated] = useAtom(isAuthenticatedAtom);

    // Sync with backend session on mount (unless disabled)
    useEffect(() => {
        if (options?.skipAutoSync) return;

        let mounted = true;

        async function syncSession() {
            // Only show loading when we don't already have a session (avoids flash on protected routes)
            const hasSession = session !== null && session.expires && new Date(session.expires) > new Date();
            if (!hasSession) setIsLoading(true);
            try {
                const backendSession = await getAuthSession({
                    baseUrl: options?.baseUrl,
                });

                if (!mounted) return;

                if (backendSession) {
                    setSession(backendSession as Session);
                } else {
                    // Clear local session if backend session doesn't exist
                    setSession(null);
                }
            } catch (error) {
                console.error('Failed to sync session:', error);
            } finally {
                // Always clear loading so the global atom is never stuck (e.g. after unmount/cleanup)
                setIsLoading(false);
            }
        }

        syncSession();

        return () => {
            mounted = false;
        };
    }, [options?.skipAutoSync, options?.baseUrl, setSession, setIsLoading]);

    /**
     * Manually set session (e.g., after successful login)
     */
    const login = useCallback(
        (newSession: Session) => {
            setSession(newSession);
        },
        [setSession],
    );

    /**
     * Sign out and clear session
     */
    const logout = useCallback(async () => {
        // Clear local session first so UI updates immediately (header, etc.)
        setSession(null);
        try {
            await authSignOut({
                redirectTo: '/login',
                clientOptions: { baseUrl: options?.baseUrl },
            });
        } catch (error) {
            console.error('Failed to sign out:', error);
        }
    }, [options?.baseUrl, setSession]);

    /**
     * Update user fields in session
     */
    const updateUser = useCallback(
        (updatedUser: Partial<User>) => {
            if (session) {
                setSession({
                    ...session,
                    user: { ...session.user, ...updatedUser },
                });
            }
        },
        [session, setSession],
    );

    /**
     * Refresh session from backend
     */
    const refreshSession = useCallback(async () => {
        setIsLoading(true);
        try {
            const backendSession = await getAuthSession({
                baseUrl: options?.baseUrl,
            });

            if (backendSession) {
                setSession(backendSession as Session);
            } else {
                setSession(null);
            }
        } catch (error) {
            console.error('Failed to refresh session:', error);
        } finally {
            setIsLoading(false);
        }
    }, [options?.baseUrl, setSession, setIsLoading]);

    const user = session?.user ?? null;

    return {
        /** Current session (null if not authenticated) */
        session,

        /** Current user (null if not authenticated) */
        user,

        /** Whether user is authenticated and session is valid */
        isAuthenticated,

        /** Whether session is being loaded/synced */
        isLoading,

        /** Manually set session (after successful login) */
        login,

        /** Sign out and clear session */
        logout,

        /** Update user fields in session */
        updateUser,

        /** Refresh session from backend */
        refreshSession,

        /** Manually set loading state */
        setIsLoading,
    };
}
