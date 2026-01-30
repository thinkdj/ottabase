// ============================================================
// @ottabase/ottaorm - Session Model
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { BaseModel, ModelFields, type PackageType } from '../base/BaseModel';

/**
 * Session table schema for Auth.js
 */
export const sessionsTable = sqliteTable('sessions', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    sessionToken: text('session_token').notNull().unique(),
    userId: text('user_id').notNull(),
    expires: text('expires').notNull(), // ISO 8601 date string
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
 * Session model type
 */
export type SessionType = typeof sessionsTable.$inferSelect;
export type NewSessionType = typeof sessionsTable.$inferInsert;

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
            type: 'string',
            editable: true,
            uiConfig: { label: 'Expires', description: 'ISO 8601 date string' },
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
        const now = new Date().toISOString();
        const driver = this.getDriver();
        const db = driver.getDb();
        const result = await db.run(`DELETE FROM ${this.entity} WHERE expires < ?`, now);
        return result.changes || 0;
    }
}
