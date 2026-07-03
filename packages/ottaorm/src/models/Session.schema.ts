// ============================================================
// @ottabase/ottaorm - Session table schema for Auth.js
// ============================================================

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Session table schema for Auth.js
 */
export const sessionsTable = sqliteTable(
    'sessions',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        sessionToken: text('session_token').notNull().unique(),
        userId: text('user_id').notNull(),
        expires: integer('expires').notNull(), // Unix timestamp (ms)
        // App identifier for multi-app database sharing (nullable, opt-in)
        appId: text('app_id'),
        createdAt: integer('created_at')
            .$defaultFn(() => Date.now())
            .notNull(),
        updatedAt: integer('updated_at')
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (t) => ({
        // Revoking/listing a user's sessions (sign-out, "log out everywhere") filters by userId.
        // sessionToken is already covered by its UNIQUE index (the per-request lookup).
        userIdx: index('sessions_user_idx').on(t.userId),
    }),
);

/**
 * Session model type
 */
export type SessionType = typeof sessionsTable.$inferSelect;
export type NewSessionType = typeof sessionsTable.$inferInsert;
