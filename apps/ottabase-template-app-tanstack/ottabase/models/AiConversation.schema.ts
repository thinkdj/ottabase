// ============================================================
// AI Conversation table schema (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * AI Conversation table schema
 * Stores chat conversation metadata for the AI chat feature.
 */
export const aiConversationsTable = sqliteTable('ai_conversations', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    /** Conversation title (auto-generated from first message or user-set) */
    title: text('title').notNull().default('New Chat'),
    /** AI model used (e.g. "@cf/meta/llama-3.1-8b-instruct", "gpt-4o") */
    model: text('model').notNull().default('@cf/meta/llama-3.1-8b-instruct'),
    /** AI provider (e.g. "workers-ai", "openai", "anthropic") */
    provider: text('provider').notNull().default('workers-ai'),
    /** Optional system prompt for this conversation */
    systemPrompt: text('system_prompt'),
    /** User who owns this conversation */
    userId: text('user_id').notNull(),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type AiConversationType = typeof aiConversationsTable.$inferSelect;
export type NewAiConversationType = typeof aiConversationsTable.$inferInsert;
