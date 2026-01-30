/**
 * PostVersion Model
 *
 * OttaORM model for blog post version history.
 * Stores snapshots of post content on each save for version tracking.
 */
import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { postsTable } from './tables/PostTable';

/**
 * Post Versions table - content versioning history
 */
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

        // Who made this change (optional)
        changedBy: text('changed_by'),

        // Optional change note/reason
        changeNote: text('change_note'),

        // When this version was created
        createdAt: integer('created_at', { mode: 'timestamp' })
            .notNull()
            .default(sql`(unixepoch())`),
    },
    (table) => [
        // Get versions for a post in order: postId + versionNumber (DESC)
        index('post_versions_post_id_version_idx').on(table.postId, table.versionNumber),

        // Get latest version for a post ordered by creation time
        index('post_versions_post_id_created_at_idx').on(table.postId, table.createdAt),

        // Find versions by creation date for cleanup/archival
        index('post_versions_created_at_idx').on(table.createdAt),
    ],
);

export type NewPostVersion = typeof postVersionsTable.$inferInsert;

export type PostVersionType = typeof postVersionsTable.$inferSelect;
export type NewPostVersionType = typeof postVersionsTable.$inferInsert;

export class PostVersion extends BaseModel {
    static entity = 'post_versions';
    static table = postVersionsTable;
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';
    static primaryKey = 'id';

    static casts = {
        content: 'json' as const,
        privateNotes: 'json' as const,
        footnotes: 'json' as const,
        versionNumber: 'number' as const,
        wordCount: 'number' as const,
        createdAt: 'date' as const,
    };

    protected static fields: ModelFields = {
        id: {
            type: 'id',
            primaryKey: true,
            editable: false,
            uiConfig: {
                label: 'ID',
            },
        },
        postId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: {
                label: 'Post ID',
            },
            tableConfig: {
                visible: false,
            },
        },
        versionNumber: {
            type: 'number',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Version',
                description: 'Version number',
            },
            tableConfig: {
                visible: true,
                colWidth: 80,
            },
        },
        title: {
            type: 'string',
            editable: false,
            searchable: true,
            uiConfig: {
                label: 'Title',
                description: 'Title at this version',
            },
            tableConfig: {
                visible: true,
                colWidth: 'auto',
            },
        },
        content: {
            type: 'json',
            editable: false,
            uiConfig: {
                label: 'Content',
                description: 'Content snapshot',
            },
            tableConfig: {
                visible: false,
            },
        },
        excerpt: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Excerpt',
            },
            tableConfig: {
                visible: false,
            },
        },
        privateNotes: {
            type: 'json',
            editable: false,
            uiConfig: {
                label: 'Private Notes',
            },
            tableConfig: {
                visible: false,
            },
        },
        footnotes: {
            type: 'json',
            editable: false,
            uiConfig: {
                label: 'Footnotes',
            },
            tableConfig: {
                visible: false,
            },
        },
        wordCount: {
            type: 'number',
            editable: false,
            uiConfig: {
                label: 'Words',
            },
            tableConfig: {
                visible: true,
                colWidth: 80,
            },
        },
        changedBy: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Changed By',
                description: 'Who made this change',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        changeNote: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Change Note',
                description: 'Reason for this change',
            },
            tableConfig: {
                visible: true,
                colWidth: 200,
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Created',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
    };

    // ==================== Query Scopes ====================

    /**
     * Get all versions for a post
     */
    static async forPost(
        postId: string,
        options?: {
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
            limit?: number;
        },
    ) {
        return this.where(
            { postId },
            {
                orderBy: options?.orderBy || 'versionNumber',
                orderDirection: options?.orderDirection || 'desc',
                limit: options?.limit,
            },
        );
    }

    /**
     * Get the latest version for a post
     */
    static async latestForPost(postId: string): Promise<PostVersion | null> {
        const versions = await this.forPost(postId, { limit: 1 });
        return versions.length > 0 ? (versions[0] as PostVersion) : null;
    }

    /**
     * Get a specific version by number
     */
    static async getVersion(postId: string, versionNumber: number): Promise<PostVersion | null> {
        const results = await this.where({ postId, versionNumber });
        return results.length > 0 ? (results[0] as PostVersion) : null;
    }

    /**
     * Get the next version number for a post
     */
    static async getNextVersionNumber(postId: string): Promise<number> {
        const latest = await this.latestForPost(postId);
        return latest ? (latest.get('versionNumber') as number) + 1 : 1;
    }

    /**
     * Create a version snapshot from post data
     */
    static async createFromPost(
        postId: string,
        postData: {
            title: string;
            content?: unknown;
            excerpt?: string | null;
            privateNotes?: unknown;
            footnotes?: unknown;
            wordCount?: number | null;
            changedBy?: string | null;
            changeNote?: string | null;
        },
    ) {
        const versionNumber = await this.getNextVersionNumber(postId);
        return this.create({
            postId,
            versionNumber,
            title: postData.title,
            content: postData.content,
            excerpt: postData.excerpt,
            privateNotes: postData.privateNotes,
            footnotes: postData.footnotes,
            wordCount: postData.wordCount,
            changedBy: postData.changedBy,
            changeNote: postData.changeNote,
        });
    }
}
