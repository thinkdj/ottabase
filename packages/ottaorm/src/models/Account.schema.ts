// ============================================================
// @ottabase/ottaorm - Account table schema (NextAuth)
// ============================================================

import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Account table schema (NextAuth)
 */
export const accountsTable = sqliteTable(
    'accounts',
    {
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
    },
    (t) => ({
        // Auth.js resolves the linked user by (provider, providerAccountId) on every OAuth sign-in.
        providerAccountIdx: index('accounts_provider_account_idx').on(t.provider, t.providerAccountId),
        // Listing / unlinking a user's connected accounts filters by userId.
        userIdx: index('accounts_user_idx').on(t.userId),
    }),
);

/**
 * Account model types
 */
export type AccountType = typeof accountsTable.$inferSelect;
export type NewAccountType = typeof accountsTable.$inferInsert;
