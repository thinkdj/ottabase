import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * One row per (tenant, meter). `organizationId` / `userId` hold '' (not NULL) for "none":
 * SQLite treats every NULL as distinct in a UNIQUE index, so NULL scopes could not be unique.
 */
export const meterBalancesTable = sqliteTable(
    'meter_balances',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        appId: text('app_id').notNull(),
        organizationId: text('organization_id').notNull().default(''),
        userId: text('user_id').notNull().default(''),
        meter: text('meter').notNull(),
        /** NULL = unlimited. */
        credits: integer('credits'),
        used: integer('used').notNull().default(0),
        periodStart: integer('period_start').notNull(),
        periodEnd: integer('period_end'),
        /** What a reset restores `credits` to. */
        resetCredits: integer('reset_credits'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => ({
        subjectMeterIdx: uniqueIndex('meter_balances_subject_meter_idx').on(
            table.appId,
            table.organizationId,
            table.userId,
            table.meter,
        ),
    }),
);

/** The ledger: one row per consume or refund. Append-only; pruned by the package's cron. */
export const meterUsageTable = sqliteTable(
    'meter_usage',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),
        balanceId: text('balance_id').notNull(),
        appId: text('app_id').notNull(),
        organizationId: text('organization_id').notNull().default(''),
        userId: text('user_id').notNull().default(''),
        meter: text('meter').notNull(),
        /** Negative for a refund. */
        amount: integer('amount').notNull(),
        /** What it paid for (a job id, a request id, a model name). */
        ref: text('ref'),
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
    },
    (table) => ({
        subjectIdx: index('meter_usage_subject_idx').on(
            table.appId,
            table.organizationId,
            table.userId,
            table.meter,
            table.createdAt,
        ),
        pruneIdx: index('meter_usage_prune_idx').on(table.appId, table.createdAt),
    }),
);

export type MeterBalanceRecord = typeof meterBalancesTable.$inferSelect;
export type MeterUsageRecord = typeof meterUsageTable.$inferSelect;
