// ============================================================
// @ottabase/auth - Backend Request Handler
// ============================================================
//
// Production-ready Auth.js request handler for Cloudflare Workers.
// This module provides plug-and-play authentication for any Worker.
//
// Usage in cloudflare-worker.ts:
//   import { handleAuthRequest } from "@ottabase/auth/backend";
//
//   if (url.pathname.startsWith("/api/auth/")) {
//     return handleAuthRequest(request, env);
//   }
//
// ============================================================

import { Auth, type AuthConfig } from '@auth/core';
import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { userKey } from '@ottabase/cf/cache-keys';
import { bootstrapFirstUser, parseBooleanFlag, SYSTEM_ORGANIZATION_ID } from './bootstrap';
import { createOttabaseAuthConfig } from './config';
import type { ProviderEnv } from './providers';
import {
    autoConfigureProviders,
    createCredentialsProvider,
    createNodemailerProvider,
    createResendProvider,
} from './providers';

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
    authorize?: (credentials: { email: string; password: string }) => Promise<{
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

/**
 * Default credentials authorization (demo/placeholder)
 * In production, override with your own validation logic
 */
async function defaultCredentialsAuthorize(
    credentials: { email: string; password: string },
    env: AuthEnv,
    options?: CredentialsAuthorizeOptions,
): Promise<any> {
    const email = typeof credentials.email === 'string' ? credentials.email.trim().toLowerCase() : '';
    const password = typeof credentials.password === 'string' ? credentials.password : '';
    const minLength = options?.minPasswordLength ?? 6;

    if (!email || !password) {
        return null;
    }

    // Validate password length (avoid leaking details)
    if (password.length < minLength) {
        return null;
    }

    if (!env.OBCF_D1) {
        throw new Error('OBCF_D1 database binding is required for credentials authentication');
    }

    let result: any | null = null;
    try {
        result = await env.OBCF_D1.prepare(
            `SELECT id, name, email, image, email_verified, password_hash
                 FROM users
                 WHERE email = ?`,
        )
            .bind(email)
            .first<any>();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('no such column: email_verified') || message.includes('no such column: password_hash')) {
            throw new Error('Missing auth columns on users table. Run /api/ottaorm/init to apply migrations.');
        }
        throw error;
    }

    if (!result || !result.password_hash) {
        if (result && !result.password_hash) {
            console.warn('Credentials sign-in failed: user has no password_hash (OAuth-only or missing migration).');
        }
        return null;
    }

    const valid = await verifyPassword(password, String(result.password_hash));
    if (!valid) {
        return null;
    }

    const emailVerifiedMs = result.email_verified ? Number(result.email_verified) : null;
    if (options?.requireVerifiedEmail && !emailVerifiedMs) {
        return null;
    }

    return {
        id: result.id,
        email: result.email,
        name: result.name ?? undefined,
        image: result.image ?? undefined,
        emailVerified: emailVerifiedMs,
    };
}

/**
 * Options for creating auth configuration
 */
export interface CreateAuthConfigOptions extends CredentialsAuthorizeOptions {
    /**
     * Session strategy
     * - "jwt": Use JSON Web Tokens (recommended for edge/serverless)
     * - "database": Store sessions in database (requires more D1 queries)
     */
    sessionStrategy?: 'jwt' | 'database';

    /**
     * Session max age in seconds (default: 30 days)
     */
    sessionMaxAge?: number;

    /**
     * Additional Auth.js config options
     */
    authConfig?: Partial<Omit<AuthConfig, 'adapter' | 'providers'>>;

    /**
     * Enable verbose logging
     */
    verbose?: boolean;

    /**
     * Disable credentials provider entirely
     */
    disableCredentials?: boolean;

    /**
     * Called after a user signs out. Use this to clear app-level caches
     * (e.g., RBAC) without overriding the core signOut event.
     */
    onSignOut?: (userId: string) => Promise<void> | void;
}

/**
 * Create Auth.js configuration with auto-configured providers
 * This is the core function that sets up authentication
 */
export function createAuthConfig(env: AuthEnv, options?: CreateAuthConfigOptions): AuthConfig {
    const verbose = options?.verbose ?? false;
    const envDisableCredentials =
        (env as any).AUTH_DISABLE_CREDENTIALS === 'true' || (env as any).AUTH_DISABLE_CREDENTIALS === '1';
    const disableCredentials = options?.disableCredentials ?? envDisableCredentials;
    const envRequireVerified =
        (env as any).AUTH_REQUIRE_EMAIL_VERIFIED === 'true' || (env as any).AUTH_REQUIRE_EMAIL_VERIFIED === '1';
    const requireVerifiedEmail = options?.requireVerifiedEmail ?? envRequireVerified;
    const envSessionMaxAge = Number((env as any).AUTH_SESSION_MAX_AGE);
    const sessionMaxAge =
        options?.sessionMaxAge ??
        (Number.isFinite(envSessionMaxAge) && envSessionMaxAge > 0 ? envSessionMaxAge : undefined);
    const sessionStrategy = options?.sessionStrategy ?? 'jwt';
    const allowNullTenant = parseBooleanFlag((env as any).ALLOW_NULL_TENANT);

    if (!env.OBCF_D1) {
        throw new Error('OBCF_D1 database binding is required for authentication');
    }

    if (!env.AUTH_SECRET) {
        const environment = (env.ENVIRONMENT || '').toLowerCase();
        const isProduction = environment !== '' && !['development', 'dev', 'test'].includes(environment);

        if (isProduction) {
            throw new Error('AUTH_SECRET is required in production');
        }

        console.warn('⚠️  AUTH_SECRET is not configured. Using default (INSECURE FOR PRODUCTION!)');
    }

    const providers: any[] = [];

    // Auto-configure OAuth providers
    const oauthProviders = autoConfigureProviders(env);
    providers.push(...oauthProviders);

    if (verbose && oauthProviders.length > 0) {
        console.log(`✅ OAuth providers: ${oauthProviders.map((p: any) => p.id).join(', ')}`);
    } else if (verbose) {
        console.warn('⚠️  No OAuth providers configured');
    }

    // Configure email provider (magic link)
    if (env.EMAIL_SERVER && env.EMAIL_FROM) {
        providers.push(createNodemailerProvider(env));
        if (verbose) console.log('✅ Magic Link via SMTP enabled');
    } else if (env.EMAIL_RESEND_API_KEY) {
        providers.push(createResendProvider(env));
        if (verbose) console.log('✅ Magic Link via Resend enabled');
    } else if (verbose) {
        console.warn('⚠️  Magic Link not configured');
    }

    if (!disableCredentials) {
        providers.push(
            createCredentialsProvider(async (credentials: any) => {
                if (options?.authorize) {
                    return options.authorize(credentials);
                }
                return defaultCredentialsAuthorize(credentials, env, {
                    ...options,
                    requireVerifiedEmail,
                });
            }),
        );

        if (verbose) console.log('✅ Credentials authentication enabled');
    } else if (verbose) {
        console.warn('⚠️  Credentials authentication disabled');
    }

    // Create the auth configuration
    // Determine the frontend URL for redirects
    // In development, use AUTH_URL env var or default to localhost:3003 (frontend)
    // In production, this should be your public frontend URL
    const authUrl = env.AUTH_URL || env.NEXTAUTH_URL || 'http://127.0.0.1:3003';

    const config = createOttabaseAuthConfig({
        d1: env.OBCF_D1,
        providers,
        sessionStrategy,
        sessionMaxAge: sessionMaxAge ?? 30 * 24 * 60 * 60, // 30 days
        authConfig: {
            secret: env.AUTH_SECRET || 'dev-secret-change-in-production',
            /**
             * trustHost:
             *   Cloudflare Workers and other edge runtimes often require `trustHost: true`
             *   because the framework cannot reliably infer the public origin from the
             *   incoming request (e.g. behind proxies / custom domains). In those
             *   environments, Auth.js host checks would otherwise fail.
             *
             *   Security note:
             *   - Enabling `trustHost` bypasses Auth.js' built‑in host validation and
             *     makes this handler trust the host information provided by the platform.
             *   - If your Cloudflare route / custom domain configuration is misconfigured
             *     or if arbitrary Host headers are allowed to reach the Worker, this can
             *     enable host‑header based attacks.
             *
             *   Recommended hardening:
             *   - Configure a canonical external URL for your deployment (e.g. via
             *     an `AUTH_URL`/`NEXTAUTH_URL` or similar env var at the application
             *     level) and ensure Cloudflare only routes from trusted hostnames.
             *   - Do NOT expose this Worker on untrusted / wildcard hosts without
             *     additional protections.
             *
             *   Overrides / alternatives:
             *   - If your environment does not require bypassing host checks, you can
             *     override this setting via `options.authConfig.trustHost = false` and
             *     configure Auth.js with an explicit `url` / allowed hosts.
             */
            trustHost: true,
            callbacks: {
                async signIn({ user, account }) {
                    if (!env.OBCF_D1) return true;
                    if (!user?.id || !account?.provider) return true;

                    // Auto-mark verified for OAuth providers (non-credentials)
                    if (account.provider !== 'credentials') {
                        try {
                            await env.OBCF_D1.prepare(
                                `UPDATE users SET email_verified = ? WHERE id = ? AND (email_verified IS NULL OR email_verified = '')`,
                            )
                                .bind(Date.now(), user.id)
                                .run();
                        } catch (error) {
                            console.warn('Failed to auto-verify OAuth user email:', error);
                        }
                    }

                    await bootstrapFirstUser(env, user as any);

                    return true;
                },
                async redirect({ url, baseUrl }) {
                    // Ensure redirects go to the frontend URL, not the backend
                    // If url is relative, make it absolute using the frontend baseUrl
                    if (url.startsWith('/')) {
                        return `${authUrl}${url}`;
                    }
                    // If url is already absolute but points to backend, replace with frontend
                    if (url.startsWith('http://127.0.0.1:3004') || url.startsWith('http://localhost:3004')) {
                        return url.replace(/:\d+/, ':3003');
                    }
                    // Otherwise, use the url as-is if it's already pointing to frontend or external
                    return url;
                },
                async jwt({ token, user }) {
                    if (!env.OBCF_D1) {
                        return token;
                    }

                    // Ensure token has stable identifiers for revocation checks
                    if (!token.jti) {
                        token.jti = crypto.randomUUID();
                    }
                    if (!token.issuedAt) {
                        token.issuedAt = Math.floor(Date.now() / 1000);
                    }

                    // Check for user-level revocation (logout / password reset)
                    if (env.OBCF_KV && token.id) {
                        try {
                            const revokedAtRaw = await env.OBCF_KV.get(userKey('auth', String(token.id), 'revoked'));
                            if (revokedAtRaw) {
                                const revokedAt = Number(revokedAtRaw);
                                const issuedAt = Number(token.issuedAt || 0);
                                if (Number.isFinite(revokedAt) && issuedAt > 0 && issuedAt <= revokedAt) {
                                    return null;
                                }
                            }
                        } catch (error) {
                            console.warn('Failed to check session revocation:', error);
                        }
                    }

                    async function loadUserContext(userId: string) {
                        const d1 = env.OBCF_D1;
                        if (!d1) {
                            return { organizationId: null, roles: [], permissions: [] };
                        }

                        let organizationId: string | null = null;
                        let roles: string[] = [];
                        let permissions: string[] = [];
                        let createdAt: number | null = null;

                        try {
                            const membership = await d1
                                .prepare(
                                    `SELECT organization_id as organizationId
                                 FROM organization_members
                                 WHERE user_id = ? AND status = 'active'
                                 ORDER BY joined_at ASC
                                 LIMIT 1`,
                                )
                                .bind(userId)
                                .first<any>();

                            if (membership?.organizationId) {
                                organizationId = membership.organizationId;
                            }
                        } catch (error) {
                            console.warn('Failed to load organization membership for auth:', error);
                        }

                        if (!organizationId && allowNullTenant) {
                            try {
                                const systemRole = await d1
                                    .prepare(
                                        `SELECT 1 FROM user_roles WHERE user_id = ? AND organization_id = ? LIMIT 1`,
                                    )
                                    .bind(userId, SYSTEM_ORGANIZATION_ID)
                                    .first<any>();

                                if (systemRole) {
                                    organizationId = SYSTEM_ORGANIZATION_ID;
                                }
                            } catch (error) {
                                console.warn('Failed to detect system-scope roles for auth:', error);
                            }
                        }

                        if (organizationId) {
                            try {
                                const roleResult = await d1
                                    .prepare(
                                        `SELECT r.name as name, r.permissions as permissions
                                     FROM user_roles ur
                                     JOIN roles r ON r.id = ur.role_id
                                     WHERE ur.user_id = ? AND ur.organization_id = ?`,
                                    )
                                    .bind(userId, organizationId)
                                    .all<any>();

                                roles = (roleResult?.results || []).map((row: any) => String(row.name)).filter(Boolean);

                                const permissionsSet = new Set<string>();
                                for (const row of roleResult?.results || []) {
                                    try {
                                        const parsed = row.permissions ? JSON.parse(String(row.permissions)) : [];
                                        if (Array.isArray(parsed)) {
                                            parsed.forEach((perm) => permissionsSet.add(String(perm)));
                                        }
                                    } catch {
                                        // ignore bad permissions
                                    }
                                }

                                permissions = Array.from(permissionsSet);
                            } catch (error) {
                                console.warn('Failed to load user roles for auth:', error);
                            }
                        }

                        try {
                            const profile = await d1
                                .prepare(
                                    `SELECT created_at as createdAt
                                 FROM users
                                 WHERE id = ?
                                 LIMIT 1`,
                                )
                                .bind(userId)
                                .first<any>();
                            if (profile?.createdAt) {
                                const parsed = Number(profile.createdAt);
                                createdAt = Number.isFinite(parsed) ? parsed : null;
                            }
                        } catch (error) {
                            console.warn('Failed to load user profile for auth:', error);
                        }

                        return { organizationId, roles, permissions, createdAt };
                    }

                    async function refreshProfileIfNeeded(userId: string) {
                        if (!env.OBCF_D1 || !env.OBCF_KV) return;
                        try {
                            const profileVersionKey = userKey('auth', userId, 'profile', 'version');
                            const versionRaw = await env.OBCF_KV.get(profileVersionKey);
                            if (!versionRaw) return;

                            const version = Number(versionRaw);
                            const tokenVersion = Number((token as any).profileVersion || 0);
                            if (!Number.isFinite(version) || version <= tokenVersion) {
                                return;
                            }

                            const dbUser = await env.OBCF_D1.prepare(
                                `SELECT name, email, image, email_verified as emailVerified, created_at as createdAt FROM users WHERE id = ? LIMIT 1`,
                            )
                                .bind(userId)
                                .first<any>();

                            if (dbUser) {
                                token.name = dbUser.name ?? token.name;
                                token.email = dbUser.email ?? token.email;
                                if (dbUser.image !== undefined) {
                                    token.image = dbUser.image;
                                }
                                token.emailVerified = dbUser.emailVerified ? Number(dbUser.emailVerified) : null;
                                if (dbUser.createdAt) {
                                    const createdAtValue = Number(dbUser.createdAt);
                                    if (Number.isFinite(createdAtValue)) {
                                        token.createdAt = createdAtValue;
                                    }
                                }
                                (token as any).profileVersion = version;
                            }
                        } catch (error) {
                            console.warn('Failed to refresh profile from KV version:', error);
                        }
                    }

                    if (user && user.id) {
                        token.id = user.id;
                        token.email = user.email;
                        token.name = user.name;
                        token.image = (user as any).image ?? token.image;
                        const emailVerified = (user as any).emailVerified;
                        if (emailVerified) {
                            const emailVerifiedValue =
                                emailVerified instanceof Date
                                    ? emailVerified.getTime()
                                    : typeof emailVerified === 'number'
                                      ? emailVerified
                                      : new Date(String(emailVerified)).getTime();
                            token.emailVerified = Number.isFinite(emailVerifiedValue) ? emailVerifiedValue : null;
                        } else {
                            token.emailVerified = null;
                        }

                        const providedOrgId = (user as any).organizationId;
                        const providedRoles = (user as any).roles;
                        const providedPermissions = (user as any).permissions;

                        if (providedOrgId) {
                            token.organizationId = providedOrgId;
                        }
                        if (Array.isArray(providedRoles)) {
                            token.roles = providedRoles;
                        }
                        if (Array.isArray(providedPermissions)) {
                            token.permissions = providedPermissions;
                        }

                        if (!token.organizationId || !Array.isArray(token.roles) || !Array.isArray(token.permissions)) {
                            const context = await loadUserContext(user.id);
                            if (context.organizationId) {
                                token.organizationId = context.organizationId;
                            }
                            if (!Array.isArray(token.roles)) {
                                token.roles = context.roles;
                            }
                            if (!Array.isArray(token.permissions)) {
                                token.permissions = context.permissions;
                            }
                            if (context.createdAt) {
                                token.createdAt = context.createdAt;
                            }
                        }
                        if (env.OBCF_KV) {
                            const profileVersionKey = userKey('auth', String(user.id), 'profile', 'version');
                            const versionRaw = await env.OBCF_KV.get(profileVersionKey);
                            const version = Number(versionRaw || 0);
                            if (Number.isFinite(version)) {
                                (token as any).profileVersion = version;
                            }
                        }
                    } else if (token?.id && (!token.organizationId || !Array.isArray(token.roles))) {
                        const context = await loadUserContext(String(token.id));
                        if (context.organizationId) {
                            token.organizationId = context.organizationId;
                        }
                        if (!Array.isArray(token.roles)) {
                            token.roles = context.roles;
                        }
                        if (!Array.isArray(token.permissions)) {
                            token.permissions = context.permissions;
                        }
                        if (context.createdAt) {
                            token.createdAt = context.createdAt;
                        }
                    }
                    if (token?.id) {
                        await refreshProfileIfNeeded(String(token.id));
                    }
                    return token;
                },
                async session({ session, token }) {
                    if (session.user) {
                        session.user.id = token.id as string;
                        session.user.email = token.email as string;
                        session.user.name = token.name as string;
                        if (token.image) {
                            session.user.image = token.image as string;
                        }
                        if (token.emailVerified) {
                            const emailVerified =
                                typeof token.emailVerified === 'number'
                                    ? token.emailVerified
                                    : new Date(token.emailVerified as string).getTime();
                            if (Number.isFinite(emailVerified)) {
                                session.user.emailVerified = emailVerified as any;
                            }
                        }
                        if (token.organizationId) {
                            (session.user as any).organizationId = token.organizationId as string;
                        }
                        if (token.roles) {
                            (session.user as any).roles = token.roles as string[];
                        }
                        if (token.permissions) {
                            (session.user as any).permissions = token.permissions as string[];
                        }
                        if (token.createdAt) {
                            (session.user as any).createdAt = token.createdAt;
                        }
                    }
                    if (session.expires) {
                        const expiresMs =
                            typeof session.expires === 'number' ? session.expires : new Date(session.expires).getTime();
                        if (Number.isFinite(expiresMs)) {
                            (session as any).expires = expiresMs;
                        }
                    }
                    return session;
                },
            },
            events: {
                async signOut(message: any) {
                    if (!env.OBCF_KV) return;
                    const userId =
                        message?.token?.id || message?.session?.user?.id || message?.session?.user?.id?.toString();
                    if (typeof userId !== 'string' || !userId) return;
                    try {
                        const revokedAt = Math.floor(Date.now() / 1000);
                        await env.OBCF_KV.put(userKey('auth', userId, 'revoked'), String(revokedAt), {
                            expirationTtl: sessionMaxAge ?? 30 * 24 * 60 * 60,
                        });
                    } catch (error) {
                        console.warn('Failed to revoke session on signOut:', error);
                    }
                    // App-level hook (e.g., clear RBAC cache for the user)
                    try {
                        await options?.onSignOut?.(userId);
                    } catch {
                        // Hook failure is non-fatal
                    }
                },
            },
            ...options?.authConfig,
            basePath: '/api/auth',
        },
    });

    return config;
}

/**
 * Handle Auth.js requests in Cloudflare Workers
 *
 * This is the main entry point for authentication in your Worker.
 * Call this for any request to /api/auth/*
 *
 * @example
 * ```typescript
 * // In cloudflare-worker.ts
 * import { handleAuthRequest } from "@ottabase/auth/backend";
 *
 * if (url.pathname.startsWith("/api/auth/")) {
 *   return handleAuthRequest(request, env);
 * }
 * ```
 */
export async function handleAuthRequest(
    request: Request,
    env: AuthEnv,
    options?: CreateAuthConfigOptions,
): Promise<Response> {
    try {
        const config = createAuthConfig(env, options);
        return await Auth(request, config);
    } catch (error) {
        console.error('Auth request error:', error);
        return new Response(
            JSON.stringify({
                error: error instanceof Error ? error.message : 'Authentication error',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    }
}

/**
 * Get session from request
 *
 * @example
 * ```typescript
 * const session = await getSession(request, env);
 * if (!session) {
 *   return new Response("Unauthorized", { status: 401 });
 * }
 * ```
 */
export async function getSession(request: Request, env: AuthEnv, options?: CreateAuthConfigOptions) {
    try {
        const config = createAuthConfig(env, options);

        const url = new URL(request.url);
        url.pathname = '/api/auth/session';

        const sessionRequest = new Request(url.toString(), {
            method: 'GET',
            headers: request.headers,
        });

        const response = await Auth(sessionRequest, config);

        if (response.ok) {
            return await response.json();
        }

        return null;
    } catch (error) {
        console.error('Get session error:', error);
        return null;
    }
}

const PBKDF2_PREFIX = 'pbkdf2';
// Cloudflare Workers limits PBKDF2 to 100k iterations; OWASP recommends >= 100k for PBKDF2-SHA256
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_HASH_BYTES = 32;

function bufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    for (const byte of buffer) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
}

async function derivePbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const passwordBuffer = Uint8Array.from(passwordBytes).buffer;
    const saltBuffer = Uint8Array.from(salt).buffer;
    const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: saltBuffer,
            iterations,
            hash: 'SHA-256',
        },
        keyMaterial,
        PBKDF2_HASH_BYTES * 8,
    );
    return new Uint8Array(derivedBits);
}

/**
 * Password hashing using PBKDF2 (SHA-256)
 * Output format: pbkdf2$iterations$saltBase64$hashBase64
 */
export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
    const derived = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
    return `${PBKDF2_PREFIX}$${PBKDF2_ITERATIONS}$${bufferToBase64(salt)}$${bufferToBase64(derived)}`;
}

/**
 * Verify password against stored hash
 * Supports PBKDF2 format only.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    if (!hash) return false;

    if (hash.startsWith(`${PBKDF2_PREFIX}$`)) {
        const parts = hash.split('$');
        if (parts.length !== 4) return false;

        const iterations = Number(parts[1]);
        if (!Number.isFinite(iterations) || iterations <= 0) return false;

        const salt = base64ToBuffer(parts[2]);
        const expected = base64ToBuffer(parts[3]);
        const derived = await derivePbkdf2(password, salt, iterations);
        return timingSafeEqual(derived, expected);
    }

    return false;
}
