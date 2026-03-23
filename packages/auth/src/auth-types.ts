import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import type { ProviderEnv } from './providers';

/**
 * Environment interface for auth handler
 * Your CloudflareEnv should extend this
 */
export interface AuthEnv extends ProviderEnv {
    AUTH_SECRET?: string;
    AUTH_URL?: string;
    NEXTAUTH_URL?: string;
    ENVIRONMENT?: string;
    OBCF_D1?: D1Database;
    OBCF_KV?: KVNamespace;
}

/**
 * Options for credentials authorization callback
 */
export interface CredentialsAuthorizeOptions {
    /**
     * Custom authorization function
     * Return user object on success, null on failure
     */
    authorize?: (credentials: Record<string, unknown>) => Promise<{
        id: string;
        email: string;
        name?: string;
        [key: string]: any;
    } | null>;

    /**
     * Minimum password length (default: 6)
     */
    minPasswordLength?: number;

    /**
     * Require verified email for credentials sign-in
     */
    requireVerifiedEmail?: boolean;
}
