import { and, eq, inArray } from 'drizzle-orm';
import { BaseModel, type ModelFields, type PackageType } from '@ottabase/ottaorm';
import { commentReactionsTable } from './CommentReaction.schema';
import type { ReactionsMap } from './Comment.schema';

// Re-export schema types for consumers
export {
    commentReactionsTable,
    type CommentReactionRecord,
    type NewCommentReactionRecord,
} from './CommentReaction.schema';

/**
 * Normalized per-user emoji reactions on a comment (comment_id, emoji, user_id).
 *
 * Replaces a JSON blob column on `comments` — that design required reading the whole
 * reactions map into memory, mutating it, and writing the entire row back on every single
 * toggle, which both raced under concurrent reactors (lost-update: two users reacting at
 * the same time could clobber each other's write) and rewrote an ever-growing blob on every
 * toggle. A dedicated row per (comment, emoji, user) makes toggling an atomic single-row
 * DELETE-or-INSERT — concurrent reactors from different users touch different rows, so there
 * is nothing to race on.
 */
export class CommentReaction extends BaseModel {
    static entity = 'comment_reactions';
    static table = commentReactionsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/comments';
    static packageType: PackageType = 'package';

    static displayName = 'Comment Reaction';
    static displayNamePlural = 'Comment Reactions';

    // Not exposed via the generic CRUD route — reactions are only ever mutated via
    // Comment's `toggleReaction` server-side helper (see ottaorm-crud.ts comments handling).
    static writable = {
        create: [],
        update: [],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        commentId: { type: 'string', editable: false, uiConfig: { label: 'Comment' } },
        emoji: { type: 'string', editable: false, uiConfig: { label: 'Emoji' } },
        userId: { type: 'string', editable: false, uiConfig: { label: 'User' } },
        createdAt: { type: 'date', editable: false, uiConfig: { label: 'Created' } },
    };

    /**
     * Toggle a user's reaction on a comment — atomically removes the row if present, else
     * inserts it. Each (commentId, emoji, userId) triple is an independent row, so concurrent
     * toggles from different users never contend on the same data.
     */
    static async toggle(commentId: string, emoji: string, userId: string): Promise<{ added: boolean }> {
        const db = this.getDriver().getDb();
        const table = commentReactionsTable;

        const deleted = await db
            .delete(table)
            .where(and(eq(table.commentId, commentId), eq(table.emoji, emoji), eq(table.userId, userId)))
            .returning({ id: table.id });

        if (deleted.length > 0) {
            return { added: false };
        }

        try {
            await db.insert(table).values({ commentId, emoji, userId });
        } catch {
            // A concurrent toggle from the same user already inserted this exact row (unique
            // constraint on commentId+emoji+userId) — the desired end state (reacted) already
            // holds, so this is a benign no-op rather than an error.
        }
        return { added: true };
    }

    /** Remove all reactions for a comment (used when a comment is soft-deleted). */
    static async deleteForComment(commentId: string): Promise<void> {
        const db = this.getDriver().getDb();
        await db.delete(commentReactionsTable).where(eq(commentReactionsTable.commentId, commentId));
    }

    /**
     * Batched reactions lookup for a set of comment IDs, returned in the same
     * `{ emoji: [userId, ...] }` shape the old JSON column used — so consumers (frontend) don't
     * need to change how they read `comment.reactions`.
     */
    static async reactionsFor(commentIds: string[]): Promise<Map<string, ReactionsMap>> {
        const result = new Map<string, ReactionsMap>();
        if (commentIds.length === 0) return result;

        const db = this.getDriver().getDb();
        const rows = await db
            .select({
                commentId: commentReactionsTable.commentId,
                emoji: commentReactionsTable.emoji,
                userId: commentReactionsTable.userId,
            })
            .from(commentReactionsTable)
            .where(inArray(commentReactionsTable.commentId, commentIds));

        for (const row of rows as Array<{ commentId: string; emoji: string; userId: string }>) {
            const map = result.get(row.commentId) ?? {};
            const users = map[row.emoji] ?? [];
            users.push(row.userId);
            map[row.emoji] = users;
            result.set(row.commentId, map);
        }
        return result;
    }
}
