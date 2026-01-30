// ============================================================
// @ottabase/ottaorm - Post Model
// ============================================================

import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { BaseModel, IModelConstructorParams, ModelFields, type PackageType } from '../base/BaseModel';

/**
 * Post table schema
 */
export const postsTable = sqliteTable('posts', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    content: text('content'),
    excerpt: text('excerpt'),
    status: text('status', { enum: ['draft', 'published', 'archived'] })
        .notNull()
        .default('draft'),
    authorId: text('author_id'),
    // App identifier for multi-app database sharing (nullable, opt-in)
    appId: text('app_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
        .$defaultFn(() => new Date())
        .$onUpdateFn(() => new Date())
        .notNull(),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
});

/**
 * Post model type
 */
export type PostType = typeof postsTable.$inferSelect;
export type NewPostType = typeof postsTable.$inferInsert;

/**
 * Post model - Fat Model Pattern
 *
 * Example blog post model demonstrating relationships and rich metadata
 *
 * @example
 * ```typescript
 * import { Post } from "@ottabase/ottaorm/models";
 * import { setDriver } from "@ottabase/ottaorm";
 * import { createD1Driver } from "@ottabase/db/drizzle-d1";
 *
 * setDriver(createD1Driver(env.OBCF_D1));
 *
 * // Find post by slug
 * const post = await Post.first({ slug: "my-first-post" });
 *
 * // Create post
 * const newPost = await Post.create({
 *   title: "My First Post",
 *   slug: "my-first-post",
 *   content: "This is the content...",
 *   status: "published"
 * });
 *
 * // Get all published posts
 * const posts = await Post.where({ status: "published" });
 *
 * // Generate slug from title
 * const slug = Post.generateSlug("My New Post Title");
 * ```
 */
export class Post extends BaseModel {
    static entity = 'posts';
    static table = postsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottaorm';
    static packageType: PackageType = 'core';

    // UI/Forms metadata
    static displayName = 'Post';
    static displayNamePlural = 'Posts';
    static defaultSort = 'createdAt';
    static defaultSortDirection = 'desc' as const;

    static casts = {
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
        publishedAt: 'date' as const,
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
        title: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Title',
                description: 'Post title',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 'auto',
            },
            validation: {
                rules: 'required|min:3|max:200',
                messages: {
                    required: 'Title is required',
                    min: 'Title must be at least 3 characters',
                    max: 'Title cannot exceed 200 characters',
                },
            },
        },
        slug: {
            type: 'string',
            unique: true,
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Slug',
                description: 'URL-friendly identifier',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 200,
            },
            validation: {
                rules: 'required|unique:posts,slug',
                messages: {
                    required: 'Slug is required',
                    unique: 'This slug already exists',
                },
            },
        },
        content: {
            type: 'text',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Content',
                description: 'Post content',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: false,
            },
        },
        excerpt: {
            type: 'text',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Excerpt',
                description: 'Short summary of the post',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: false,
            },
        },
        status: {
            type: 'string',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Status',
                description: 'Publication status',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: [
                    { value: 'draft', label: 'Draft' },
                    { value: 'published', label: 'Published' },
                    { value: 'archived', label: 'Archived' },
                ],
            },
            tableConfig: {
                visible: true,
                colWidth: 120,
            },
        },
        authorId: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Author',
                description: 'Post author',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                relationship: {
                    entity: 'users',
                    labelField: 'name',
                    valueField: 'id',
                },
            },
            tableConfig: {
                visible: false,
            },
        },
        createdAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Created At',
            },
            tableConfig: {
                visible: true,
            },
        },
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Updated At',
            },
            tableConfig: {
                visible: false,
            },
        },
        publishedAt: {
            type: 'date',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Published At',
                description: 'When the post was published',
            },
            formConfig: {
                visible: true,
                fieldType: 'date',
            },
            tableConfig: {
                visible: true,
            },
        },
    };

    protected static validationRules = {
        title: {
            rules: 'required|min:3|max:200',
            fieldName: 'Title',
            messages: {
                required: 'Title is required',
                min: 'Title must be at least 3 characters',
                max: 'Title cannot exceed 200 characters',
            },
        },
        slug: {
            rules: 'required',
            fieldName: 'Slug',
            messages: {
                required: 'Slug is required',
                unique: 'This slug already exists',
            },
        },
    };

    constructor(data: { [key: string]: any }) {
        const params: IModelConstructorParams = { entity: Post.entity, data };
        super(params);
    }

    // ============================================================
    // RELATIONSHIPS
    // ============================================================

    /**
     * Get the author of this post (BelongsTo User)
     */
    async author() {
        const authorId = this.get('authorId');
        if (!authorId) return null;

        // Dynamic import to avoid circular dependency
        const { User } = await import('./User');
        return User.find(authorId);
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /**
     * Generate slug from title
     */
    static generateSlug(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Create post with auto-generated slug
     */
    static async createWithSlug(title: string, data: Partial<NewPostType> = {}) {
        const slug = this.generateSlug(title);
        return this.create({ ...data, title, slug });
    }

    /**
     * Get all published posts
     */
    static async published(options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number }) {
        return this.where({ status: 'published' }, options);
    }

    /**
     * Get all draft posts
     */
    static async drafts(options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number }) {
        return this.where({ status: 'draft' }, options);
    }

    /**
     * Publish a post
     */
    async publish() {
        return this.update({
            status: 'published',
            publishedAt: new Date(),
        });
    }

    /**
     * Unpublish a post
     */
    async unpublish() {
        return this.update({
            status: 'draft',
            publishedAt: null,
        });
    }
}
