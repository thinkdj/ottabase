// ============================================================
// @ottabase/comments - CommentReaction table schema
// ============================================================

import { index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const commentReactionsTable = sqliteTable(
    'comment_reactions',
    {
        // Primary key — auto-generated UUID
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        // The comment this reaction belongs to
        commentId: text('comment_id').notNull(),

        // The emoji reacted with (a single reaction per user per emoji per comment)
        emoji: text('emoji').notNull(),

        // The reacting user's ID
        userId: text('user_id').notNull(),

        // Timestamp stored as Unix epoch milliseconds
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
    },
    (table) => [
        // One reaction per (comment, emoji, user) — toggling is INSERT-OR-IGNORE / DELETE against
        // this constraint, making it atomic at the DB level (no read-modify-write race).
        unique('comment_reactions_unique_idx').on(table.commentId, table.emoji, table.userId),
        // Fetch/aggregate all reactions for a set of comments (the enrichment query on comment lists)
        index('comment_reactions_comment_idx').on(table.commentId),
    ],
);

export type CommentReactionRecord = typeof commentReactionsTable.$inferSelect;
export type NewCommentReactionRecord = typeof commentReactionsTable.$inferInsert;
