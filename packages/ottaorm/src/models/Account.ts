// ============================================================
// @ottabase/ottaorm - Account Model (NextAuth)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { BaseModel, IModelConstructorParams, ModelFields, type PackageType } from '../base/BaseModel';

/**
 * Account table schema (NextAuth)
 */
export const accountsTable = sqliteTable('accounts', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    type: text('type').notNull(), // oauth, email, credentials
    provider: text('provider').notNull(), // google, github, etc.
    providerAccountId: text('provider_account_id').notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: text('token_type'),
    scope: text('scope'),
    idToken: text('id_token'),
    sessionState: text('session_state'),
    // App identifier for multi-app database sharing (nullable, opt-in)
    appId: text('app_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date())
        .notNull(),
});

/**
 * Account model types
 */
export type AccountType = typeof accountsTable.$inferSelect;
export type NewAccountType = typeof accountsTable.$inferInsert;

/**
 * Account model - NextAuth provider accounts
 *
 * Stores OAuth and authentication provider data for NextAuth.js
 *
 * @example
 * ```typescript
 * import { Account } from "@ottabase/ottaorm";
 * import { setDriver } from "@ottabase/ottaorm";
 *
 * // Find accounts for a user
 * const accounts = await Account.where({ userId: "user-123" });
 *
 * // Find by provider
 * const googleAccount = await Account.first({
 *   userId: "user-123",
 *   provider: "google"
 * });
 * ```
 */
export class Account extends BaseModel {
    static entity = 'accounts';
    static table = accountsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    static casts = {
        expiresAt: 'number' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'ID',
            },
        },
        userId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: {
                label: 'User',
                description: 'Associated user',
            },
            tableConfig: {
                visible: false,
            },
        },
        type: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: {
                label: 'Type',
                description: 'Account type (oauth, email, etc.)',
            },
            tableConfig: {
                visible: true,
                colWidth: 100,
            },
        },
        provider: {
            type: 'string',
            editable: false,
            filterable: true,
            searchable: true,
            uiConfig: {
                label: 'Provider',
                description: 'OAuth provider (google, github, etc.)',
            },
            tableConfig: {
                visible: true,
                colWidth: 120,
            },
        },
        providerAccountId: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Provider Account ID',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Created',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
    };

    constructor(data: { [key: string]: any }) {
        const params: IModelConstructorParams = { entity: Account.entity, data };
        super(params);
    }

    // ============================================================
    // RELATIONSHIPS
    // ============================================================

    /**
     * Get the user who owns this account (BelongsTo User)
     */
    async user(select?: string[]) {
        const { User } = await import('./User');
        return this.belongsTo(User, 'userId', { select });
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /**
     * Find account by provider and user
     */
    static async findByProvider(userId: string, provider: string) {
        return this.first({ userId, provider });
    }

    /**
     * Get all accounts for a user
     */
    static async forUser(userId: string) {
        return this.where({ userId });
    }
}
