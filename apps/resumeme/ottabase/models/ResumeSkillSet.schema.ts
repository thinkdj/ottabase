// ============================================================
// ResumeSkillSet table schema (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * ResumeSkillSet table schema
 * Groups skills under a named category. Skills stored as JSON array of strings.
 */
export const resumeSkillSetsTable = sqliteTable('resume_skill_sets', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    skills: text('skills').notNull(), // JSON array of strings, e.g. '["React","TypeScript","Node.js"]'
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type ResumeSkillSetType = typeof resumeSkillSetsTable.$inferSelect;
export type NewResumeSkillSetType = typeof resumeSkillSetsTable.$inferInsert;
