// ============================================================
// AI Message table schema (App-specific)
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * AI Message table schema
 * Stores individual messages within an AI conversation.
 */
export const aiMessagesTable = sqliteTable('ai_messages', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    /** Conversation this message belongs to */
    conversationId: text('conversation_id').notNull(),
    /** Message role: user, assistant, or system */
    role: text('role').notNull(),
    /** Message content (text or markdown) */
    content: text('content').notNull(),
    /** Model that generated this response (for assistant messages) */
    model: text('model'),
    /** Provider that served this response (for assistant messages) */
    provider: text('provider'),
    /** Token usage as JSON string (for assistant messages) */
    usage: text('usage'),
    /** File attachments as JSON string (array of { url, name, type, size }) for multimodal messages */
    attachments: text('attachments'),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
});

export type AiMessageType = typeof aiMessagesTable.$inferSelect;
export type NewAiMessageType = typeof aiMessagesTable.$inferInsert;
