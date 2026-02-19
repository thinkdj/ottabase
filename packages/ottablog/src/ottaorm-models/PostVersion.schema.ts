/**
 * PostVersion table schema - content versioning history
 */
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { postsTable } from './Post.schema';

export const postVersionsTable = sqliteTable(
    'post_versions',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        // Reference to the post
        postId: text('post_id')
            .notNull()
            .references(() => postsTable.id, { onDelete: 'cascade' }),

        // Version number (auto-incremented per post)
        versionNumber: integer('version_number').notNull(),

        // Snapshot of content at this version
        title: text('title').notNull(),
        content: text('content', { mode: 'json' }).$type<{
            time?: number;
            blocks: Array<{
                id?: string;
                type: string;
                data: Record<string, unknown>;
            }>;
            version?: string;
        }>(),
        excerpt: text('excerpt'),
        privateNotes: text('private_notes', { mode: 'json' }).$type<{
            time?: number;
            blocks: Array<{
                id?: string;
                type: string;
                data: Record<string, unknown>;
            }>;
            version?: string;
        }>(),
        footnotes: text('footnotes', { mode: 'json' }).$type<{
            time?: number;
            blocks: Array<{
                id?: string;
                type: string;
                data: Record<string, unknown>;
            }>;
            version?: string;
        }>(),

        // Word count at this version
        wordCount: integer('word_count'),

        // Tenancy / app context
        organizationId: text('organization_id'),
        appId: text('app_id'),

        // Who made this change (optional)
        changedBy: text('changed_by'),

        // Optional change note/reason
        changeNote: text('change_note'),

        // When this version was created
        createdAt: integer('created_at')
            .notNull()
            .$defaultFn(() => Date.now()),
    },
    (table) => [
        // Get versions for a post in order: postId + versionNumber (DESC)
        index('post_versions_post_id_version_idx').on(table.postId, table.versionNumber),

        // Get latest version for a post ordered by creation time
        index('post_versions_post_id_created_at_idx').on(table.postId, table.createdAt),

        // Find versions by creation date for cleanup/archival
        index('post_versions_created_at_idx').on(table.createdAt),

        // App/Org scoping
        index('post_versions_app_id_idx').on(table.appId),
        index('post_versions_org_id_idx').on(table.organizationId),
    ],
);

export type PostVersionType = typeof postVersionsTable.$inferSelect;
export type NewPostVersionType = typeof postVersionsTable.$inferInsert;
export type NewPostVersion = typeof postVersionsTable.$inferInsert;
