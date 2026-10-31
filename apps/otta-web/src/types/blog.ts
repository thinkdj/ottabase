/**
 * Shared Blog Type Definitions
 *
 * Central type definitions for blog-related entities to avoid duplication across pages.
 */
import type { ContentType, HeroImage, PhotoJournalItem, PostCrosspost, PostStatus, SeoMeta } from '@ottabase/ottablog';
import type { OutputData } from '@ottabase/ottaeditor';
import type { FileSource } from '@ottabase/utils/media';

/**
 * Author information from User relationship
 */
export interface PostAuthor {
    id: string;
    name: string | null;
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
    blurbText: string | null;
    /** The same post on Instagram, X, Facebook — one entry may be flagged as the original. */
    crossposts: PostCrosspost[] | null;
    photoNote: string | null;
    photoAlbum: PhotoJournalItem[] | null;
    content: OutputData | null;
    contentType: ContentType;
    status: PostStatus;
    seriesId: string | null;
    seriesOrder: number | null;
    heroImage: HeroImage | null;
    seoMeta: SeoMeta | null;
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
    blurbText: string | null;
    /** The same post on Instagram, X, Facebook — one entry may be flagged as the original. */
    crossposts: PostCrosspost[] | null;
    photoNote: string | null;
    photoAlbum: PhotoJournalItem[] | null;
    contentType: ContentType;
    status: PostStatus;
    heroImage: HeroImage | null;
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
    coverImage: { image: FileSource; alt?: string } | null;
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
