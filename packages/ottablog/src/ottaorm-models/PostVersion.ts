/**
 * PostVersion Model
 *
 * OttaORM model for blog post version history.
 * Stores snapshots of post content on each save for version tracking.
 */
import { BaseModel, ModelFields, type PackageType } from '@ottabase/ottaorm';
import {
    postVersionsTable,
    type NewPostVersion,
    type NewPostVersionType,
    type PostVersionType,
} from './PostVersion.schema';

export {
    postVersionsTable,
    type NewPostVersion,
    type NewPostVersionType,
    type PostVersionType,
} from './PostVersion.schema';

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

    static writable = {
        create: [
            'postId',
            'versionNumber',
            'title',
            'content',
            'excerpt',
            'privateNotes',
            'footnotes',
            'wordCount',
            'changedBy',
            'changeNote',
            'organizationId',
            'appId',
            'createdAt',
        ],
        update: [
            'title',
            'content',
            'excerpt',
            'privateNotes',
            'footnotes',
            'wordCount',
            'changedBy',
            'changeNote',
            'organizationId',
            'appId',
        ],
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
        organizationId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Organization ID' },
            tableConfig: { visible: false },
        },
        appId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'App ID' },
            tableConfig: { visible: false },
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
            organizationId?: string | null;
            appId?: string | null;
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
            organizationId: postData.organizationId ?? undefined,
            appId: postData.appId ?? undefined,
        });
    }
}
