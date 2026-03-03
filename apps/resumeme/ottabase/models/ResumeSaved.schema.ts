// ============================================================
// ResumeSaved table schema (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * ResumeSaved table schema
 *
 * A fully-expanded resume snapshot that the user has explicitly saved.
 * Contains the complete JSON of all resume data, colours, template, section
 * ordering, heading overrides, and scale — everything needed to render the
 * resume exactly as it was at save time.
 *
 * Optionally references a ResumeDataSet so that its dynamic content can be
 * "refreshed" from that data set without losing style/layout choices.
 */
export const resumeSavedTable = sqliteTable('resume_saved', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    /** User-chosen filename / display name for the saved resume */
    name: text('name').notNull(),
    /** Optional back-reference to the data set used to build this resume */
    dataSetId: text('data_set_id'),
    /** Template identifier (e.g. 'classic', 'modern') */
    templateId: text('template_id').notNull().default('classic'),
    /** Accent colour hex code */
    accentColor: text('accent_color').notNull().default('#475569'),
    /** Page scale percentage (e.g. 100) */
    fontSize: integer('font_size').notNull().default(100),
    /** Ordered section keys — JSON array of SectionKey values */
    sectionOrder: text('section_order'),
    /** Custom heading label overrides — JSON object { sectionKey: label } */
    headingLabels: text('heading_labels'),
    /** Share toggle — when false, public links are disabled */
    shareEnabled: integer('share_enabled', { mode: 'boolean' }).notNull().default(true),
    /**
     * Full expanded resume snapshot data — JSON string of ResumeTemplateData.
     * This is the complete data including profile, work, education, skills,
     * projects, and certifications as they were when saved.
     */
    snapshotData: text('snapshot_data').notNull(),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type ResumeSavedType = typeof resumeSavedTable.$inferSelect;
export type NewResumeSavedType = typeof resumeSavedTable.$inferInsert;
