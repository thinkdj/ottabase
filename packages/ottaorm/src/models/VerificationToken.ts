// ============================================================
// @ottabase/ottaorm - VerificationToken Model
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';
import { verificationTokensTable } from './VerificationToken.schema';

export {
    verificationTokensTable,
    type NewVerificationTokenType,
    type VerificationTokenType,
} from './VerificationToken.schema';

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
            type: 'datetime',
            editable: true,
            uiConfig: { label: 'Expires', description: 'Date/time' },
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
        const now = Date.now();
        const driver = this.getDriver();
        const db = driver.getDb();
        const result = await db.run(`DELETE FROM ${this.entity} WHERE expires < ?`, now);
        return result.changes || 0;
    }
}
