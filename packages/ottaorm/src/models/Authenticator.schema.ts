// ============================================================
// @ottabase/ottaorm - Authenticator table schema for Auth.js WebAuthn
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Authenticator table schema for Auth.js WebAuthn/passkey support
 */
export const authenticatorsTable = sqliteTable('authenticators', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    credentialId: text('credential_id').notNull().unique(),
    userId: text('user_id').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    credentialPublicKey: text('credential_public_key').notNull(),
    counter: integer('counter').notNull(),
    credentialDeviceType: text('credential_device_type').notNull(),
    credentialBackedUp: integer('credential_backed_up').notNull(), // SQLite boolean (0 or 1)
    transports: text('transports'), // Comma-separated list
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
 * Authenticator model type
 */
export type AuthenticatorType = typeof authenticatorsTable.$inferSelect;
export type NewAuthenticatorType = typeof authenticatorsTable.$inferInsert;
