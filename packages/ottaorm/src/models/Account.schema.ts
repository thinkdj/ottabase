// ============================================================
// @ottabase/ottaorm - Account table schema (OAuth provider accounts)
// ============================================================

import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Account table schema (OAuth provider accounts)
 *
 * An account row is an IDENTITY LINK only: "provider X's subject Y is our user Z". Provider
 * tokens (access/refresh/id token, expiry, granted scope) are deliberately NOT stored. The
 * callback uses the access token once, to fetch the profile, and nothing in the framework reads
 * a provider token back afterwards — so persisting them would be a plaintext credential store
 * with no reader. An app that needs to call provider APIs on the user's behalf must add its own
 * encrypted token store; do not re-add plaintext token columns here.
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
        // One row per external OAuth identity. Without this, the check-then-create in the OAuth
        // callback (backend-handler) races: concurrent callbacks can link the same provider
        // identity to multiple users, and a later `Account.first({ provider, providerAccountId })`
        // could then authenticate the wrong row. The lookup is global (not app-scoped), so the
        // constraint is global too.
        providerAccountUnique: uniqueIndex('accounts_provider_account_unique').on(t.provider, t.providerAccountId),
    }),
);

/**
 * Account model types
 */
export type AccountType = typeof accountsTable.$inferSelect;
export type NewAccountType = typeof accountsTable.$inferInsert;
