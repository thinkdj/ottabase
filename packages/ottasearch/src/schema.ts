import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const searchableModelsTable = sqliteTable('searchable_models', {
    entityName: text('entity_name').primaryKey(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    fieldsJson: text('fields_json').notNull().default('[]'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    lastIndexedAt: integer('last_indexed_at'),
});

export const searchDocumentsTable = sqliteTable('search_documents', {
    id: text('id').primaryKey(),
    entityName: text('entity_name').notNull(),
    recordId: text('record_id').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull(),
    keywordsJson: text('keywords_json').notNull().default('[]'),
    embeddingJson: text('embedding_json'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
});

export type SearchableModelRecord = typeof searchableModelsTable.$inferSelect;
export type SearchDocumentRecord = typeof searchDocumentsTable.$inferSelect;
