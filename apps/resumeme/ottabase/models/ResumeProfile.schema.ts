// ============================================================
// ResumeProfile table schema (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * ResumeProfile table schema
 * Stores professional profile info. Name comes from the users table.
 */
export const resumeProfilesTable = sqliteTable('resume_profiles', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    headline: text('headline'),
    summary: text('summary'),
    avatarUrl: text('avatar_url'),
    phone: text('phone'),
    email: text('email'),
    website: text('website'),
    linkedinUrl: text('linkedin_url'),
    githubUrl: text('github_url'),
    location: text('location'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type ResumeProfileType = typeof resumeProfilesTable.$inferSelect;
export type NewResumeProfileType = typeof resumeProfilesTable.$inferInsert;
