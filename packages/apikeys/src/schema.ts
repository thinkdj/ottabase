import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * One row per key. Only the SHA-256 of the plaintext is stored; `prefix` is the visible
 * head for display. Scope columns hold '' for "none" (SQLite NULLs are distinct in indexes).
 */
export const apiKeysTable = sqliteTable(
    'api_keys',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        appId: text('app_id').notNull(),
        organizationId: text('organization_id').notNull().default(''),
        userId: text('user_id').notNull().default(''),
        name: text('name').notNull(),
        prefix: text('prefix').notNull(),
        /** Hex SHA-256 of the plaintext key. */
        hash: text('hash').notNull(),
        scopes: text('scopes', { mode: 'json' }).$type<string[]>().notNull(),
        createdBy: text('created_by'),
        lastUsedAt: integer('last_used_at'),
        expiresAt: integer('expires_at'),
        revokedAt: integer('revoked_at'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        hashIdx: uniqueIndex('api_keys_hash_idx').on(table.hash),
        subjectIdx: index('api_keys_subject_idx').on(table.appId, table.organizationId, table.userId),
    }),
);

export type ApiKeyRecord = typeof apiKeysTable.$inferSelect;
export type NewApiKeyRecord = typeof apiKeysTable.$inferInsert;
