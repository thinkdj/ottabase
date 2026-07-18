// ============================================================
// @ottabase/auth - Shared Type Definitions
// ============================================================

import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import type { ProviderEnv } from './providers/types';

/** A normalized, authenticated user as embedded in a session. */
export interface SessionUser {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    emailVerified?: number | null;
    organizationId?: string | null;
    roles?: string[];
    permissions?: string[];
    /**
     * True when the user is a PLATFORM administrator — derived server-side from a SYSTEM-scoped
     * `platform:admin`/'*:*' grant, never from a role name or an org-scoped grant. Drives the
     * platform-only sections of the admin UI; the server enforces the same boundary independently.
     */
    platformAdmin?: boolean;
    createdAt?: number | null;
    [key: string]: unknown;
}

/** The session shape returned by `getSession()` and `GET /api/auth/session`. */
export interface Session {
    user: SessionUser;
    /** Epoch milliseconds. */
    expires: number;
}

/** Claims embedded in the signed session JWT. */
export interface SessionTokenPayload extends Record<string, unknown> {
    /** Subject -- the user id. */
    sub: string;
    /** Session id, used as the KV revocation-registry key. */
    jti: string;
    email: string;
    name?: string | null;
    image?: string | null;
    emailVerified?: number | null;
    organizationId?: string | null;
    createdAt?: number | null;
    /** Mirrors the KV profile-version counter at the time the session was issued/refreshed. */
    profileVersion?: number;
    /** Session creation time in epoch MILLISECONDS. `iat` is only second-granular; `cms` is
     *  used for the bulk-revocation comparison so a session reissued in the same second as a
     *  revoke-all is not wrongly invalidated when its KV snapshot has not yet propagated. */
    cms?: number;
    iat?: number;
    exp?: number;
}

/** Cloudflare bindings + environment variables consumed by the auth backend. */
export interface AuthEnv extends ProviderEnv {
    AUTH_SECRET?: string;
    /** Explicit opt-in to the insecure built-in dev secret (only honored in a dev ENVIRONMENT). */
    AUTH_ALLOW_INSECURE_DEV_SECRET?: string;
    AUTH_URL?: string;
    AUTH_COOKIE_NAME?: string;
    ENVIRONMENT?: string;
    OBCF_D1?: D1Database;
    OBCF_KV?: KVNamespace;
    AUTH_DISABLE_CREDENTIALS?: string;
    AUTH_REQUIRE_EMAIL_VERIFIED?: string;
    AUTH_SESSION_MAX_AGE?: string;
    ALLOW_NULL_TENANT?: string;
    MULTI_TENANT_ENABLED?: string;
    APP_ID?: string;
}

/** A user object returned by a successful credentials `authorize` callback. */
export interface AuthorizedUser {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    emailVerified?: number | null;
}

export interface CredentialsAuthorizeOptions {
    authorize?: (credentials: { email: string; password: string }) => Promise<AuthorizedUser | null>;
    /** Minimum password length accepted at the credentials endpoint (default: 6). */
    minPasswordLength?: number;
    requireVerifiedEmail?: boolean;
}

/** Options accepted by `handleAuthRequest` / `getSession`. */
export interface CreateAuthConfigOptions extends CredentialsAuthorizeOptions {
    sessionMaxAge?: number;
    disableCredentials?: boolean;
    authConfig?: {
        pages?: {
            signIn?: string;
            error?: string;
        };
    };
    /** Called after a user signs out (session revoked). Use to clear app-level caches. */
    onSignOut?: (userId: string) => Promise<void> | void;
    /** Called right after a session is created (sign-in, register+auto-login, magic link, OAuth). */
    onSignIn?: (params: { userId: string; email?: string | null }) => Promise<void> | void;
}
