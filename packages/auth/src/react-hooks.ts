// ============================================================
// @ottabase/auth - React Session Hooks
// ============================================================

import { atom, useAtom, useAtomValue, type Getter } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { useCallback, useEffect, useRef } from 'react';
import { signOut as authSignOut, getSession as getAuthSession, type AuthSession } from './client-api';

/** User data returned with a session. */
export interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    emailVerified?: number | null;
    organizationId?: string | null;
    roles?: string[];
    permissions?: string[];
    [key: string]: any;
}

/** Session data persisted for the active browser user. */
export interface Session extends AuthSession {
    user: User;
}

/** Optional client configuration shared by session reads and explicit refreshes. */
export interface SessionClientOptions {
    /** Custom base URL for the auth API. Defaults to `/api/auth`. */
    baseUrl?: string;
}

/** Result returned by both session hooks. */
export interface SessionState {
    session: Session | null;
    user: User | null;
    isAuthenticated: boolean;
    isInitialized: boolean;
    isLoading: boolean;
    login: (newSession: Session, loginOptions?: { remember?: boolean }) => void;
    logout: () => Promise<void>;
    updateUser: (updatedUser: Partial<User>) => void;
    refreshSession: () => Promise<void>;
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
const memorySessionAtom = atom<Session | null>(null);
const rememberSessionAtom = atom(true);
const authLoadingAtom = atom(false);
const authInitializedAtom = atom(false);

const activeSessionAtom = atom((get: Getter) => {
    const remember = get(rememberSessionAtom);
    return remember ? get(persistentSessionAtom) : get(memorySessionAtom);
});

const isAuthenticatedAtom = atom((get: Getter) => {
    const session = get(activeSessionAtom);
    if (!session) return false;

    const expiresAt = Number(session.expires);
    return Number.isFinite(expiresAt) && expiresAt > Date.now();
});

/** One network request is shared by the bootstrap and explicit refresh callers. */
let sessionSyncPromise: Promise<AuthSession | null> | null = null;
let sessionSyncKey: string | null = null;
/** Prevents a pre-login/logout request from overwriting a newer local session mutation. */
let sessionStateVersion = 0;

function getSharedSessionSync(baseUrl?: string): Promise<AuthSession | null> {
    const syncKey = baseUrl ?? null;
    if (sessionSyncPromise && sessionSyncKey === syncKey) return sessionSyncPromise;

    const request = getAuthSession({ baseUrl });
    sessionSyncPromise = request;
    sessionSyncKey = syncKey;

    const clearIfCurrent = () => {
        if (sessionSyncPromise === request) {
            sessionSyncPromise = null;
            sessionSyncKey = null;
        }
    };
    void request.then(clearIfCurrent, clearIfCurrent);

    return request;
}

type SessionController = SessionState & {
    initializeSession: () => Promise<void>;
};

function useSessionController(options?: SessionClientOptions): SessionController {
    const [, setPersistentSession] = useAtom(persistentSessionAtom);
    const [, setMemorySession] = useAtom(memorySessionAtom);
    const [rememberSession, setRememberSession] = useAtom(rememberSessionAtom);
    const session = useAtomValue(activeSessionAtom);
    const [isLoading, setIsLoading] = useAtom(authLoadingAtom);
    const [isInitialized, setIsInitialized] = useAtom(authInitializedAtom);
    const [isAuthenticated] = useAtom(isAuthenticatedAtom);
    const rememberSessionRef = useRef(rememberSession);

    useEffect(() => {
        rememberSessionRef.current = rememberSession;
    }, [rememberSession]);

    const applyBackendSession = useCallback(
        (backendSession: AuthSession | null) => {
            sessionStateVersion += 1;
            if (backendSession) {
                if (rememberSessionRef.current) {
                    setPersistentSession(backendSession as Session);
                    setMemorySession(null);
                } else {
                    setMemorySession(backendSession as Session);
                    setPersistentSession(null);
                }
            } else {
                // The backend is authoritative for revoked, expired, and signed-out sessions.
                setPersistentSession(null);
                setMemorySession(null);
            }
        },
        [setMemorySession, setPersistentSession],
    );

    const syncFromServer = useCallback(async () => {
        setIsLoading(true);
        const versionBeforeRequest = sessionStateVersion;
        try {
            const backendSession = await getSharedSessionSync(options?.baseUrl);
            if (versionBeforeRequest === sessionStateVersion) {
                applyBackendSession(backendSession);
            }
        } catch (error) {
            console.error('Failed to refresh session:', error);
        } finally {
            setIsInitialized(true);
            setIsLoading(false);
        }
    }, [applyBackendSession, options?.baseUrl, setIsInitialized, setIsLoading]);

    const login = useCallback(
        (newSession: Session, loginOptions?: { remember?: boolean }) => {
            const remember = loginOptions?.remember ?? rememberSessionRef.current;
            sessionStateVersion += 1;
            setRememberSession(remember);
            if (remember) {
                setPersistentSession(newSession);
                setMemorySession(null);
            } else {
                setMemorySession(newSession);
                setPersistentSession(null);
            }
            // A successful sign-in response is an authoritative session result.
            setIsInitialized(true);
        },
        [setIsInitialized, setMemorySession, setPersistentSession, setRememberSession],
    );

    const logout = useCallback(async () => {
        try {
            await authSignOut({
                redirectTo: '/login',
                clientOptions: { baseUrl: options?.baseUrl },
            });
        } catch (error) {
            console.error('Failed to sign out:', error);
        } finally {
            sessionStateVersion += 1;
            setPersistentSession(null);
            setMemorySession(null);
            setIsInitialized(true);
        }
    }, [options?.baseUrl, setIsInitialized, setMemorySession, setPersistentSession]);

    const updateUser = useCallback(
        (updatedUser: Partial<User>) => {
            if (!session) return;

            sessionStateVersion += 1;
            const updatedSession = {
                ...session,
                user: { ...session.user, ...updatedUser },
            };
            if (rememberSessionRef.current) {
                setPersistentSession(updatedSession);
            } else {
                setMemorySession(updatedSession);
            }
        },
        [session, setMemorySession, setPersistentSession],
    );

    const initializeSession = useCallback(async () => {
        setIsInitialized(false);
        await syncFromServer();
    }, [setIsInitialized, syncFromServer]);

    return {
        session,
        user: session?.user ?? null,
        isAuthenticated,
        isInitialized,
        isLoading,
        login,
        logout,
        updateUser,
        refreshSession: syncFromServer,
        initializeSession,
    };
}

/**
 * Read the shared session state and perform explicit session mutations.
 *
 * This hook never fetches on mount. Mount one `useSessionBootstrap()` call near the
 * app root, then call `refreshSession()` only after a mutation that can change the
 * current user's session data (for example an organization switch or RBAC update).
 */
export function useSession(options?: SessionClientOptions): SessionState {
    const { initializeSession: _initializeSession, ...session } = useSessionController(options);
    return session;
}

/**
 * Initialize the browser session once for an application root.
 *
 * It is safe under React Strict Mode and shares its network request with an explicit
 * refresh. Protected routes should wait for `isInitialized`, not start their own fetch.
 */
export function useSessionBootstrap(options?: SessionClientOptions): SessionState {
    const controller = useSessionController(options);

    useEffect(() => {
        void controller.initializeSession();
    }, [controller.initializeSession]);

    const { initializeSession: _initializeSession, ...session } = controller;
    return session;
}
