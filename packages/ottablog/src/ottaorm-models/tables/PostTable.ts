/**
 * Post Table Definition
 *
 * Separated from Post.ts to avoid circular dependencies with PostTag.ts
 */
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Posts table - main content storage
 */
export const postsTable = sqliteTable(
    'posts',
    {
        id: text('id')
            .primaryKey()
            .$defaultFn(() => crypto.randomUUID()),

        // Post title
        title: text('title').notNull(),

        // URL-friendly slug (unique per appId)
        slug: text('slug').notNull(),

        // Short excerpt/summary (auto-generated or manual)
        excerpt: text('excerpt'),

        // Main content as EditorJS JSON
        content: text('content', { mode: 'json' }).$type<{
            time?: number;
            blocks: Array<{
                id?: string;
                type: string;
                data: Record<string, unknown>;
            }>;
            version?: string;
        }>(),

        // Content type: blog, changelog, docs, news, announcement
        contentType: text('content_type').notNull().default('blog'),

        // Publication status: draft, published, archived, scheduled
        status: text('status').notNull().default('draft'),

        // Category reference
        categoryId: text('category_id'),

        // Series reference (for multi-part content)
        seriesId: text('series_id'),

        // Order within the series (1, 2, 3, etc.)
        seriesOrder: integer('series_order'),

        // Hero/featured image as JSON
        heroImage: text('hero_image', { mode: 'json' }).$type<{
            url: string;
            alt?: string;
            caption?: string;
            cfImageId?: string;
            width?: number;
            height?: number;
            focalPoint?: { x: number; y: number };
        }>(),

        // SEO metadata as JSON
        seoMeta: text('seo_meta', { mode: 'json' }).$type<{
            title?: string;
            description?: string;
            keywords?: string[];
            canonicalUrl?: string;
            ogImage?: string;
            ogType?: string;
            twitterCard?: string;
            noIndex?: boolean;
            noFollow?: boolean;
        }>(),

        // Private notes (author-only, not shown publicly) - EditorJS JSON format
        privateNotes: text('private_notes', { mode: 'json' }).$type<{
            time?: number;
            blocks: Array<{
                id?: string;
                type: string;
                data: Record<string, unknown>;
            }>;
            version?: string;
        }>(),

        // Public footnotes/endnotes - EditorJS JSON format
        footnotes: text('footnotes', { mode: 'json' }).$type<{
            time?: number;
            blocks: Array<{
                id?: string;
                type: string;
                data: Record<string, unknown>;
            }>;
            version?: string;
        }>(),

        // Author information
        authorId: text('author_id'),
        authorName: text('author_name'),
        authorEmail: text('author_email'),
        authorAvatar: text('author_avatar'),

        // Reading time estimate (stored for performance)
        readingTimeMinutes: integer('reading_time_minutes'),
        wordCount: integer('word_count'),

        // Featured/pinned post
        isFeatured: integer('is_featured', { mode: 'boolean' }).notNull().default(false),

        // Allow comments
        allowComments: integer('allow_comments', { mode: 'boolean' }).notNull().default(true),

        // View count
        viewCount: integer('view_count').notNull().default(0),

        // Scheduled publish date (for scheduled posts)
        publishAt: integer('publish_at', { mode: 'timestamp' }),

        // Actual publish date (editorial/display date)
        publishedAt: integer('published_at', { mode: 'timestamp' }),

        // When post was actually made live (system timestamp)
        postedAt: integer('posted_at', { mode: 'timestamp' }),

        // App identifier for multi-app database sharing
        appId: text('app_id'),

        // Version retention setting (null = keep all, 1-10 = keep last N versions)
        maxVersionsToKeep: integer('max_versions_to_keep'),

        // Timestamps
        createdAt: integer('created_at', { mode: 'timestamp' })
            .notNull()
            .default(sql`(unixepoch())`),

        updatedAt: integer('updated_at', { mode: 'timestamp' })
            .notNull()
            .default(sql`(unixepoch())`)
            .$onUpdate(() => new Date()),
    },
    (table) => [
        // Unique slug per appId
        uniqueIndex('posts_app_id_slug_unique_idx').on(table.appId, table.slug),

        // Published posts query: status + publishedAt (DESC) for sorting
        index('posts_status_published_at_idx').on(table.status, table.publishedAt),

        // Multi-tenant filtering: appId + status + publishedAt for common queries
        index('posts_app_id_status_published_at_idx').on(table.appId, table.status, table.publishedAt),

        // Content type filtering: appId + contentType + status
        index('posts_app_id_content_type_status_idx').on(table.appId, table.contentType, table.status),

        // Author's posts: authorId + status + publishedAt
        index('posts_author_id_status_published_at_idx').on(table.authorId, table.status, table.publishedAt),

        // Category posts: categoryId + status + publishedAt
        index('posts_category_id_status_published_at_idx').on(table.categoryId, table.status, table.publishedAt),

        // Series ordering: seriesId + seriesOrder
        index('posts_series_id_order_idx').on(table.seriesId, table.seriesOrder),

        // Featured posts: isFeatured + publishedAt for featured queries
        index('posts_is_featured_published_at_idx').on(table.isFeatured, table.publishedAt),

        // Scheduled posts: publishAt for auto-publish scheduling
        index('posts_publish_at_idx').on(table.publishAt),

        // App ID single index for other multi-tenant filtering
        index('posts_app_id_idx').on(table.appId),
    ],
);
