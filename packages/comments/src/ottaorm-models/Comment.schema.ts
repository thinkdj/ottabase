import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Map of emoji → array of user IDs who reacted (aggregated from the comment_reactions table) */
export type ReactionsMap = Record<string, string[]>;

export const commentsTable = sqliteTable(
    'comments',
    {
        // Primary key — auto-generated UUID
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        // The comment content; supports plain text or HTML for rich text
        body: text('body').notNull(),

        // Polymorphic target — the entity type being commented on (e.g. 'post', 'page', 'todo')
        targetType: text('target_type').notNull(),

        // The ID of the entity being commented on
        targetId: text('target_id').notNull(),

        // Self-referencing FK for threaded replies; null = top-level comment
        parentId: text('parent_id'),

        // The author's user ID; nullable to allow anonymous comments
        userId: text('user_id'),

        // Moderation status
        status: text('status').notNull().default('active'),

        // Nesting depth: 0 = top-level, 1 = reply, 2 = reply-to-reply, etc. Always recomputed
        // server-side from the parent's depth — never trust a client-supplied value.
        depth: integer('depth').notNull().default(0),

        // Multi-app support
        appId: text('app_id'),

        // Multi-tenant support
        organizationId: text('organization_id'),

        // Timestamps stored as Unix epoch milliseconds
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
        updatedAt: integer('updated_at')
            .notNull()
            .$defaultFn(() => Date.now())
            .$onUpdateFn(() => Date.now()),
    },
    (table) => [
        // Fetch replies to a specific comment
        index('comments_parent_idx').on(table.parentId),
        // Fetch all comments by a specific user
        index('comments_user_idx').on(table.userId),
        // Covers both the RLS-mandatory filter (organizationId is always present in the read
        // filter) and the application query shape (targetType + targetId [+ status]), plus the
        // createdAt sort every comment-list query uses — one index satisfies filter + sort.
        index('comments_org_target_status_created_idx').on(
            table.organizationId,
            table.targetType,
            table.targetId,
            table.status,
            table.createdAt,
        ),
    ],
);

export type CommentRecord = typeof commentsTable.$inferSelect;
export type NewCommentRecord = typeof commentsTable.$inferInsert;
