// ============================================================
// @ottabase/ottaorm - Account Model (NextAuth)
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';
import { accountsTable } from './Account.schema';

export { accountsTable, type AccountType, type NewAccountType } from './Account.schema';

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
