// ============================================================
// @ottabase/auth - React Session Hooks
// ============================================================

import { atom, useAtom, useAtomValue, type Getter } from 'jotai';
import { atomWithStorage, RESET } from 'jotai/utils';
import { useCallback, useEffect, useRef } from 'react';
import {
    signOut as authSignOut,
    getSession as getAuthSession,
    type AuthSession,
    type SessionFetchResult,
    type SessionUnavailable,
} from './client-api';

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
    /** Set only when the session could not be verified; anonymous sessions are not errors. */
    sessionError: SessionUnavailable | null;
    login: (newSession: Session, loginOptions?: { remember?: boolean }) => void;
    logout: () => Promise<void>;
    updateUser: (updatedUser: Partial<User>) => void;
    refreshSession: () => Promise<SessionFetchResult>;
}

/** localStorage key for session persistence */
export const AUTH_STORAGE_KEY = 'ottabase.auth-session';
/** Browser event emitted after logout, revocation, or an API-level 401. */
export const AUTH_SESSION_INVALIDATED_EVENT = 'ottabase:auth-session-invalidated';

/** Clear persisted auth material and notify the mounted session root and app caches. */
export function invalidateAuthSession(): void {
    try {
        localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
        // ignore
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_SESSION_INVALIDATED_EVENT));
    }
}

const persistentSessionAtom = atomWithStorage<Session | null>(AUTH_STORAGE_KEY, null);
const memorySessionAtom = atom<Session | null>(null);
const rememberSessionAtom = atom(true);
const authLoadingAtom = atom(false);
const authInitializedAtom = atom(false);
const authErrorAtom = atom<SessionUnavailable | null>(null);

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

/** Strict Mode bootstrap effects share one request; explicit refreshes always start fresh. */
let bootstrapSyncPromise: Promise<SessionFetchResult> | null = null;
let bootstrapSyncKey: string | null = null;
/** Prevents a pre-login/logout request from overwriting a newer local session mutation. */
let sessionStateVersion = 0;
/** Only the newest started session request may commit its result. */
let sessionRequestSequence = 0;
let latestSessionRequest = 0;

function getSharedBootstrapSync(baseUrl?: string): Promise<SessionFetchResult> {
    const syncKey = baseUrl ?? null;
    if (bootstrapSyncPromise && bootstrapSyncKey === syncKey) return bootstrapSyncPromise;

    const request = getAuthSession({ baseUrl });
    bootstrapSyncPromise = request;
    bootstrapSyncKey = syncKey;

    const clearIfCurrent = () => {
        if (bootstrapSyncPromise === request) {
            bootstrapSyncPromise = null;
            bootstrapSyncKey = null;
        }
    };
    void request.then(clearIfCurrent, clearIfCurrent);

    return request;
}

type SessionController = SessionState & {
    initializeSession: () => Promise<void>;
    clearSession: () => void;
};

function useSessionController(options?: SessionClientOptions): SessionController {
    const [, setPersistentSession] = useAtom(persistentSessionAtom);
    const [, setMemorySession] = useAtom(memorySessionAtom);
    const [rememberSession, setRememberSession] = useAtom(rememberSessionAtom);
    const session = useAtomValue(activeSessionAtom);
    const [isLoading, setIsLoading] = useAtom(authLoadingAtom);
    const [isInitialized, setIsInitialized] = useAtom(authInitializedAtom);
    const [sessionError, setSessionError] = useAtom(authErrorAtom);
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
                    setPersistentSession(RESET);
                }
            } else {
                // The backend is authoritative for revoked, expired, and signed-out sessions.
                setPersistentSession(RESET);
                setMemorySession(null);
            }
        },
        [setMemorySession, setPersistentSession],
    );

    const clearSession = useCallback(() => {
        sessionStateVersion += 1;
        latestSessionRequest = ++sessionRequestSequence;
        setPersistentSession(RESET);
        setMemorySession(null);
        setSessionError(null);
        setIsInitialized(true);
        setIsLoading(false);
    }, [setIsInitialized, setIsLoading, setMemorySession, setPersistentSession, setSessionError]);

    const syncFromServer = useCallback(
        async (mode: 'bootstrap' | 'refresh'): Promise<SessionFetchResult> => {
            const requestId = ++sessionRequestSequence;
            latestSessionRequest = requestId;
            const versionBeforeRequest = sessionStateVersion;
            setIsLoading(true);

            const result =
                mode === 'bootstrap'
                    ? await getSharedBootstrapSync(options?.baseUrl)
                    : await getAuthSession({ baseUrl: options?.baseUrl });

            if (requestId === latestSessionRequest && versionBeforeRequest === sessionStateVersion) {
                if (result.state === 'authenticated') {
                    applyBackendSession(result.session);
                    setSessionError(null);
                } else if (result.state === 'anonymous') {
                    applyBackendSession(null);
                    setSessionError(null);
                } else {
                    // Preserve the last confirmed session during outages, but surface
                    // that it could not be revalidated so route guards can fail closed.
                    setSessionError(result);
                }
            }

            if (requestId === latestSessionRequest) {
                setIsInitialized(true);
                setIsLoading(false);
            }
            return result;
        },
        [applyBackendSession, options?.baseUrl, setIsInitialized, setIsLoading, setSessionError],
    );

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
                setPersistentSession(RESET);
            }
            // A successful sign-in response is an authoritative session result.
            setSessionError(null);
            setIsInitialized(true);
        },
        [setIsInitialized, setMemorySession, setPersistentSession, setRememberSession, setSessionError],
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
            clearSession();
            invalidateAuthSession();
        }
    }, [clearSession, options?.baseUrl]);

    const updateUser = useCallback(
        (updatedUser: Partial<User>) => {
            const mergeIntoCurrentSession = (currentSession: Session | null): Session | null => {
                if (!currentSession) return currentSession;

                sessionStateVersion += 1;
                return {
                    ...currentSession,
                    user: { ...currentSession.user, ...updatedUser },
                };
            };

            if (rememberSessionRef.current) {
                setPersistentSession(mergeIntoCurrentSession);
            } else {
                setMemorySession(mergeIntoCurrentSession);
            }
        },
        [setMemorySession, setPersistentSession],
    );

    const initializeSession = useCallback(async () => {
        setIsInitialized(false);
        await syncFromServer('bootstrap');
    }, [setIsInitialized, syncFromServer]);

    const refreshSession = useCallback(() => syncFromServer('refresh'), [syncFromServer]);

    return {
        session,
        user: session?.user ?? null,
        isAuthenticated,
        isInitialized,
        isLoading,
        sessionError,
        login,
        logout,
        updateUser,
        refreshSession,
        initializeSession,
        clearSession,
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
    const {
        initializeSession: _initializeSession,
        clearSession: _clearSession,
        ...session
    } = useSessionController(options);
    return session;
}

/**
 * Initialize the browser session once for an application root.
 *
 * It is safe under React Strict Mode. Bootstrap effects share their request; explicit
 * refreshes are always newer requests. Protected routes should wait for `isInitialized`.
 */
export function useSessionBootstrap(options?: SessionClientOptions): SessionState {
    const controller = useSessionController(options);

    useEffect(() => {
        void controller.initializeSession();
    }, [controller.initializeSession]);

    useEffect(() => {
        const invalidate = () => controller.clearSession();
        window.addEventListener(AUTH_SESSION_INVALIDATED_EVENT, invalidate);
        return () => window.removeEventListener(AUTH_SESSION_INVALIDATED_EVENT, invalidate);
    }, [controller.clearSession]);

    const { initializeSession: _initializeSession, clearSession: _clearSession, ...session } = controller;
    return session;
}
