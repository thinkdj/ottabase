import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Operator overrides on top of a plan. One row per (scope, key). `scope` is derived from
 * which of `organizationId` / `userId` are set, and stored so the admin can filter on it.
 */
export const flagOverridesTable = sqliteTable(
    'flag_overrides',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        appId: text('app_id').notNull(),
        organizationId: text('organization_id'),
        userId: text('user_id'),
        /** `app`, `organization` or `user`. */
        scope: text('scope').notNull(),
        /** `plan`, `feature:<id>` or `limit:<id>`. */
        key: text('key').notNull(),
        /** JSON-encoded: a plan key, a boolean, or a number. */
        value: text('value').notNull(),
        reason: text('reason'),
        createdBy: text('created_by'),
        expiresAt: integer('expires_at'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        subjectIdx: index('flag_overrides_subject_idx').on(table.appId, table.organizationId, table.userId),
    }),
);

export type FlagOverrideRecord = typeof flagOverridesTable.$inferSelect;
export type NewFlagOverrideRecord = typeof flagOverridesTable.$inferInsert;
