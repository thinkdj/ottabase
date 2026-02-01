/**
 * Shared Blog Type Definitions
 *
 * Central type definitions for blog-related entities to avoid duplication across pages.
 */
import type { ContentType, PostStatus } from '@ottabase/ottablog';
import type { OutputData } from '@ottabase/ottaeditor';

/**
 * Blog Post (full detail)
 */
export interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: OutputData | null;
    contentType: ContentType;
    status: PostStatus;
    categoryId: string | null;
    seriesId: string | null;
    seriesOrder: number | null;
    heroImage: {
        url: string;
        alt?: string;
        caption?: string;
        cfImageId?: string;
        width?: number;
        height?: number;
        focalPoint?: { x: number; y: number };
    } | null;
    seoMeta: {
        title?: string;
        description?: string;
        keywords?: string[];
        canonicalUrl?: string;
        ogImage?: string;
        ogType?: string;
        twitterCard?: string;
        noIndex?: boolean;
        noFollow?: boolean;
    } | null;
    privateNotes: OutputData | null;
    footnotes: OutputData | null;
    authorId: string | null;
    authorName: string | null;
    authorEmail: string | null;
    authorAvatar: string | null;
    isFeatured: boolean;
    allowComments: boolean;
    viewCount: number;
    readingTimeMinutes: number | null;
    wordCount: number | null;
    publishedAt: string | null;
    publishAt: string | null;
    postedAt: string | null;
    createdAt: string;
    updatedAt: string;
    maxVersionsToKeep: number | null;
    appId: string | null;
}

/**
 * Blog Post (list view)
 */
export interface BlogPostListItem {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    contentType: ContentType;
    status: PostStatus;
    heroImage: { url: string; alt?: string } | null;
    authorName: string | null;
    authorAvatar: string | null;
    isFeatured: boolean;
    viewCount: number;
    readingTimeMinutes: number | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    seriesId: string | null;
    seriesTitle?: string | null;
}

/**
 * Blog Series
 */
export interface BlogSeries {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    coverImage: string | null;
    isComplete: boolean;
    sortOrder: number | null;
    createdAt: string;
    updatedAt: string;
    appId: string | null;
}

/**
 * Blog Post Version (for version history)
 */
export interface BlogPostVersion {
    id: string;
    postId: string;
    versionNumber: number;
    title: string;
    content: OutputData | null;
    excerpt: string | null;
    privateNotes: OutputData | null;
    footnotes: OutputData | null;
    changedBy?: string | null;
    changeNote?: string | null;
    createdAt: string;
    wordCount: number | null;
}

/**
 * Blog Category
 */
export interface BlogCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    parentId: string | null;
    sortOrder: number | null;
    contentType: ContentType;
    createdAt: string;
    updatedAt: string;
    appId: string | null;
}

/**
 * Blog Tag
 */
export interface BlogTag {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    type: ContentType | null;
    createdAt: string;
    updatedAt: string;
    appId: string | null;
}

/**
 * Re-export shared utilities from @ottabase/ottablog
 * This prevents duplication and ensures consistency
 */
export { formatDate, formatShortDate } from '@ottabase/ottablog';
