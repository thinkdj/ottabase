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

const FIELD_NAME_REGEX = /^[A-Za-z0-9_]+$/;

const USER_FIELD_COLUMN_OVERRIDES: Record<string, string> = {
    emailVerified: 'email_verified',
};

function toSnakeCase(value: string): string {
    return value.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function toDbColumn(field: string): string {
    if (USER_FIELD_COLUMN_OVERRIDES[field]) {
        return USER_FIELD_COLUMN_OVERRIDES[field];
    }

    return toSnakeCase(field);
}

function toTimestamp(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) {
        const ts = value.getTime();
        return Number.isFinite(ts) ? ts : null;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    const parsed = new Date(String(value)).getTime();
    return Number.isFinite(parsed) ? parsed : null;
}

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

function getUserFieldList(customFields?: string[]): string[] {
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

    return fields;
}

function getUserFieldSelections(customFields?: string[], tableAlias?: string): string {
    const fields = getUserFieldList(customFields);

    return fields
        .map((field) => {
            const column = toDbColumn(field);
            if (!FIELD_NAME_REGEX.test(column)) {
                throw new Error(
                    `Invalid user column name "${column}" derived from field "${field}". ` +
                        'Column names may only contain alphanumeric characters and underscore.',
                );
            }

            const qualified = tableAlias ? `${tableAlias}.${column}` : column;
            if (column === field) {
                return qualified;
            }

            return `${qualified} as ${field}`;
        })
        .join(', ');
}

export function createDrizzleD1AuthAdapter(d1: D1Database, options: DrizzleD1AuthAdapterOptions = {}): Adapter {
    const driver = options.driver || createD1Driver(d1, { log: options.log });
    const d1Binding = driver.getD1();
    const { customUserFields, onError } = options;
    const userFieldsSQL = getUserFieldSelections(customUserFields);
    const userFieldsWithAliasSQL = getUserFieldSelections(customUserFields, 'u');
    const userFieldList = getUserFieldList(customUserFields);

    return {
        // ============================================================
        // USER OPERATIONS
        // ============================================================

        async createUser(user: Omit<AdapterUser, 'id'>): Promise<AdapterUser> {
            try {
                const id = crypto.randomUUID();
                const nowMs = Date.now();

                await d1Binding
                    .prepare(
                        `INSERT INTO users (id, name, email, email_verified, image, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    )
                    .bind(id, user.name, user.email, toTimestamp(user.emailVerified), user.image, nowMs, nowMs)
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
                    .prepare(`SELECT ${userFieldsSQL} FROM users WHERE id = ?`)
                    .bind(id)
                    .first<AdapterUser>();

                if (!result) return null;

                return {
                    ...result,
                    emailVerified: toTimestamp(result.emailVerified) as unknown as Date | null,
                };
            } catch (error) {
                return handleError(error, 'getUser', onError);
            }
        },

        async getUserByEmail(email: string): Promise<AdapterUser | null> {
            try {
                const result = await d1Binding
                    .prepare(`SELECT ${userFieldsSQL} FROM users WHERE email = ?`)
                    .bind(email)
                    .first<AdapterUser>();

                if (!result) return null;

                return {
                    ...result,
                    emailVerified: toTimestamp(result.emailVerified) as unknown as Date | null,
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
                        `SELECT ${userFieldsWithAliasSQL}
             FROM users u
             INNER JOIN accounts a ON u.id = a.user_id
             WHERE a.provider = ? AND a.provider_account_id = ?`,
                    )
                    .bind(provider, providerAccountId)
                    .first<AdapterUser>();

                if (!result) return null;

                return {
                    ...result,
                    emailVerified: toTimestamp(result.emailVerified) as unknown as Date | null,
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
                    updates.push('email_verified = ?');
                    values.push(toTimestamp(user.emailVerified));
                }
                if (user.image !== undefined) {
                    updates.push('image = ?');
                    values.push(user.image);
                }

                updates.push('updated_at = ?');
                values.push(Date.now());

                values.push(user.id);

                await d1Binding
                    .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
                    .bind(...values)
                    .run();

                const result = await d1Binding
                    .prepare(`SELECT ${userFieldsSQL} FROM users WHERE id = ?`)
                    .bind(user.id)
                    .first<AdapterUser>();

                return {
                    ...result!,
                    emailVerified: toTimestamp(result!.emailVerified) as unknown as Date | null,
                };
            } catch (error) {
                return handleError(error, 'updateUser', onError);
            }
        },

        async deleteUser(userId: string): Promise<void> {
            try {
                await d1Binding.prepare(`DELETE FROM users WHERE id = ?`).bind(userId).run();
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
                const nowMs = Date.now();

                await d1Binding
                    .prepare(
                        `INSERT INTO accounts (id, user_id, type, provider, provider_account_id, refresh_token, access_token, expires_at, token_type, scope, id_token, session_state, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                        nowMs,
                        nowMs,
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
                    .prepare(`DELETE FROM accounts WHERE provider = ? AND provider_account_id = ?`)
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
                const nowMs = Date.now();
                const expiresMs = toTimestamp(session.expires);
                if (!expiresMs) {
                    throw new Error('Invalid session expiry');
                }

                await d1Binding
                    .prepare(
                        `INSERT INTO sessions (id, session_token, user_id, expires, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
                    )
                    .bind(id, session.sessionToken, session.userId, expiresMs, nowMs, nowMs)
                    .run();

                return {
                    sessionToken: session.sessionToken,
                    userId: session.userId,
                    expires: expiresMs as any,
                };
            } catch (error) {
                return handleError(error, 'createSession', onError);
            }
        },

        async getSessionAndUser(sessionToken: string): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
            try {
                const userFieldAliases = userFieldList.map((field) => ({
                    field,
                    alias: `user_${toSnakeCase(field)}`,
                }));

                const userFields = userFieldAliases
                    .map(({ field, alias }) => {
                        const column = toDbColumn(field);
                        return `u.${column} as ${alias}`;
                    })
                    .join(', ');

                const result = await d1Binding
                    .prepare(
                        `SELECT
              s.session_token as sessionToken, s.user_id as userId, s.expires,
              ${userFields}
             FROM sessions s
             INNER JOIN users u ON s.user_id = u.id
             WHERE s.session_token = ?`,
                    )
                    .bind(sessionToken)
                    .first<any>();

                if (!result) return null;

                // Check if session is expired
                const expiresMs = toTimestamp(result.expires);
                if (!expiresMs || expiresMs < Date.now()) {
                    await d1Binding.prepare(`DELETE FROM sessions WHERE session_token = ?`).bind(sessionToken).run();
                    return null;
                }

                // Extract user fields from the result
                const user: any = {};
                userFieldAliases.forEach(({ field, alias }) => {
                    user[field] = result[alias];
                });

                return {
                    session: {
                        sessionToken: result.sessionToken,
                        userId: result.userId,
                        expires: expiresMs as any,
                    },
                    user: {
                        ...user,
                        emailVerified: toTimestamp(user.emailVerified),
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
                    const expiresMs = toTimestamp(session.expires);
                    if (!expiresMs) {
                        throw new Error('Invalid session expiry');
                    }
                    values.push(expiresMs);
                }

                updates.push('updated_at = ?');
                values.push(Date.now());

                values.push(session.sessionToken);

                await d1Binding
                    .prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE session_token = ?`)
                    .bind(...values)
                    .run();

                const result = await d1Binding
                    .prepare(
                        `SELECT session_token as sessionToken, user_id as userId, expires FROM sessions WHERE session_token = ?`,
                    )
                    .bind(session.sessionToken)
                    .first<any>();

                return {
                    sessionToken: result!.sessionToken,
                    userId: result!.userId,
                    expires: (toTimestamp(result!.expires) ?? Date.now()) as any,
                };
            } catch (error) {
                return handleError(error, 'updateSession', onError);
            }
        },

        async deleteSession(sessionToken: string): Promise<void> {
            try {
                await d1Binding.prepare(`DELETE FROM sessions WHERE session_token = ?`).bind(sessionToken).run();
            } catch (error) {
                return handleError(error, 'deleteSession', onError);
            }
        },

        // ============================================================
        // VERIFICATION TOKEN OPERATIONS
        // ============================================================

        async createVerificationToken(token: VerificationToken): Promise<VerificationToken> {
            try {
                const expiresMs = toTimestamp(token.expires);
                if (!expiresMs) {
                    throw new Error('Invalid verification token expiry');
                }
                await d1Binding
                    .prepare(
                        `INSERT INTO verification_tokens (identifier, token, expires)
             VALUES (?, ?, ?)`,
                    )
                    .bind(token.identifier, token.token, expiresMs)
                    .run();

                return { ...token, expires: expiresMs as any };
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
                        `SELECT identifier, token, expires FROM verification_tokens WHERE identifier = ? AND token = ?`,
                    )
                    .bind(identifier, token)
                    .first<any>();

                if (!result) return null;

                await d1Binding
                    .prepare(`DELETE FROM verification_tokens WHERE identifier = ? AND token = ?`)
                    .bind(identifier, token)
                    .run();

                return {
                    identifier: result.identifier,
                    token: result.token,
                    expires: (toTimestamp(result.expires) ?? Date.now()) as any,
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
