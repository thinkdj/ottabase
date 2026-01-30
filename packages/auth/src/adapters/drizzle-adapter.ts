// ============================================================
// @ottabase/auth - Drizzle D1 Auth.js Adapter
// ============================================================
//
// Custom Auth.js adapter for Drizzle ORM with Cloudflare D1 support
// Implements the Auth.js Adapter interface for database operations
//
// Based on @auth/drizzle-adapter but optimized for D1 and Ottabase
//
// ============================================================

import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from '@auth/core/adapters';
import type { D1Database } from '@cloudflare/workers-types';
import type { D1Driver } from '@ottabase/db/drizzle-d1';
import { createD1Driver } from '@ottabase/db/drizzle-d1';

/**
 * Options for creating a Drizzle D1 Auth.js adapter
 */
export interface DrizzleD1AuthAdapterOptions {
    /**
     * Enable query logging
     * - `true`: Enable all log levels
     * - `false`: Disable logging
     * - Array: Specific log levels to enable
     */
    log?: boolean | ('query' | 'info' | 'warn' | 'error')[];

    /**
     * Optional custom D1Driver instance
     * If not provided, a new driver will be created
     */
    driver?: D1Driver;

    /**
     * Custom user fields to include in queries
     * These fields will be selected from the User table in addition to the standard fields
     *
     * @example ["role", "subscriptionTier", "organizationId"]
     */
    customUserFields?: string[];

    /**
     * Error handler for adapter operations
     * Called when an error occurs in any adapter method
     *
     * @param error - The error that occurred
     * @param operation - The operation that failed
     */
    onError?: (error: Error, operation: string) => void;
}

/**
 * Standard Auth.js user fields that are always selected
 */
const STANDARD_USER_FIELDS = ['id', 'name', 'email', 'emailVerified', 'image'];

/**
 * Create an Auth.js adapter for Cloudflare D1 using Drizzle ORM
 *
 * This adapter provides Auth.js database operations using Drizzle ORM
 * optimized for Cloudflare D1. It uses raw SQL queries for maximum
 * compatibility and performance with D1.
 *
 * @param d1 - The D1 database binding from the Worker environment
 * @param options - Optional configuration for the adapter
 * @returns An Auth.js compatible adapter
 *
 * @example
 * ```typescript
 * import { createDrizzleD1AuthAdapter } from "@ottabase/auth/adapters/drizzle";
 *
 * export const authConfig = {
 *   adapter: createDrizzleD1AuthAdapter(env.OBCF_D1),
 *   providers: [
 *     // Your providers
 *   ],
 * };
 * ```
 *
 * @example
 * ```typescript
 * // With logging enabled
 * const adapter = createDrizzleD1AuthAdapter(env.OBCF_D1, {
 *   log: ["query", "error"]
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With custom user fields
 * const adapter = createDrizzleD1AuthAdapter(env.OBCF_D1, {
 *   customUserFields: ["role", "subscriptionTier", "organizationId"]
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With error handling
 * const adapter = createDrizzleD1AuthAdapter(env.OBCF_D1, {
 *   onError: (error, operation) => {
 *     console.error(`Auth adapter error in ${operation}:`, error);
 *   }
 * });
 * ```
 */

/**
 * Handle errors in adapter operations
 */
function handleError(error: unknown, operation: string, onError?: (error: Error, operation: string) => void): never {
    const err = error instanceof Error ? error : new Error(String(error));

    if (onError) {
        onError(err, operation);
    }

    // Create new error with context
    const enhancedError = new Error(`Auth adapter error in ${operation}: ${err.message}`);
    throw enhancedError;
}

/**
 * Get user fields SQL selection string
 */
function getUserFieldsSQL(customFields?: string[]): string {
    const FIELD_NAME_REGEX = /^[A-Za-z0-9_]+$/;

    const fields = [...STANDARD_USER_FIELDS];

    if (customFields && customFields.length > 0) {
        for (const field of customFields) {
            if (!FIELD_NAME_REGEX.test(field)) {
                throw new Error(
                    `Invalid custom user field name "${field}". ` +
                        'Field names may only contain alphanumeric characters and underscore.',
                );
            }
            if (!fields.includes(field)) {
                fields.push(field);
            }
        }
    }
    return fields.join(', ');
}

export function createDrizzleD1AuthAdapter(d1: D1Database, options: DrizzleD1AuthAdapterOptions = {}): Adapter {
    const driver = options.driver || createD1Driver(d1, { log: options.log });
    const d1Binding = driver.getD1();
    const { customUserFields, onError } = options;
    const userFieldsSQL = getUserFieldsSQL(customUserFields);

    return {
        // ============================================================
        // USER OPERATIONS
        // ============================================================

        async createUser(user: Omit<AdapterUser, 'id'>): Promise<AdapterUser> {
            try {
                const id = crypto.randomUUID();
                const now = new Date().toISOString();

                await d1Binding
                    .prepare(
                        `INSERT INTO User (id, name, email, emailVerified, image, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    )
                    .bind(id, user.name, user.email, user.emailVerified?.toISOString() || null, user.image, now, now)
                    .run();

                return {
                    id,
                    name: user.name,
                    email: user.email,
                    emailVerified: user.emailVerified,
                    image: user.image,
                };
            } catch (error) {
                return handleError(error, 'createUser', onError);
            }
        },

        async getUser(id: string): Promise<AdapterUser | null> {
            try {
                const result = await d1Binding
                    .prepare(`SELECT ${userFieldsSQL} FROM User WHERE id = ?`)
                    .bind(id)
                    .first<AdapterUser>();

                if (!result) return null;

                return {
                    ...result,
                    emailVerified: result.emailVerified ? new Date(result.emailVerified as unknown as string) : null,
                };
            } catch (error) {
                return handleError(error, 'getUser', onError);
            }
        },

        async getUserByEmail(email: string): Promise<AdapterUser | null> {
            try {
                const result = await d1Binding
                    .prepare(`SELECT ${userFieldsSQL} FROM User WHERE email = ?`)
                    .bind(email)
                    .first<AdapterUser>();

                if (!result) return null;

                return {
                    ...result,
                    emailVerified: result.emailVerified ? new Date(result.emailVerified as unknown as string) : null,
                };
            } catch (error) {
                return handleError(error, 'getUserByEmail', onError);
            }
        },

        async getUserByAccount({
            providerAccountId,
            provider,
        }: {
            providerAccountId: string;
            provider: string;
        }): Promise<AdapterUser | null> {
            try {
                const result = await d1Binding
                    .prepare(
                        `SELECT u.${userFieldsSQL
                            .split(', ')
                            .map((f) => `u.${f}`)
                            .join(', ')}
             FROM User u
             INNER JOIN Account a ON u.id = a.userId
             WHERE a.provider = ? AND a.providerAccountId = ?`,
                    )
                    .bind(provider, providerAccountId)
                    .first<AdapterUser>();

                if (!result) return null;

                return {
                    ...result,
                    emailVerified: result.emailVerified ? new Date(result.emailVerified as unknown as string) : null,
                };
            } catch (error) {
                return handleError(error, 'getUserByAccount', onError);
            }
        },

        async updateUser(user: Partial<AdapterUser> & Pick<AdapterUser, 'id'>): Promise<AdapterUser> {
            try {
                const updates: string[] = [];
                const values: any[] = [];

                if (user.name !== undefined) {
                    updates.push('name = ?');
                    values.push(user.name);
                }
                if (user.email !== undefined) {
                    updates.push('email = ?');
                    values.push(user.email);
                }
                if (user.emailVerified !== undefined) {
                    updates.push('emailVerified = ?');
                    values.push(user.emailVerified?.toISOString() || null);
                }
                if (user.image !== undefined) {
                    updates.push('image = ?');
                    values.push(user.image);
                }

                updates.push('updatedAt = ?');
                values.push(new Date().toISOString());

                values.push(user.id);

                await d1Binding
                    .prepare(`UPDATE User SET ${updates.join(', ')} WHERE id = ?`)
                    .bind(...values)
                    .run();

                const result = await d1Binding
                    .prepare(`SELECT ${userFieldsSQL} FROM User WHERE id = ?`)
                    .bind(user.id)
                    .first<AdapterUser>();

                return {
                    ...result!,
                    emailVerified: result!.emailVerified ? new Date(result!.emailVerified as unknown as string) : null,
                };
            } catch (error) {
                return handleError(error, 'updateUser', onError);
            }
        },

        async deleteUser(userId: string): Promise<void> {
            try {
                await d1Binding.prepare(`DELETE FROM User WHERE id = ?`).bind(userId).run();
            } catch (error) {
                return handleError(error, 'deleteUser', onError);
            }
        },

        // ============================================================
        // ACCOUNT OPERATIONS
        // ============================================================

        async linkAccount(account: AdapterAccount): Promise<AdapterAccount> {
            try {
                const id = crypto.randomUUID();

                await d1Binding
                    .prepare(
                        `INSERT INTO Account (id, userId, type, provider, providerAccountId, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    )
                    .bind(
                        id,
                        account.userId,
                        account.type,
                        account.provider,
                        account.providerAccountId,
                        account.refresh_token || null,
                        account.access_token || null,
                        account.expires_at || null,
                        account.token_type || null,
                        account.scope || null,
                        account.id_token || null,
                        account.session_state || null,
                    )
                    .run();

                return { ...account, id };
            } catch (error) {
                return handleError(error, 'linkAccount', onError);
            }
        },

        async unlinkAccount({
            providerAccountId,
            provider,
        }: {
            providerAccountId: string;
            provider: string;
        }): Promise<void> {
            try {
                await d1Binding
                    .prepare(`DELETE FROM Account WHERE provider = ? AND providerAccountId = ?`)
                    .bind(provider, providerAccountId)
                    .run();
            } catch (error) {
                return handleError(error, 'unlinkAccount', onError);
            }
        },

        // ============================================================
        // SESSION OPERATIONS
        // ============================================================

        async createSession(session: { sessionToken: string; userId: string; expires: Date }): Promise<AdapterSession> {
            try {
                const id = crypto.randomUUID();

                await d1Binding
                    .prepare(
                        `INSERT INTO Session (id, sessionToken, userId, expires)
             VALUES (?, ?, ?, ?)`,
                    )
                    .bind(id, session.sessionToken, session.userId, session.expires.toISOString())
                    .run();

                return {
                    sessionToken: session.sessionToken,
                    userId: session.userId,
                    expires: session.expires,
                };
            } catch (error) {
                return handleError(error, 'createSession', onError);
            }
        },

        async getSessionAndUser(sessionToken: string): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
            try {
                const userFields = userFieldsSQL
                    .split(', ')
                    .map((f) => `u.${f} as user_${f}`)
                    .join(', ');

                const result = await d1Binding
                    .prepare(
                        `SELECT
              s.sessionToken, s.userId, s.expires,
              ${userFields}
             FROM Session s
             INNER JOIN User u ON s.userId = u.id
             WHERE s.sessionToken = ?`,
                    )
                    .bind(sessionToken)
                    .first<any>();

                if (!result) return null;

                // Check if session is expired
                if (new Date(result.expires) < new Date()) {
                    await d1Binding.prepare(`DELETE FROM Session WHERE sessionToken = ?`).bind(sessionToken).run();
                    return null;
                }

                // Extract user fields from the result
                const user: any = {};
                STANDARD_USER_FIELDS.forEach((field) => {
                    user[field] = result[`user_${field}`];
                });
                if (customUserFields) {
                    customUserFields.forEach((field) => {
                        user[field] = result[`user_${field}`];
                    });
                }

                return {
                    session: {
                        sessionToken: result.sessionToken,
                        userId: result.userId,
                        expires: new Date(result.expires),
                    },
                    user: {
                        ...user,
                        emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
                    },
                };
            } catch (error) {
                return handleError(error, 'getSessionAndUser', onError);
            }
        },

        async updateSession(
            session: Partial<AdapterSession> & Pick<AdapterSession, 'sessionToken'>,
        ): Promise<AdapterSession> {
            try {
                const updates: string[] = [];
                const values: any[] = [];

                if (session.expires !== undefined) {
                    updates.push('expires = ?');
                    values.push(session.expires.toISOString());
                }

                values.push(session.sessionToken);

                await d1Binding
                    .prepare(`UPDATE Session SET ${updates.join(', ')} WHERE sessionToken = ?`)
                    .bind(...values)
                    .run();

                const result = await d1Binding
                    .prepare(`SELECT sessionToken, userId, expires FROM Session WHERE sessionToken = ?`)
                    .bind(session.sessionToken)
                    .first<any>();

                return {
                    sessionToken: result!.sessionToken,
                    userId: result!.userId,
                    expires: new Date(result!.expires),
                };
            } catch (error) {
                return handleError(error, 'updateSession', onError);
            }
        },

        async deleteSession(sessionToken: string): Promise<void> {
            try {
                await d1Binding.prepare(`DELETE FROM Session WHERE sessionToken = ?`).bind(sessionToken).run();
            } catch (error) {
                return handleError(error, 'deleteSession', onError);
            }
        },

        // ============================================================
        // VERIFICATION TOKEN OPERATIONS
        // ============================================================

        async createVerificationToken(token: VerificationToken): Promise<VerificationToken> {
            try {
                await d1Binding
                    .prepare(
                        `INSERT INTO VerificationToken (identifier, token, expires)
             VALUES (?, ?, ?)`,
                    )
                    .bind(token.identifier, token.token, token.expires.toISOString())
                    .run();

                return token;
            } catch (error) {
                return handleError(error, 'createVerificationToken', onError);
            }
        },

        async useVerificationToken({
            identifier,
            token,
        }: {
            identifier: string;
            token: string;
        }): Promise<VerificationToken | null> {
            try {
                const result = await d1Binding
                    .prepare(
                        `SELECT identifier, token, expires FROM VerificationToken WHERE identifier = ? AND token = ?`,
                    )
                    .bind(identifier, token)
                    .first<any>();

                if (!result) return null;

                await d1Binding
                    .prepare(`DELETE FROM VerificationToken WHERE identifier = ? AND token = ?`)
                    .bind(identifier, token)
                    .run();

                return {
                    identifier: result.identifier,
                    token: result.token,
                    expires: new Date(result.expires),
                };
            } catch (error) {
                return handleError(error, 'useVerificationToken', onError);
            }
        },
    };
}

/**
 * Cached version using WeakMap for D1 binding
 * Useful when the same D1 binding is used multiple times
 */
const adapterCache = new WeakMap<D1Database, Adapter>();

export function createDrizzleD1AuthAdapterCached(d1: D1Database, options: DrizzleD1AuthAdapterOptions = {}): Adapter {
    const cached = adapterCache.get(d1);
    if (cached) return cached;

    const adapter = createDrizzleD1AuthAdapter(d1, options);
    adapterCache.set(d1, adapter);
    return adapter;
}
