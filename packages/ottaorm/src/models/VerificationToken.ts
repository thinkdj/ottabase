// ============================================================
// @ottabase/ottaorm - VerificationToken Model
// ============================================================

import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';

/**
 * VerificationToken table schema for Auth.js
 * Composite primary key: (identifier, token)
 */
export const verificationTokensTable = sqliteTable(
    'verification_tokens',
    {
        identifier: text('identifier').notNull(), // email or other identifier
        token: text('token').notNull(),
        expires: text('expires').notNull(), // ISO 8601 date string
        // App identifier for multi-app database sharing (nullable, opt-in)
        appId: text('app_id'),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.identifier, table.token] }),
    }),
);

/**
 * VerificationToken model type
 */
export type VerificationTokenType = typeof verificationTokensTable.$inferSelect;
export type NewVerificationTokenType = typeof verificationTokensTable.$inferInsert;

/**
 * VerificationToken model for Auth.js email/SMS verification
 *
 * Used for passwordless sign-in and email verification flows.
 * Composite primary key: (identifier, token)
 *
 * @example
 * ```typescript
 * import { VerificationToken } from "@ottabase/ottaorm/models";
 *
 * // Find token by identifier and token
 * const token = await VerificationToken.findByIdentifierAndToken(
 *   "user@example.com",
 *   "token123"
 * );
 *
 * // Delete token after use
 * await VerificationToken.deleteByIdentifierAndToken(
 *   "user@example.com",
 *   "token123"
 * );
 *
 * // Clean up expired tokens
 * const deleted = await VerificationToken.deleteExpired();
 * ```
 */
export class VerificationToken extends BaseModel {
    static entity = 'verification_tokens';
    static table = verificationTokensTable;
    static primaryKey = 'identifier'; // Composite key (identifier, token) - use custom methods
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    protected static fields: ModelFields = {
        identifier: {
            type: 'string',
            primaryKey: true,
            editable: true,
            uiConfig: {
                label: 'Identifier',
                description: 'Email or other identifier',
            },
            validation: {
                rules: 'required',
            },
        },
        token: {
            type: 'string',
            primaryKey: true,
            editable: true,
            uiConfig: { label: 'Token' },
            validation: {
                rules: 'required',
            },
        },
        expires: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Expires', description: 'ISO 8601 date string' },
            validation: {
                rules: 'required',
            },
        },
    };

    /**
     * Find verification token by identifier and token
     */
    static async findByIdentifierAndToken(identifier: string, token: string): Promise<VerificationToken | null> {
        const driver = this.getDriver();
        const db = driver.getDb();
        const result = await db
            .prepare(`SELECT * FROM ${this.entity} WHERE identifier = ? AND token = ?`)
            .bind(identifier, token)
            .first();

        if (!result) return null;

        return new this({ entity: this.entity, data: result as any });
    }

    /**
     * Delete verification token by identifier and token
     * Used when consuming a token during verification
     */
    static async deleteByIdentifierAndToken(identifier: string, token: string): Promise<boolean> {
        const driver = this.getDriver();
        const db = driver.getDb();
        const result = await db.run(`DELETE FROM ${this.entity} WHERE identifier = ? AND token = ?`, identifier, token);
        return (result.changes || 0) > 0;
    }

    /**
     * Delete expired tokens for cleanup
     */
    static async deleteExpired(): Promise<number> {
        const now = new Date().toISOString();
        const driver = this.getDriver();
        const db = driver.getDb();
        const result = await db.run(`DELETE FROM ${this.entity} WHERE expires < ?`, now);
        return result.changes || 0;
    }
}
