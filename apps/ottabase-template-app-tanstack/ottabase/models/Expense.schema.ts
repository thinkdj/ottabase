import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const expenseGroupsTable = sqliteTable('expense_groups', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    appId: text('app_id').notNull(),
    organizationId: text('organization_id'),
    userId: text('user_id'),
    name: text('name').notNull(),
    currency: text('currency').notNull().default('JPY'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export const expenseGroupMembersTable = sqliteTable('expense_group_members', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    groupId: text('group_id').notNull(),
    appId: text('app_id').notNull(),
    organizationId: text('organization_id'),
    userId: text('user_id'),
    name: text('name').notNull(),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export const expensesTable = sqliteTable('expenses', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    groupId: text('group_id').notNull(),
    appId: text('app_id').notNull(),
    organizationId: text('organization_id'),
    userId: text('user_id'),
    description: text('description').notNull(),
    merchant: text('merchant'),
    expenseDate: integer('expense_date').notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('JPY'),
    paidByMemberId: text('paid_by_member_id'),
    rawInput: text('raw_input'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export const expenseSplitsTable = sqliteTable('expense_splits', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    expenseId: text('expense_id').notNull(),
    groupId: text('group_id'),
    memberId: text('member_id').notNull(),
    appId: text('app_id').notNull(),
    organizationId: text('organization_id'),
    userId: text('user_id'),
    amount: integer('amount').notNull(),
    splitType: text('split_type').notNull().default('equal'),
    note: text('note'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
});

export type ExpenseGroupRow = typeof expenseGroupsTable.$inferSelect;
export type ExpenseGroupMemberRow = typeof expenseGroupMembersTable.$inferSelect;
export type ExpenseRow = typeof expensesTable.$inferSelect;
export type ExpenseSplitRow = typeof expenseSplitsTable.$inferSelect;
