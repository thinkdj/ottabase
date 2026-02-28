// ============================================================
// ResumeProject table schema (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * ResumeProject table schema
 * Stores project entries. techStack stored as JSON array of strings.
 */
export const resumeProjectsTable = sqliteTable('resume_projects', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    url: text('url'),
    techStack: text('tech_stack'), // JSON array of strings, e.g. '["React","AWS","PostgreSQL"]'
    startDate: text('start_date'),
    endDate: text('end_date'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type ResumeProjectType = typeof resumeProjectsTable.$inferSelect;
export type NewResumeProjectType = typeof resumeProjectsTable.$inferInsert;
