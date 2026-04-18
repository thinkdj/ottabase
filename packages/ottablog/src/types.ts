/**
 * @ottabase/ottablog - Type Definitions
 * Blog and content management types for Ottabase apps
 */

/**
 * Content type determines the purpose and display style of the content
 */
export type ContentType = 'blog' | 'changelog' | 'docs' | 'news' | 'announcement';

/**
 * Publication status of the content
 */
export type PostStatus = 'draft' | 'published' | 'archived' | 'scheduled';

/**
 * SEO metadata for posts
 */
export interface SeoMeta {
    /** Meta title (falls back to post title if not set) */
    title?: string;
    /** Meta description for search engines */
    description?: string;
    /** Keywords for SEO (comma-separated or array) */
    keywords?: string[];
    /** Canonical URL if different from post URL */
    canonicalUrl?: string;
    /** Open Graph image URL */
    ogImage?: string;
    /** Open Graph type (article, website, etc.) */
    ogType?: string;
    /** Twitter card type */
    twitterCard?: 'summary' | 'summary_large_image' | 'player' | 'app';
    /** Whether search engines should index this page */
    noIndex?: boolean;
    /** Whether search engines should follow links */
    noFollow?: boolean;
}

/**
 * Hero image configuration
 */
export interface HeroImage {
    /** Image URL (from R2/Cloudflare Images) */
    url: string;
    /** Alt text for accessibility */
    alt?: string;
    /** Image caption */
    caption?: string;
    /** Cloudflare Image ID (if using CF Images) */
    cfImageId?: string;
    /** Media library item ID (if from media library) */
    mediaId?: string;
    /** Width in pixels */
    width?: number;
    /** Height in pixels */
    height?: number;
    /** Max display height in pixels (applied to the hero figure container) */
    maxHeight?: number;
    /** Focal point for cropping (0-100 percentage) */
    focalPoint?: { x: number; y: number };
}

/**
 * Post author information from User relationship
 */
export interface PostAuthor {
    /** Author ID (references User) */
    id: string;
    /** Display name */
    name: string | null;
    /** Author email */
    email?: string | null;
    /** Author avatar/profile image URL */
    image?: string | null;
}

/**
 * EditorJS output data structure
 * This is what OttaEditor saves
 */
export interface EditorJSData {
    time?: number;
    blocks: Array<{
        id?: string;
        type: string;
        data: Record<string, unknown>;
    }>;
    version?: string;
}

/**
 * Post reading time estimate
 */
export interface ReadingTime {
    /** Estimated minutes to read */
    minutes: number;
    /** Word count */
    words: number;
}

/**
 * All content types with their labels
 */
export const CONTENT_TYPES: Record<ContentType, { label: string; description: string }> = {
    blog: {
        label: 'Blog Post',
        description: 'Standard blog article',
    },
    changelog: {
        label: 'Changelog',
        description: 'Product updates and release notes',
    },
    docs: {
        label: 'Documentation',
        description: 'Help articles and guides',
    },
    news: {
        label: 'News',
        description: 'Company news and press releases',
    },
    announcement: {
        label: 'Announcement',
        description: 'Important announcements and notices',
    },
};

/**
 * All post statuses with their labels
 */
export const POST_STATUSES: Record<PostStatus, { label: string; description: string }> = {
    draft: {
        label: 'Draft',
        description: 'Work in progress, not visible to public',
    },
    published: {
        label: 'Published',
        description: 'Live and visible to public',
    },
    archived: {
        label: 'Archived',
        description: 'Hidden from listings but accessible via direct link',
    },
    scheduled: {
        label: 'Scheduled',
        description: 'Will be published at a future date',
    },
};

/**
 * Default SEO meta values
 */
export const DEFAULT_SEO_META: SeoMeta = {
    ogType: 'article',
    twitterCard: 'summary_large_image',
    noIndex: false,
    noFollow: false,
};

/**
 * Helper to calculate reading time from EditorJS content
 */
export function calculateReadingTime(content: EditorJSData): ReadingTime {
    const wordsPerMinute = 200;
    let wordCount = 0;

    for (const block of content.blocks) {
        if (block.type === 'paragraph' && typeof block.data.text === 'string') {
            wordCount += block.data.text.split(/\s+/).filter(Boolean).length;
        } else if (block.type === 'header' && typeof block.data.text === 'string') {
            wordCount += block.data.text.split(/\s+/).filter(Boolean).length;
        } else if (block.type === 'list' && Array.isArray(block.data.items)) {
            for (const item of block.data.items) {
                if (typeof item === 'string') {
                    wordCount += item.split(/\s+/).filter(Boolean).length;
                } else if (typeof item?.content === 'string') {
                    wordCount += item.content.split(/\s+/).filter(Boolean).length;
                }
            }
        } else if (block.type === 'quote' && typeof block.data.text === 'string') {
            wordCount += block.data.text.split(/\s+/).filter(Boolean).length;
        }
    }

    return {
        words: wordCount,
        minutes: Math.max(1, Math.ceil(wordCount / wordsPerMinute)),
    };
}

/**
 * Helper to generate a URL-safe slug from a title
 */
export function generateSlug(title: string): string {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Helper to extract plain text excerpt from EditorJS content
 */
export function extractExcerpt(content: EditorJSData, maxLength = 160): string {
    const textBlocks: string[] = [];

    for (const block of content.blocks) {
        if (block.type === 'paragraph' && typeof block.data.text === 'string') {
            // Strip HTML tags
            const plainText = block.data.text.replace(/<[^>]*>/g, '');
            textBlocks.push(plainText);
        }
        if (textBlocks.join(' ').length >= maxLength) break;
    }

    const fullText = textBlocks.join(' ');
    if (fullText.length <= maxLength) return fullText;

    // Truncate at word boundary
    const truncated = fullText.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

/**
 * Helper: Format date with default options
 * @param date - Date object or ISO string
 * @param options - Intl.DateTimeFormatOptions for custom formatting
 * @returns Formatted date string
 */
export function formatDate(date: Date | string | number | null, options?: Intl.DateTimeFormatOptions): string {
    if (!date) return '—';

    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    };

    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', options || defaultOptions);
}

/**
 * Helper: Format date in short format (e.g., "Jan 15, 2024")
 * @param date - Date object or ISO string
 * @returns Short formatted date string
 */
export function formatShortDate(date: Date | string | number | null): string {
    return formatDate(date, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}
