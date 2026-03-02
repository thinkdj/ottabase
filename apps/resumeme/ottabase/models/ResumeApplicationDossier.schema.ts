// ============================================================
// ResumeApplicationDossier table schema (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * ResumeApplicationDossier table schema
 *
 * An "Application Dossier" — a folder for grouping related documents around a
 * specific job application context (e.g. "Google SWE Application"). Users upload
 * resumes, job descriptions, company info, etc. and the AI analyses them together.
 */
export const resumeApplicationDossiersTable = sqliteTable('resume_application_dossiers', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    /** Display name (e.g. "Google SWE Application", "Meta Frontend Role") */
    name: text('name').notNull(),
    /** Brief description of this application dossier */
    description: text('description'),
    /** Target role (e.g. "Senior Frontend Engineer") */
    targetRole: text('target_role'),
    /** Target company (e.g. "Google") */
    targetCompany: text('target_company'),
    /** Application dossier status */
    status: text('status').notNull().default('active'),
    /** Timestamp of last AI analysis */
    lastAnalysisAt: integer('last_analysis_at'),
    /** JSON — stored AI analysis result */
    analysisResult: text('analysis_result'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type ResumeApplicationDossierType = typeof resumeApplicationDossiersTable.$inferSelect;
export type NewResumeApplicationDossierType = typeof resumeApplicationDossiersTable.$inferInsert;
