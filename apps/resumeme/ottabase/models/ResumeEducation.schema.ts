// ============================================================
// ResumeEducation table schema (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * ResumeEducation table schema
 * Stores education history entries.
 */
export const resumeEducationsTable = sqliteTable('resume_educations', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    institution: text('institution').notNull(),
    degree: text('degree').notNull(),
    field: text('field'),
    startDate: text('start_date'),
    endDate: text('end_date'),
    grade: text('grade'),
    description: text('description'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type ResumeEducationType = typeof resumeEducationsTable.$inferSelect;
export type NewResumeEducationType = typeof resumeEducationsTable.$inferInsert;
