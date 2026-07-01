// ============================================================
// @ottabase/ottaorm - VerificationToken table schema for email verification, password reset, and magic-link tokens
// ============================================================

import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * VerificationToken table schema for email verification, password reset, and magic-link tokens
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
    }),
);

/**
 * VerificationToken model type
 */
export type VerificationTokenType = typeof verificationTokensTable.$inferSelect;
export type NewVerificationTokenType = typeof verificationTokensTable.$inferInsert;
