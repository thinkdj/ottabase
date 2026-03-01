// ============================================================
// KnowledgeBaseFile table schema (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * KnowledgeBaseFile table schema
 *
 * Files uploaded to a knowledge base folder. Each file is stored in R2 and
 * optionally has its text content extracted for AI processing.
 */
export const knowledgeBaseFilesTable = sqliteTable('knowledge_base_files', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').notNull(),
    /** FK to knowledge_bases */
    knowledgeBaseId: text('knowledge_base_id').notNull(),
    /** Original file name */
    fileName: text('file_name').notNull(),
    /** File type (e.g. 'pdf', 'txt', 'image', 'docx') */
    fileType: text('file_type').notNull(),
    /** MIME type */
    mimeType: text('mime_type').notNull(),
    /** File size in bytes */
    fileSize: integer('file_size').notNull(),
    /** R2 storage key */
    r2Key: text('r2_key').notNull(),
    /** Extracted text content from file for AI processing */
    extractedText: text('extracted_text'),
    /** Processing status */
    status: text('status').notNull().default('uploaded'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type KnowledgeBaseFileType = typeof knowledgeBaseFilesTable.$inferSelect;
export type NewKnowledgeBaseFileType = typeof knowledgeBaseFilesTable.$inferInsert;
