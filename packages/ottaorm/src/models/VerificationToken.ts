// ============================================================
// @ottabase/ottaorm - VerificationToken Model
// ============================================================

import { and, eq, lt } from 'drizzle-orm';
import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';
import { verificationTokensTable } from './VerificationToken.schema';

export {
    verificationTokensTable,
    type NewVerificationTokenType,
    type VerificationTokenType,
} from './VerificationToken.schema';

/**
 * VerificationToken model for email verification, password reset, and magic-link sign-in
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
     * Find verification token by identifier and token.
     *
     * NOTE: `getDb()` returns a Drizzle instance (not the raw D1 binding), so this
     * uses the Drizzle query builder rather than the D1 `.prepare().bind()` API.
     * For single-use consumption prefer {@link consumeByIdentifierAndToken}, which
     * deletes and returns the row atomically and is therefore race-safe.
     */
    static async findByIdentifierAndToken(identifier: string, token: string): Promise<VerificationToken | null> {
        const db = this.getDriver().getDb();
        const rows = await db
            .select()
            .from(verificationTokensTable)
            .where(and(eq(verificationTokensTable.identifier, identifier), eq(verificationTokensTable.token, token)))
            .limit(1);

        const row = Array.isArray(rows) ? rows[0] : rows;
        if (!row) return null;

        return new this({ entity: this.entity, data: row as any });
    }

    /**
     * Atomically consume a verification token: delete it and return the deleted row
     * in a single statement (`DELETE ... RETURNING`). SQLite/D1 serializes writes, so
     * of any number of concurrent callers passing the same (identifier, token) exactly
     * one receives the row and the rest receive `null`. This enforces single-use and
     * closes the find-then-delete double-spend race. Callers must still validate expiry
     * on the returned row.
     *
     * @returns the consumed token, or `null` if it did not exist / was already consumed.
     */
    static async consumeByIdentifierAndToken(identifier: string, token: string): Promise<VerificationToken | null> {
        const db = this.getDriver().getDb();
        const deleted = await db
            .delete(verificationTokensTable)
            .where(and(eq(verificationTokensTable.identifier, identifier), eq(verificationTokensTable.token, token)))
            .returning();

        const row = Array.isArray(deleted) ? deleted[0] : deleted;
        if (!row) return null;

        return new this({ entity: this.entity, data: row as any });
    }

    /**
     * Delete verification token by identifier and token.
     * Returns whether a row was actually deleted (affected rows > 0).
     */
    static async deleteByIdentifierAndToken(identifier: string, token: string): Promise<boolean> {
        const db = this.getDriver().getDb();
        const deleted = await db
            .delete(verificationTokensTable)
            .where(and(eq(verificationTokensTable.identifier, identifier), eq(verificationTokensTable.token, token)))
            .returning();

        return Array.isArray(deleted) ? deleted.length > 0 : !!deleted;
    }

    /**
     * Delete all tokens for an identifier (e.g. invalidate previous magic links on re-send).
     * Returns the number of rows removed.
     */
    static async deleteByIdentifier(identifier: string): Promise<number> {
        const db = this.getDriver().getDb();
        const deleted = await db
            .delete(verificationTokensTable)
            .where(eq(verificationTokensTable.identifier, identifier))
            .returning();

        return Array.isArray(deleted) ? deleted.length : 0;
    }

    /**
     * Delete expired tokens for cleanup
     */
    static async deleteExpired(): Promise<number> {
        const db = this.getDriver().getDb();
        const deleted = await db
            .delete(verificationTokensTable)
            .where(lt(verificationTokensTable.expires, Date.now()))
            .returning();

        return Array.isArray(deleted) ? deleted.length : 0;
    }
}
