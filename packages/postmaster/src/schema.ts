import { index, sqliteTable, text, uniqueIndex, integer } from 'drizzle-orm/sqlite-core';

/**
 * Addresses that must not be mailed. One row per (app, list, address); `list` is `*` for
 * "never, for anything" (a hard bounce, a complaint) and a list name for one unsubscribe.
 */
export const emailSuppressionsTable = sqliteTable(
    'email_suppressions',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        appId: text('app_id').notNull(),
        /** Lower-cased. */
        address: text('address').notNull(),
        list: text('list').notNull().default('*'),
        /** `bounce`, `complaint`, `unsubscribe`, `manual`. */
        reason: text('reason').notNull(),
        source: text('source'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
    },
    (table) => ({
        // Send-time checks: one address (or a batch) against `*` and one list.
        addressIdx: uniqueIndex('email_suppressions_address_idx').on(table.appId, table.list, table.address),
        // One address across every list (a person's timeline); `list` in the middle above cannot serve it.
        appAddressIdx: index('email_suppressions_app_address_idx').on(table.appId, table.address),
        appIdx: index('email_suppressions_app_idx').on(table.appId, table.createdAt),
    }),
);

export type EmailSuppressionRecord = typeof emailSuppressionsTable.$inferSelect;
