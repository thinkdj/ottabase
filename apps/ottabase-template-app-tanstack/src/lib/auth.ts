import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

// Types for our session
export interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role?: string;
    [key: string]: any;
}

export interface Session {
    user: User;
    expires: string;
}

// Persistent session storage using localStorage
const sessionAtom = atomWithStorage<Session | null>("auth_session", null);

// Auth loading state
const authLoadingAtom = atom(false);

// Is authenticated derived atom
const isAuthenticatedAtom = atom((get) => {
    const session = get(sessionAtom);
    if (!session) return false;

    // Check if session is expired
    const expiresAt = new Date(session.expires);
    return expiresAt > new Date();
});

export function useSession() {
    const [session, setSession] = useAtom(sessionAtom);
    const [isLoading, setIsLoading] = useAtom(authLoadingAtom);
    const [isAuthenticated] = useAtom(isAuthenticatedAtom);

    const login = (newSession: Session) => {
        setSession(newSession);
    };

    const logout = () => {
        setSession(null);
    };

    const updateUser = (updatedUser: Partial<User>) => {
        if (session) {
            setSession({
                ...session,
                user: { ...session.user, ...updatedUser },
            });
        }
    };

    return {
        session,
        user: session?.user ?? null,
        isAuthenticated,
        isLoading,
        login,
        logout,
        updateUser,
        setIsLoading,
    };
}
