// ============================================================
// @ottabase/ottaorm - Account table schema (NextAuth)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

/**
 * Account model types
 */
export type AccountType = typeof accountsTable.$inferSelect;
export type NewAccountType = typeof accountsTable.$inferInsert;
