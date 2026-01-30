// ============================================================
// @ottabase/auth - Session Utilities
// ============================================================
//
// Helper functions for managing user sessions and authentication
// state in Ottabase applications.
//
// ============================================================

import type { Session } from '@auth/core/types';

/**
 * User session data
 * Extends the default Auth.js session with common fields
 */
export interface OttabaseSession extends Session {
    user: {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        emailVerified?: Date | null;
    };
}

/**
 * Check if a session exists and is valid
 *
 * @param session - The session to check
 * @returns True if the session is valid
 *
 * @example
 * ```typescript
 * import { isAuthenticated } from "@ottabase/auth/session";
 *
 * const session = await auth();
 * if (isAuthenticated(session)) {
 *   // User is logged in
 *   console.log(session.user.email);
 * }
 * ```
 */
export function isAuthenticated(session: Session | null): session is OttabaseSession {
    return session !== null && !!session.user && !!session.user.id;
}

/**
 * Require authentication, throw error if not authenticated
 *
 * @param session - The session to check
 * @returns The validated session
 * @throws Error if not authenticated
 *
 * @example
 * ```typescript
 * import { requireAuth } from "@ottabase/auth/session";
 *
 * const session = requireAuth(await auth());
 * // session.user.id is guaranteed to exist here
 * ```
 */
export function requireAuth(session: Session | null): OttabaseSession {
    if (!isAuthenticated(session)) {
        throw new Error('Authentication required');
    }
    return session;
}

/**
 * Get the current user ID from a session
 *
 * @param session - The session to extract the user ID from
 * @returns The user ID, or null if not authenticated
 *
 * @example
 * ```typescript
 * import { getUserId } from "@ottabase/auth/session";
 *
 * const userId = getUserId(await auth());
 * if (userId) {
 *   // User is logged in
 *   // const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
 * }
 * ```
 */
export function getUserId(session: Session | null): string | null {
    return isAuthenticated(session) ? session.user.id : null;
}

/**
 * Get the current user email from a session
 *
 * @param session - The session to extract the email from
 * @returns The user email, or null if not authenticated or no email
 *
 * @example
 * ```typescript
 * import { getUserEmail } from "@ottabase/auth/session";
 *
 * const email = getUserEmail(await auth());
 * if (email) {
 *   console.log(`User email: ${email}`);
 * }
 * ```
 */
export function getUserEmail(session: Session | null): string | null {
    return isAuthenticated(session) ? (session.user.email ?? null) : null;
}

/**
 * Check if the current user has a verified email
 *
 * @param session - The session to check
 * @returns True if the user has a verified email
 *
 * @example
 * ```typescript
 * import { hasVerifiedEmail } from "@ottabase/auth/session";
 *
 * const session = await auth();
 * if (hasVerifiedEmail(session)) {
 *   // User's email is verified
 * }
 * ```
 */
export function hasVerifiedEmail(session: Session | null): boolean {
    return isAuthenticated(session) && !!session.user.emailVerified;
}

/**
 * Session data for API responses
 */
export interface SessionData {
    authenticated: boolean;
    user: {
        id: string;
        name?: string | null;
        email?: string | null;
        image?: string | null;
        emailVerified?: Date | null;
    } | null;
}

/**
 * Convert a session to a serializable format for API responses
 *
 * @param session - The session to serialize
 * @returns Serializable session data
 *
 * @example
 * ```typescript
 * import { serializeSession } from "@ottabase/auth/session";
 *
 * export async function GET() {
 *   const session = await auth();
 *   return Response.json(serializeSession(session));
 * }
 * ```
 */
export function serializeSession(session: Session | null): SessionData {
    if (!isAuthenticated(session)) {
        return {
            authenticated: false,
            user: null,
        };
    }

    return {
        authenticated: true,
        user: {
            id: session.user.id,
            name: session.user.name ?? null,
            email: session.user.email ?? null,
            image: session.user.image ?? null,
            emailVerified: session.user.emailVerified ?? null,
        },
    };
}
