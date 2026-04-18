/**
 * BlogPost Model
 *
 * OttaORM model for blog posts using @ottabase/ottablog schema.
 * Supports multiple content types, SEO, hero images, and OttaEditor content.
 */
import type { DbDriver } from '@ottabase/db/drizzle';
import { BaseModel, ModelFields, type IModelConstructorParams, type PackageType } from '@ottabase/ottaorm';
import {
    calculateReadingTime,
    CONTENT_TYPES,
    extractExcerpt,
    generateSlug,
    POST_STATUSES,
    type ContentType,
    type EditorJSData,
    type PostStatus,
} from '../types';
import { postsTable } from './Post.schema';
import { postCategoryLinksTable } from './PostCategoryLink';
import { PostTag } from './PostTag';
import { postTagLinksTable } from './PostTagLink';

export { postsTable, type NewPost, type NewPostType, type PostType } from './Post.schema';

/**
 * Post Model - Fat Model Pattern
 */
export class Post extends BaseModel {
    static entity = 'posts';
    static table = postsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';

    static casts = {
        content: 'json' as const,
        heroImage: 'json' as const,
        seoMeta: 'json' as const,
        meta: 'json' as const,
        privateNotes: 'json' as const,
        footnotes: 'json' as const,
        isFeatured: 'boolean' as const,
        allowComments: 'boolean' as const,
        isProtected: 'boolean' as const,
        readingTimeMinutes: 'number' as const,
        wordCount: 'number' as const,
        viewCount: 'number' as const,
        seriesOrder: 'number' as const,
        maxVersionsToKeep: 'number' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
        publishAt: 'date' as const,
        publishedAt: 'date' as const,
        postedAt: 'date' as const,
    };

    protected static defaults = {
        status: 'draft',
        contentType: 'blog',
        isFeatured: false,
        allowComments: true,
        isProtected: false,
        viewCount: 0,
    };

    // Allow server-side writes for system-managed fields (RLS still enforces scope)
    static writable = {
        create: [
            'title',
            'slug',
            'excerpt',
            'content',
            'contentType',
            'status',
            'categoryId',
            'seriesId',
            'seriesOrder',
            'heroImage',
            'seoMeta',
            'meta',
            'privateNotes',
            'footnotes',
            'authorId',
            'readingTimeMinutes',
            'wordCount',
            'isFeatured',
            'allowComments',
            'isProtected',
            'passwordHash',
            'passwordHint',
            'publishAt',
            'publishedAt',
            'postedAt',
            'appId',
            'organizationId',
            'userId',
            'maxVersionsToKeep',
        ],
        update: [
            'title',
            'slug',
            'excerpt',
            'content',
            'contentType',
            'status',
            'categoryId',
            'seriesId',
            'seriesOrder',
            'heroImage',
            'seoMeta',
            'meta',
            'privateNotes',
            'footnotes',
            'authorId',
            'readingTimeMinutes',
            'wordCount',
            'isFeatured',
            'allowComments',
            'isProtected',
            'passwordHash',
            'passwordHint',
            'publishAt',
            'publishedAt',
            'postedAt',
            'appId',
            'organizationId',
            'userId',
            'maxVersionsToKeep',
        ],
    };

    constructor(params: IModelConstructorParams) {
        super(params);
        this.hidden = [...this.hidden, 'passwordHash'];
    }

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
                placeholder: 'Enter post title...',
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
                    max: 'Title must be less than 200 characters',
                },
            },
        },
        slug: {
            type: 'string',
            editable: true,
            searchable: true,
            sortable: true,
            uiConfig: {
                label: 'Slug',
                description: 'URL-friendly identifier',
                placeholder: 'auto-generated-from-title',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: true,
                colWidth: 200,
            },
        },
        excerpt: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Excerpt',
                description: 'Short summary (auto-generated if empty)',
                placeholder: 'Brief description of the post...',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: false,
            },
        },
        content: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Content',
                description: 'Main post content (EditorJS format)',
            },
            formConfig: {
                visible: true,
                fieldType: 'editor' as any,
            },
            tableConfig: {
                visible: false,
            },
        },
        contentType: {
            type: 'string',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: {
                label: 'Content Type',
                description: 'Type of content',
                defaultValue: 'blog',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: Object.entries(CONTENT_TYPES).map(([value, { label }]) => ({
                    label,
                    value,
                })) as any,
            },
            tableConfig: {
                visible: true,
                colWidth: 120,
            },
        },
        status: {
            type: 'string',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: {
                label: 'Status',
                description: 'Publication status',
                defaultValue: 'draft',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
                options: Object.entries(POST_STATUSES).map(([value, { label }]) => ({
                    label,
                    value,
                })) as any,
            },
            tableConfig: {
                visible: true,
                colWidth: 100,
            },
        },
        categoryId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Category',
                description: 'Post category',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        seriesId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Series',
                description: 'Part of a series',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        seriesOrder: {
            type: 'number',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Series Order',
                description: 'Position within the series (1, 2, 3...)',
            },
            formConfig: {
                visible: true,
                fieldType: 'number',
            },
            tableConfig: {
                visible: true,
                colWidth: 120,
            },
        },
        heroImage: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Hero Image',
                description: 'Featured image',
            },
            formConfig: {
                visible: true,
                fieldType: 'image',
            },
            tableConfig: {
                visible: false,
            },
        },
        seoMeta: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'SEO Metadata',
                description: 'SEO and social media metadata',
            },
            formConfig: {
                visible: true,
                fieldType: 'json',
            },
            tableConfig: {
                visible: false,
            },
        },
        meta: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Custom Meta',
                description: 'Free-form key/value metadata (not used by the blog engine)',
            },
            formConfig: {
                visible: true,
                fieldType: 'json',
            },
            tableConfig: {
                visible: false,
            },
        },
        privateNotes: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Private Notes',
            },
            formConfig: {
                visible: true,
                fieldType: 'editor' as any,
            },
            tableConfig: {
                visible: false,
            },
        },
        footnotes: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Footnotes',
            },
            formConfig: {
                visible: true,
                fieldType: 'editor' as any,
            },
            tableConfig: {
                visible: false,
            },
        },
        authorId: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Author',
                description: 'Author user ID (use author() relationship for full info)',
            },
            formConfig: {
                visible: true,
                fieldType: 'select',
            },
            tableConfig: {
                visible: false,
            },
        },
        readingTimeMinutes: {
            type: 'number',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Reading Time',
            },
            tableConfig: {
                visible: true,
                colWidth: 120,
            },
        },
        wordCount: {
            type: 'number',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Word Count',
            },
            tableConfig: {
                visible: true,
                colWidth: 120,
            },
        },
        isFeatured: {
            type: 'boolean',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: {
                label: 'Featured',
                description: 'Pin this post',
                defaultValue: false,
            },
            formConfig: {
                visible: true,
                fieldType: 'boolean',
            },
            tableConfig: {
                visible: true,
                colWidth: 120,
            },
        },
        allowComments: {
            type: 'boolean',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Allow Comments',
                description: 'Enable comments',
                defaultValue: true,
            },
            formConfig: {
                visible: true,
                fieldType: 'boolean',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        isProtected: {
            type: 'boolean',
            editable: true,
            filterable: true,
            uiConfig: {
                label: 'Password protected',
                description: 'Require a password to view full content',
                defaultValue: false,
            },
            formConfig: {
                visible: true,
                fieldType: 'boolean',
            },
            tableConfig: {
                visible: true,
                colWidth: 120,
            },
        },
        passwordHash: {
            type: 'string',
            editable: false,
            uiConfig: {
                label: 'Password (hashed)',
                description: 'Set via password field when enabling protection',
            },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        passwordHint: {
            type: 'string',
            editable: true,
            uiConfig: {
                label: 'Password hint',
                description: 'Optional hint shown on the lock screen',
                placeholder: 'e.g. Our wedding date',
            },
            formConfig: {
                visible: true,
                fieldType: 'input',
            },
            tableConfig: {
                visible: false,
            },
        },
        publishAt: {
            type: 'date',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Publish At',
            },
            formConfig: {
                visible: true,
                fieldType: 'datetime',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        publishedAt: {
            type: 'date',
            editable: true,
            sortable: true,
            uiConfig: {
                label: 'Published At',
            },
            tableConfig: {
                visible: true,
                colWidth: 150,
            },
        },
        postedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Posted At',
            },
            tableConfig: {
                visible: false,
            },
        },
        appId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: {
                label: 'App ID',
                description: 'Auto-set when scopeByAppId is enabled',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: false,
            },
        },
        organizationId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: {
                label: 'Organization ID',
                description: 'Auto-set from security context',
            },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        userId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: {
                label: 'User ID',
                description: 'Owner user (matches security context)',
            },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        maxVersionsToKeep: {
            type: 'number',
            editable: true,
            uiConfig: {
                label: 'Max Versions',
                description: 'Max versions to retain',
            },
            formConfig: {
                visible: true,
                fieldType: 'number',
            },
            tableConfig: {
                visible: false,
            },
        },
        viewCount: {
            type: 'number',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Views',
                description: 'Total page views (auto-tracked)',
            },
            tableConfig: {
                visible: true,
                colWidth: 80,
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
        updatedAt: {
            type: 'date',
            editable: false,
            sortable: true,
            uiConfig: {
                label: 'Updated',
            },
            tableConfig: {
                visible: false,
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
                max: 'Title must be less than 200 characters',
            },
        },
    };

    // ============================================================
    // QUERY HELPERS
    // ============================================================

    /**
     * Find a post by slug (unique per appId)
     */
    static async findBySlug(slug: string, options?: { appId?: string }): Promise<Post | null> {
        const query: Record<string, unknown> = { slug };
        if (options?.appId) query.appId = options.appId;

        const results = await this.where(query);
        return results.length > 0 ? (results[0] as Post) : null;
    }

    /**
     * Search posts using BaseModel search (supports RLS + searchable fields)
     */
    static async search<T extends typeof BaseModel>(
        this: T,
        query: string,
        fields: string[],
        where?: Record<string, any>,
        options?: { orderBy?: string; orderDirection?: 'asc' | 'desc'; limit?: number; offset?: number },
        driver?: DbDriver,
    ): Promise<InstanceType<T>[]> {
        return super.search(query, fields, where, options, driver);
    }

    /**
     * Get all published posts
     */
    static async published(options?: {
        contentType?: ContentType;
        appId?: string;
        limit?: number;
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
    }) {
        const query: Record<string, unknown> = { status: 'published' };
        if (options?.contentType) query.contentType = options.contentType;
        if (options?.appId) query.appId = options.appId;

        return this.where(query, {
            orderBy: options?.orderBy || 'publishedAt',
            orderDirection: options?.orderDirection || 'desc',
            limit: options?.limit,
        });
    }

    /**
     * Get featured posts
     */
    static async featured(options?: {
        status?: PostStatus;
        contentType?: ContentType;
        appId?: string;
        limit?: number;
    }) {
        const query: Record<string, unknown> = { isFeatured: true };
        if (options?.status) query.status = options.status;
        if (options?.contentType) query.contentType = options.contentType;
        if (options?.appId) query.appId = options.appId;

        return this.where(query, {
            orderBy: 'publishedAt',
            orderDirection: 'desc',
            limit: options?.limit,
        });
    }

    /**
     * Get posts by category
     */
    static async byCategory(
        categoryId: string,
        options?: {
            status?: PostStatus;
            appId?: string;
            orderBy?: string;
            orderDirection?: 'asc' | 'desc';
            limit?: number;
        },
    ) {
        const query: Record<string, unknown> = { categoryId };
        if (options?.status) query.status = options.status;
        if (options?.appId) query.appId = options.appId;

        return this.where(query, {
            orderBy: options?.orderBy || 'publishedAt',
            orderDirection: options?.orderDirection || 'desc',
            limit: options?.limit,
        });
    }

    /**
     * Get posts in a series
     */
    static async bySeries(
        seriesId: string,
        options?: {
            status?: PostStatus;
            appId?: string;
            limit?: number;
        },
    ) {
        const query: Record<string, unknown> = { seriesId };
        if (options?.status) query.status = options.status;
        if (options?.appId) query.appId = options.appId;

        return this.where(query, {
            orderBy: 'seriesOrder',
            orderDirection: 'asc',
            limit: options?.limit,
        });
    }

    // ============================================================
    // RELATIONSHIPS
    // ============================================================

    /**
     * Get the author of this post (BelongsTo User)
     */
    async author(select?: string[]) {
        const { User } = await import('@ottabase/ottaorm');

        return this.belongsTo(User as any, 'authorId', {
            select: select || undefined,
        });
    }

    /**
     * Get tags for this post (BelongsToMany PostTag via postTagLinksTable)
     */
    async tags(options?: {
        select?: string[];
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
        withPivot?: string[];
    }) {
        return this.belongsToMany(PostTag, postTagLinksTable, {
            foreignKey: 'postId',
            otherKey: 'tagId',
            ...options,
        });
    }

    /**
     * Get categories for this post (BelongsToMany PostCategory via postCategoryLinksTable)
     */
    async categories(options?: {
        select?: string[];
        orderBy?: string;
        orderDirection?: 'asc' | 'desc';
        withPivot?: string[];
    }) {
        const { PostCategory } = await import('./PostCategory');
        return this.belongsToMany(PostCategory, postCategoryLinksTable, {
            foreignKey: 'postId',
            otherKey: 'categoryId',
            ...options,
        });
    }

    // ============================================================
    // STATIC HELPERS
    // ============================================================

    /**
     * Create post with auto-generated slug from title
     */
    static async createWithSlug(title: string, data?: Record<string, any>) {
        const slug = generateSlug(title);
        return this.create({ title, slug, ...data });
    }

    // ==================== Instance Methods ====================

    /**
     * Publish the post immediately
     */
    async publish() {
        const now = Date.now();
        this.set('status', 'published');
        this.set('publishedAt', this.get('publishedAt') || now);
        this.set('postedAt', now);
        return this.save();
    }

    /**
     * Unpublish (revert to draft)
     */
    async unpublish() {
        this.set('status', 'draft');
        return this.save();
    }

    /**
     * Archive the post
     */
    async archive() {
        this.set('status', 'archived');
        return this.save();
    }

    /**
     * Toggle featured status
     */
    async toggleFeatured() {
        this.set('isFeatured', !this.get('isFeatured'));
        return this.save();
    }

    /**
     * Update reading time and word count from content
     */
    updateReadingStats() {
        const content = this.get('content') as EditorJSData | null;
        if (!content) return;

        const readingTime = calculateReadingTime(content);
        this.set('readingTimeMinutes', readingTime.minutes);
        this.set('wordCount', readingTime.words);
    }

    /**
     * Auto-generate slug from title if not set
     */
    generateSlug() {
        const title = this.get('title') as string;
        if (title && !this.get('slug')) {
            this.set('slug', generateSlug(title));
        }
    }

    /**
     * Auto-generate excerpt from content if not set
     */
    generateExcerpt() {
        const content = this.get('content') as EditorJSData | null;
        if (!content || this.get('excerpt')) return;

        const excerpt = extractExcerpt(content);
        this.set('excerpt', excerpt);
    }

    /**
     * Increment view count (call from API when a post is viewed)
     */
    async trackView() {
        const current = (this.get('viewCount') as number) || 0;
        this.set('viewCount', current + 1);
        return this.save();
    }

    // ============================================================
    // SCHEDULED PUBLISHING
    // ============================================================

    /**
     * Publish all posts whose publishAt timestamp has passed.
     * Call this from a cron handler to auto-publish scheduled posts.
     */
    static async publishScheduled(options?: { appId?: string }): Promise<Post[]> {
        const now = Date.now();
        const query: Record<string, unknown> = { status: 'scheduled' };
        if (options?.appId) query.appId = options.appId;

        const scheduled = await this.where(query);
        const published: Post[] = [];

        for (const post of scheduled) {
            const publishAt = post.get('publishAt') as number | null;
            if (publishAt && publishAt <= now) {
                post.set('status', 'published');
                post.set('publishedAt', publishAt);
                post.set('postedAt', now);
                await post.save();
                published.push(post as Post);
            }
        }

        return published;
    }

    // ============================================================
    // RELATED POSTS
    // ============================================================

    /**
     * Get posts related to this one (same categories via junction, then same content type).
     * Excludes the current post. Returns up to `limit` results.
     */
    static async related(
        postId: string,
        options?: {
            categoryId?: string | null;
            categoryIds?: string[];
            contentType?: string;
            appId?: string;
            limit?: number;
        },
    ): Promise<Post[]> {
        const limit = options?.limit ?? 4;
        const results: Post[] = [];
        const seenIds = new Set<string>([postId]);

        // 1. Same categories via junction table (best signal)
        const catIds = options?.categoryIds?.length ? options.categoryIds : [];
        if (catIds.length > 0) {
            // Find other posts sharing any of the same categories
            const { PostCategoryLink } = await import('./PostCategoryLink');
            const allCatLinks: InstanceType<typeof PostCategoryLink>[] = [];
            for (const cid of catIds) {
                const links = await PostCategoryLink.where({ categoryId: cid });
                allCatLinks.push(...links);
            }
            const candidateIds = [
                ...new Set(allCatLinks.map((l) => l.get('postId') as string).filter((id) => !seenIds.has(id))),
            ];

            if (candidateIds.length > 0) {
                const candidates = await this.whereIn('id', candidateIds, {
                    orderBy: 'publishedAt',
                    orderDirection: 'desc',
                    limit: limit + 1,
                });
                for (const p of candidates) {
                    if (
                        !seenIds.has(p.get('id') as string) &&
                        p.get('status') === 'published' &&
                        results.length < limit
                    ) {
                        results.push(p as Post);
                        seenIds.add(p.get('id') as string);
                    }
                }
            }
        }

        // 1b. Legacy fallback: same category via direct categoryId field
        if (results.length < limit && options?.categoryId) {
            const byCat = await this.where(
                {
                    categoryId: options.categoryId,
                    status: 'published',
                    ...(options?.appId ? { appId: options.appId } : {}),
                },
                { orderBy: 'publishedAt', orderDirection: 'desc', limit: limit + 1 },
            );
            for (const p of byCat) {
                if (!seenIds.has(p.get('id') as string) && results.length < limit) {
                    results.push(p as Post);
                    seenIds.add(p.get('id') as string);
                }
            }
        }

        // 2. Same content type (fallback)
        if (results.length < limit && options?.contentType) {
            const byType = await this.where(
                {
                    contentType: options.contentType,
                    status: 'published',
                    ...(options?.appId ? { appId: options.appId } : {}),
                },
                { orderBy: 'publishedAt', orderDirection: 'desc', limit: limit + 1 },
            );
            for (const p of byType) {
                if (!seenIds.has(p.get('id') as string) && results.length < limit) {
                    results.push(p as Post);
                    seenIds.add(p.get('id') as string);
                }
            }
        }

        return results;
    }

    /**
     * Get most viewed posts (popular posts)
     */
    static async popular(options?: { status?: PostStatus; contentType?: ContentType; appId?: string; limit?: number }) {
        const query: Record<string, unknown> = { status: options?.status || 'published' };
        if (options?.contentType) query.contentType = options.contentType;
        if (options?.appId) query.appId = options.appId;

        return this.where(query, {
            orderBy: 'viewCount',
            orderDirection: 'desc',
            limit: options?.limit ?? 10,
        });
    }
}
