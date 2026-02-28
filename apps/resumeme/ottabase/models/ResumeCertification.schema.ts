// ============================================================
// ResumeCertification table schema (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * ResumeCertification table schema
 * Stores professional certifications and credentials.
 */
export const resumeCertificationsTable = sqliteTable('resume_certifications', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    issuer: text('issuer').notNull(),
    issueDate: text('issue_date'),
    expiryDate: text('expiry_date'),
    credentialUrl: text('credential_url'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type ResumeCertificationType = typeof resumeCertificationsTable.$inferSelect;
export type NewResumeCertificationType = typeof resumeCertificationsTable.$inferInsert;
