// ============================================================
// @ottabase/ottaorm - VerificationToken table schema for Auth.js
// ============================================================

import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * VerificationToken table schema for Auth.js
 * Composite primary key: (identifier, token)
 */
export const verificationTokensTable = sqliteTable(
    'verification_tokens',
    {
        identifier: text('identifier').notNull(), // email or other identifier
        token: text('token').notNull(),
        expires: integer('expires').notNull(), // Unix timestamp (ms)
        // App identifier for multi-app database sharing (nullable, opt-in)
        appId: text('app_id'),
    },
    (table) => ({
        pk: primaryKey({ columns: [table.identifier, table.token] }),
        // Email verification and password-reset confirmation look the token up by value alone.
        // The composite PK leads with identifier, so a token-only lookup can't use it.
        tokenIdx: index('verification_tokens_token_idx').on(table.token),
    }),
);

/**
 * VerificationToken model type
 */
export type VerificationTokenType = typeof verificationTokensTable.$inferSelect;
export type NewVerificationTokenType = typeof verificationTokensTable.$inferInsert;
