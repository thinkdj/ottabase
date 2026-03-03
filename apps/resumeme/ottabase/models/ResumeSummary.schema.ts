// ============================================================
// ResumeSummary table schema (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * ResumeSummary table schema
 * Stores reusable professional summaries for resumes.
 */
export const resumeSummariesTable = sqliteTable('resume_summaries', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type ResumeSummaryType = typeof resumeSummariesTable.$inferSelect;
export type NewResumeSummaryType = typeof resumeSummariesTable.$inferInsert;
