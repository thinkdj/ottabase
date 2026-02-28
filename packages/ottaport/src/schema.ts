// ============================================================
// @ottabase/ottaport - Database Schema
// ============================================================
// Tracks import/export job history and metadata.
// Uses AuditLog for action tracking + this table for detailed job data.
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Import/Export job log table
 * Stores metadata and history of all import/export operations.
 */
export const portJobsTable = sqliteTable('ottaport_jobs', {
    id: text('id').primaryKey(),
    /** 'import' or 'export' */
    direction: text('direction').notNull(),
    /** OttaORM model entity name (e.g. 'users') */
    modelEntity: text('model_entity').notNull(),
    /** Job status */
    status: text('status').notNull().default('pending'),
    /** File format (csv, json, tsv) */
    format: text('format'),
    /** Original filename */
    filename: text('filename'),
    /** R2 object key if file was saved */
    r2Key: text('r2_key'),
    /** Field used for upsert matching */
    uniqueField: text('unique_field'),
    /** Total rows processed */
    totalRows: integer('total_rows').default(0),
    /** Successfully created records */
    totalCreated: integer('total_created').default(0),
    /** Successfully updated records */
    totalUpdated: integer('total_updated').default(0),
    /** Failed records */
    totalFailed: integer('total_failed').default(0),
    /** Skipped records */
    totalSkipped: integer('total_skipped').default(0),
    /** Processing duration in milliseconds */
    durationMs: integer('duration_ms'),
    /** JSON blob for field mappings, errors, filters, etc. */
    metadata: text('metadata'),
    /** User who initiated the job */
    userId: text('user_id'),
    /** User email for quick reference */
    userEmail: text('user_email'),
    /** Organization/tenant context */
    organizationId: text('organization_id'),
    /** Created timestamp (unix ms) */
    createdAt: integer('created_at')
        .notNull()
        .$defaultFn(() => Date.now()),
});

export type PortJobRecord = typeof portJobsTable.$inferSelect;
export type NewPortJobRecord = typeof portJobsTable.$inferInsert;
