// ============================================================
// Todo table schema (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Todo table schema
 */
export const todosTable = sqliteTable('todos', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    completed: integer('completed', { mode: 'boolean' }).default(false).notNull(),
    userId: text('user_id'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type TodoType = typeof todosTable.$inferSelect;
export type NewTodoType = typeof todosTable.$inferInsert;
