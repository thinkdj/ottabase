// ============================================================
// @ottabase/auth - Session Utilities
// ============================================================
//
// Pure helper functions for reading authentication state out of a
// `Session` object. No I/O -- see `session-store.ts` for verifying a
// request's session cookie.
//
// ============================================================

import type { Session } from './types';

export type { Session, SessionUser } from './types';

export function isAuthenticated(session: Session | null): session is Session {
    return session !== null && !!session.user && !!session.user.id;
}

export function requireAuth(session: Session | null): Session {
    if (!isAuthenticated(session)) {
        throw new Error('Authentication required');
    }
    return session;
}

export function getUserId(session: Session | null): string | null {
    return isAuthenticated(session) ? session.user.id : null;
}

export function getUserEmail(session: Session | null): string | null {
    return isAuthenticated(session) ? (session.user.email ?? null) : null;
}

export function hasVerifiedEmail(session: Session | null): boolean {
    return isAuthenticated(session) && !!session.user.emailVerified;
}

export interface SessionData {
    authenticated: boolean;
    user: {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        emailVerified?: number | null;
        organizationId?: string | null;
        roles?: string[];
        permissions?: string[];
    } | null;
}

/** Convert a session to a serializable shape for API responses. */
export function serializeSession(session: Session | null): SessionData {
    if (!isAuthenticated(session)) {
        return { authenticated: false, user: null };
    }

    return {
        authenticated: true,
        user: {
            id: session.user.id,
            name: session.user.name ?? null,
            email: session.user.email ?? null,
            image: session.user.image ?? null,
            emailVerified: session.user.emailVerified ?? null,
            organizationId: session.user.organizationId ?? null,
            roles: session.user.roles ?? undefined,
            permissions: session.user.permissions ?? undefined,
        },
    };
}
