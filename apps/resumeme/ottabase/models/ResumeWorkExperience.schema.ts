// ============================================================
// ResumeWorkExperience table schema (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * ResumeWorkExperience table schema
 * Stores work history entries. Highlights stored as JSON array of strings.
 */
export const resumeWorkExperiencesTable = sqliteTable('resume_work_experiences', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    company: text('company').notNull(),
    designation: text('designation').notNull(),
    location: text('location'),
    startDate: text('start_date'),
    endDate: text('end_date'),
    isCurrent: integer('is_current', { mode: 'boolean' }).default(false).notNull(),
    description: text('description'),
    highlights: text('highlights'), // JSON array of strings, e.g. '["Led team of 5","Increased perf by 40%"]'
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type ResumeWorkExperienceType = typeof resumeWorkExperiencesTable.$inferSelect;
export type NewResumeWorkExperienceType = typeof resumeWorkExperiencesTable.$inferInsert;
