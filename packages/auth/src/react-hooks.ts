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

import { atom, useAtom, useAtomValue, type Getter } from 'jotai';
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
    emailVerified?: number | null;
    role?: string;
    organizationId?: string | null;
    roles?: string[];
    permissions?: string[];
    [key: string]: any;
}

/**
 * Session type
 */
export interface Session extends AuthSession {
    user: User;
}

/** localStorage key for session persistence */
export const AUTH_STORAGE_KEY = 'ottabase.auth-session';

/** Clears the persisted session from localStorage. Use in API client onUnauthorized. */
export function clearAuthSessionStorage(): void {
    try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
        // ignore
    }
}

const persistentSessionAtom = atomWithStorage<Session | null>(AUTH_STORAGE_KEY, null);
// In-memory session storage (cleared on refresh)
const memorySessionAtom = atom<Session | null>(null);
// Remember-me toggle (defaults to true, not persisted)
const rememberSessionAtom = atom(true);

const activeSessionAtom = atom((get: Getter) => {
    const remember = get(rememberSessionAtom);
    return remember ? get(persistentSessionAtom) : get(memorySessionAtom);
});

// Auth loading state
const authLoadingAtom = atom(false);

/** Module-level sync guard to avoid duplicate session fetches across components, no matter how many components mount at once */
let sessionSyncPromise: Promise<AuthSession | null> | null = null;
let sessionSyncKey: string | null = null;

// Is authenticated derived atom
const isAuthenticatedAtom = atom((get: Getter) => {
    const session = get(activeSessionAtom);
    if (!session) return false;

    // Check if session is expired
    const expiresAt = Number(session.expires);
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
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
    const [persistentSession, setPersistentSession] = useAtom(persistentSessionAtom);
    const [memorySession, setMemorySession] = useAtom(memorySessionAtom);
    const [rememberSession, setRememberSession] = useAtom(rememberSessionAtom);
    const session = useAtomValue(activeSessionAtom);
    const [isLoading, setIsLoading] = useAtom(authLoadingAtom);
    const [isAuthenticated] = useAtom(isAuthenticatedAtom);

    // Sync with backend session on mount (unless disabled)
    useEffect(() => {
        if (options?.skipAutoSync) return;

        let mounted = true;
        const syncKey = options?.baseUrl ?? null;

        if (sessionSyncPromise && sessionSyncKey === syncKey) return;

        async function syncSession() {
            setIsLoading(true);
            sessionSyncKey = syncKey;
            try {
                sessionSyncPromise = getAuthSession({
                    baseUrl: options?.baseUrl,
                });
                const backendSession = await sessionSyncPromise;

                if (!mounted) return;

                if (backendSession) {
                    if (rememberSession) {
                        setPersistentSession(backendSession as Session);
                        setMemorySession(null);
                    } else {
                        setMemorySession(backendSession as Session);
                        setPersistentSession(null);
                    }
                } else {
                    // Clear local session if backend session doesn't exist
                    setPersistentSession(null);
                    setMemorySession(null);
                }
            } catch (error) {
                console.error('Failed to sync session:', error);
            } finally {
                setIsLoading(false);
                sessionSyncPromise = null;
            }
        }

        syncSession();

        return () => {
            mounted = false;
        };
    }, [
        options?.skipAutoSync,
        options?.baseUrl,
        rememberSession,
        setPersistentSession,
        setMemorySession,
        setIsLoading,
    ]);

    /**
     * Manually set session (e.g., after successful login)
     */
    const login = useCallback(
        (newSession: Session, loginOptions?: { remember?: boolean }) => {
            const remember = loginOptions?.remember ?? rememberSession;
            setRememberSession(remember);
            if (remember) {
                setPersistentSession(newSession);
                setMemorySession(null);
            } else {
                setMemorySession(newSession);
                setPersistentSession(null);
            }
        },
        [rememberSession, setRememberSession, setPersistentSession, setMemorySession],
    );

    /**
     * Sign out and clear session
     */
    const logout = useCallback(async () => {
        try {
            // Sign out from backend
            await authSignOut({
                redirectTo: '/login',
                clientOptions: { baseUrl: options?.baseUrl },
            });
        } catch (error) {
            console.error('Failed to sign out:', error);
        } finally {
            // Clear local session regardless
            setPersistentSession(null);
            setMemorySession(null);
        }
    }, [options?.baseUrl, setPersistentSession, setMemorySession]);

    /**
     * Update user fields in session
     */
    const updateUser = useCallback(
        (updatedUser: Partial<User>) => {
            if (session) {
                const updatedSession = {
                    ...session,
                    user: { ...session.user, ...updatedUser },
                };
                if (rememberSession) {
                    setPersistentSession(updatedSession);
                } else {
                    setMemorySession(updatedSession);
                }
            }
        },
        [session, rememberSession, setPersistentSession, setMemorySession],
    );

    /**
     * Refresh session from backend
     */
    const refreshSession = useCallback(async () => {
        setIsLoading(true);
        const syncKey = options?.baseUrl ?? null;
        sessionSyncKey = syncKey;
        try {
            sessionSyncPromise = getAuthSession({
                baseUrl: options?.baseUrl,
            });
            const backendSession = await sessionSyncPromise;

            if (backendSession) {
                if (rememberSession) {
                    setPersistentSession(backendSession as Session);
                    setMemorySession(null);
                } else {
                    setMemorySession(backendSession as Session);
                    setPersistentSession(null);
                }
            } else {
                setPersistentSession(null);
                setMemorySession(null);
            }
        } catch (error) {
            console.error('Failed to refresh session:', error);
        } finally {
            setIsLoading(false);
            sessionSyncPromise = null;
        }
    }, [options?.baseUrl, rememberSession, setPersistentSession, setMemorySession, setIsLoading]);

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
