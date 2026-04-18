/**
 * Shared Blog Type Definitions
 *
 * Central type definitions for blog-related entities to avoid duplication across pages.
 */
import type { ContentType, PostStatus } from '@ottabase/ottablog';
import type { OutputData } from '@ottabase/ottaeditor';

/**
 * Author information from User relationship
 */
export interface PostAuthor {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
}

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
        mediaId?: string;
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
    // Author from User relationship
    authorId: string | null;
    author?: PostAuthor | null;
    isFeatured: boolean;
    allowComments: boolean;
    viewCount: number;
    readingTimeMinutes: number | null;
    wordCount: number | null;
    publishedAt: number | null;
    publishAt: number | null;
    postedAt: number | null;
    createdAt: number;
    updatedAt: number;
    maxVersionsToKeep: number | null;
    appId: string | null;
    organizationId: string | null;
    userId: string | null;
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
    heroImage: { url: string; alt?: string; mediaId?: string } | null;
    // Author from User relationship
    authorId?: string | null;
    author?: PostAuthor | null;
    isFeatured: boolean;
    readingTimeMinutes: number | null;
    publishedAt: number | null;
    createdAt: number;
    updatedAt: number;
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
    createdAt: number;
    updatedAt: number;
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
    createdAt: number;
    wordCount: number | null;
    organizationId: string | null;
    appId: string | null;
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
