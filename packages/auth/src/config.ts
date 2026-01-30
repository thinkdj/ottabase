// ============================================================
// @ottabase/auth - Auth.js Configuration Helpers
// ============================================================
//
// Provides helper functions to create Auth.js configurations
// optimized for Cloudflare D1 and Ottabase applications.
//
// ============================================================

import type { AuthConfig as NextAuthConfig } from '@auth/core';
import type { D1Database } from '@cloudflare/workers-types';
import { createD1AuthAdapter, createD1AuthAdapterCached } from './adapter';

/**
 * Options for creating an Ottabase Auth.js configuration
 */
export interface OttabaseAuthConfigOptions {
    /**
     * The D1 database binding from the Worker environment
     */
    d1: D1Database;

    /**
     * Auth.js providers
     * @see https://authjs.dev/getting-started/providers
     */
    providers: NextAuthConfig['providers'];

    /**
     * Session strategy
     * - "jwt": Use JSON Web Tokens (recommended for edge/serverless)
     * - "database": Store sessions in database (requires more D1 queries)
     *
     * @default "jwt"
     */
    sessionStrategy?: 'jwt' | 'database';

    /**
     * Session max age in seconds
     * @default 2592000 (30 days)
     */
    sessionMaxAge?: number;

    /**
     * Use cached adapter (recommended for production)
     * @default true
     */
    useCachedAdapter?: boolean;

    /**
     * Enable query logging
     * @default false
     */
    log?: boolean | ('query' | 'info' | 'warn' | 'error')[];

    /**
     * Custom user fields to include in auth queries
     * @example ["role", "subscriptionTier", "organizationId"]
     */
    customUserFields?: string[];

    /**
     * Error handler for adapter operations
     */
    onError?: (error: Error, operation: string) => void;

    /**
     * Additional Auth.js configuration options
     * These will be merged with the generated configuration
     */
    authConfig?: Partial<Omit<NextAuthConfig, 'adapter' | 'providers'>>;
}

/**
 * Create an Auth.js configuration optimized for Cloudflare D1
 *
 * This helper creates a complete Auth.js configuration with:
 * - D1 adapter using @ottabase/cf for consistent client creation
 * - Sensible defaults for edge/serverless environments
 * - Optional session strategy configuration
 *
 * @param options - Configuration options
 * @returns A complete Auth.js configuration object
 *
 * @example
 * ```typescript
 * // app/auth.ts
 * import NextAuth from "next-auth";
 * import Google from "next-auth/providers/google";
 * import { createOttabaseAuthConfig } from "@ottabase/auth/config";
 *
 * export const { handlers, auth, signIn, signOut } = NextAuth((request) => {
 *   const env = request?.env || process.env;
 *
 *   return createOttabaseAuthConfig({
 *     d1: env.OBCF_D1,
 *     providers: [
 *       Google({
 *         clientId: env.GOOGLE_CLIENT_ID,
 *         clientSecret: env.GOOGLE_CLIENT_SECRET,
 *       }),
 *     ],
 *   });
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With database sessions
 * createOttabaseAuthConfig({
 *   d1: env.OBCF_D1,
 *   providers: [Google({ ... })],
 *   sessionStrategy: "database",
 *   sessionMaxAge: 86400, // 1 day
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With custom Auth.js options
 * createOttabaseAuthConfig({
 *   d1: env.OBCF_D1,
 *   providers: [Google({ ... })],
 *   authConfig: {
 *     pages: {
 *       signIn: "/login",
 *       error: "/error",
 *     },
 *     callbacks: {
 *       async jwt({ token, user }) {
 *         if (user) {
 *           token.id = user.id;
 *         }
 *         return token;
 *       },
 *     },
 *   },
 * });
 * ```
 */
export function createOttabaseAuthConfig(options: OttabaseAuthConfigOptions): NextAuthConfig {
    const {
        d1,
        providers,
        sessionStrategy = 'jwt',
        sessionMaxAge = 30 * 24 * 60 * 60, // 30 days
        useCachedAdapter = true,
        log = false,
        customUserFields,
        onError,
        authConfig = {},
    } = options;

    // Create the D1 adapter
    const adapter = useCachedAdapter
        ? createD1AuthAdapterCached(d1, { log, customUserFields, onError })
        : createD1AuthAdapter(d1, { log, customUserFields, onError });

    // Build the complete Auth.js configuration
    const config: NextAuthConfig = {
        // Use the D1 adapter
        adapter,

        // Configure providers
        providers,

        // Session configuration
        session: {
            strategy: sessionStrategy,
            maxAge: sessionMaxAge,
            updateAge: sessionMaxAge / 10, // Update session every 10% of maxAge
        },

        // Merge with any additional configuration
        ...authConfig,
    };

    return config;
}

/**
 * Create a minimal Auth.js configuration for development
 *
 * This helper creates a simpler configuration suitable for development
 * with JWT sessions and logging enabled.
 *
 * @param d1 - The D1 database binding
 * @param providers - Auth.js providers
 * @returns A development-focused Auth.js configuration
 *
 * @example
 * ```typescript
 * import { createOttabaseAuthConfigDev } from "@ottabase/auth/config";
 *
 * export const { handlers, auth } = NextAuth(
 *   createOttabaseAuthConfigDev(env.OBCF_D1, [
 *     Google({ ... }),
 *   ])
 * );
 * ```
 */
export function createOttabaseAuthConfigDev(d1: D1Database, providers: NextAuthConfig['providers']): NextAuthConfig {
    return createOttabaseAuthConfig({
        d1,
        providers,
        sessionStrategy: 'jwt',
        useCachedAdapter: false,
        log: ['error', 'warn'],
    });
}
