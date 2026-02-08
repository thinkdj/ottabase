// ============================================================
// @ottabase/ottaorm - Session Model
// ============================================================

import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';
import { sessionsTable } from './Session.schema';

export { sessionsTable, type NewSessionType, type SessionType } from './Session.schema';

/**
 * Session model for Auth.js authentication sessions
 *
 * Represents active authentication sessions with token-based tracking.
 *
 * @example
 * ```typescript
 * import { Session } from "@ottabase/ottaorm/models";
 *
 * // Find session by token
 * const session = await Session.findByToken("token123");
 *
 * // Find all sessions for a user
 * const sessions = await Session.findByUserId("user-id");
 *
 * // Delete expired sessions
 * const deleted = await Session.deleteExpired();
 * ```
 */
export class Session extends BaseModel {
    static entity = 'sessions';
    static table = sessionsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: { label: 'ID' },
        },
        sessionToken: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Session Token' },
            validation: {
                rules: 'required|unique:sessions,session_token',
            },
        },
        userId: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'User ID' },
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
        createdAt: {
            type: 'datetime',
            editable: false,
            uiConfig: { label: 'Created At' },
        },
        updatedAt: {
            type: 'datetime',
            editable: false,
            uiConfig: { label: 'Updated At' },
        },
    };

    /**
     * Find session by session token
     */
    static async findByToken(token: string): Promise<Session | null> {
        return this.first({ sessionToken: token });
    }

    /**
     * Find all sessions for a user
     */
    static async findByUserId(userId: string): Promise<Session[]> {
        return this.where({ userId });
    }

    /**
     * Delete expired sessions
     */
    static async deleteExpired(): Promise<number> {
        const now = Date.now();
        const driver = this.getDriver();
        const db = driver.getDb();
        const result = await db.run(`DELETE FROM ${this.entity} WHERE expires < ?`, now);
        return result.changes || 0;
    }
}
