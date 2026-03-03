// ============================================================
// ResumeDataSet table schema (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * ResumeDataSet table schema
 * A named collection assembling profile, skills, work, education, projects,
 * and certifications. Users apply different templates to this data set.
 */
export const resumeDataSetsTable = sqliteTable('resume_data_sets', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    profileId: text('profile_id'),
    summaryId: text('summary_id'),
    templateId: text('template_id').default('classic'),
    accentColor: text('accent_color').default('#475569'),
    selectedSkillSetIds: text('selected_skill_set_ids'), // JSON array of IDs
    selectedWorkExperienceIds: text('selected_work_experience_ids'), // JSON array of IDs
    selectedEducationIds: text('selected_education_ids'), // JSON array of IDs
    selectedProjectIds: text('selected_project_ids'), // JSON array of IDs
    selectedCertificationIds: text('selected_certification_ids'), // JSON array of IDs
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type ResumeDataSetType = typeof resumeDataSetsTable.$inferSelect;
export type NewResumeDataSetType = typeof resumeDataSetsTable.$inferInsert;
