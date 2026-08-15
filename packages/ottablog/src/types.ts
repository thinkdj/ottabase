/**
 * @ottabase/ottablog - Type Definitions
 * Blog and content management types for Ottabase apps
 */
import { sanitizeUrl } from '@ottabase/utils/sanitize';

/**
 * Content type determines the purpose and display style of the content
 */
export type ContentType = 'blog' | 'blurb' | 'photo' | 'changelog' | 'docs' | 'news' | 'announcement';

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
    /** MIME type for feeds and media integrations */
    mimeType?: string;
    /** Max display height in pixels (applied to the hero figure container) */
    maxHeight?: number;
    /** Focal point for cropping (0-100 percentage) */
    focalPoint?: { x: number; y: number };
}

/** One ordered photograph in a photo journal. */
export interface PhotoJournalItem {
    /** Stable identity used by reordering, lightbox deep links, and React rendering. */
    id: string;
    /** Media library identity when the photograph came from Ottabase media. */
    mediaId?: string | null;
    url: string;
    thumbnailUrl?: string | null;
    previewUrl?: string | null;
    title?: string | null;
    alt?: string | null;
    caption?: string | null;
    location?: string | null;
    takenAt?: number | null;
    width?: number | null;
    height?: number | null;
    mimeType?: string | null;
}

/**
 * Post author information from User relationship
 */
export interface PostAuthor {
    /** Author ID (references User) */
    id: string;
    /** Display name */
    name: string | null;
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

/** Maximum length of a blurb. Blurbs are intentionally short-form. */
export const BLURB_MAX_LENGTH = 1000;

/** Expected author-input failure that may safely be returned as a 4xx response. */
export class BlurbValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'BlurbValidationError';
    }
}

/** Normalize author-entered blurb text while preserving deliberate line breaks. */
export function normalizeBlurbText(value: string): string {
    return value.replace(/\r\n?/g, '\n').trim();
}

/** Validate and normalize blurb text at the model/API boundary. */
export function validateBlurbText(value: unknown): string {
    if (typeof value !== 'string') {
        throw new BlurbValidationError('Blurb text is required');
    }

    const text = normalizeBlurbText(value);
    if (!text) throw new BlurbValidationError('Blurb text is required');
    if (text.length > BLURB_MAX_LENGTH) {
        throw new BlurbValidationError(`Blurbs must be ${BLURB_MAX_LENGTH} characters or fewer`);
    }
    return text;
}

/** Internal title used by feeds, admin search, and document metadata. */
export function createBlurbTitle(value: string, maxLength = 120): string {
    const firstLine = normalizeBlurbText(value).split('\n')[0].replace(/\s+/g, ' ').trim();
    const label = firstLine.length <= maxLength ? firstLine : `${firstLine.slice(0, maxLength - 1).trimEnd()}…`;
    return label.length >= 3 ? label : `Thought: ${label}`;
}

/** Plain-text summary used by search, cards, feeds, and SEO. */
export function createBlurbExcerpt(value: string, maxLength = 240): string {
    const singleLine = normalizeBlurbText(value).replace(/\s+/g, ' ');
    return singleLine.length <= maxLength ? singleLine : `${singleLine.slice(0, maxLength - 1).trimEnd()}…`;
}

export const PHOTO_JOURNAL_MAX_ITEMS = 60;
export const PHOTO_JOURNAL_NOTE_MAX_LENGTH = 2000;

/** Expected author-input failure that may safely be exposed as a 4xx response. */
export class PhotoJournalValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PhotoJournalValidationError';
    }
}

function optionalPhotoText(value: unknown, label: string, maxLength: number): string | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') throw new PhotoJournalValidationError(`${label} must be text`);
    const normalized = value.replace(/\r\n?/g, '\n').trim();
    if (normalized.length > maxLength) {
        throw new PhotoJournalValidationError(`${label} must be ${maxLength} characters or fewer`);
    }
    return normalized || null;
}

function safePhotoUrl(value: unknown, label: string, required = false): string | null {
    if (value === undefined || value === null || value === '') {
        if (required) throw new PhotoJournalValidationError(`${label} is required`);
        return null;
    }
    if (typeof value !== 'string') throw new PhotoJournalValidationError(`${label} must be a URL`);
    const trimmed = value.trim();
    const sanitized = sanitizeUrl(trimmed);
    if (sanitized === '#' || !/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(sanitized)) {
        throw new PhotoJournalValidationError(`${label} must use HTTP(S) or an application-relative URL`);
    }
    return sanitized;
}

/** Validate and normalize the complete ordered photo-journal payload. */
export function validatePhotoJournalItems(value: unknown): PhotoJournalItem[] {
    if (!Array.isArray(value) || value.length === 0) {
        throw new PhotoJournalValidationError('A photo journal needs at least one photograph');
    }
    if (value.length > PHOTO_JOURNAL_MAX_ITEMS) {
        throw new PhotoJournalValidationError(`Photo journals support up to ${PHOTO_JOURNAL_MAX_ITEMS} photographs`);
    }

    return value.map((raw, index) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            throw new PhotoJournalValidationError(`Photograph ${index + 1} is invalid`);
        }
        const item = raw as Record<string, unknown>;
        const width = item.width == null ? null : Number(item.width);
        const height = item.height == null ? null : Number(item.height);
        const takenAt = item.takenAt == null ? null : Number(item.takenAt);
        if (width !== null && (!Number.isFinite(width) || width <= 0)) {
            throw new PhotoJournalValidationError(`Photograph ${index + 1} has an invalid width`);
        }
        if (height !== null && (!Number.isFinite(height) || height <= 0)) {
            throw new PhotoJournalValidationError(`Photograph ${index + 1} has an invalid height`);
        }
        if (takenAt !== null && !Number.isFinite(takenAt)) {
            throw new PhotoJournalValidationError(`Photograph ${index + 1} has an invalid date`);
        }

        const mediaId = optionalPhotoText(item.mediaId, 'Media ID', 128);
        return {
            id: optionalPhotoText(item.id, 'Photograph ID', 128) ?? mediaId ?? crypto.randomUUID(),
            mediaId,
            url: safePhotoUrl(item.url, `Photograph ${index + 1} URL`, true)!,
            thumbnailUrl: safePhotoUrl(item.thumbnailUrl, `Photograph ${index + 1} thumbnail`),
            previewUrl: safePhotoUrl(item.previewUrl, `Photograph ${index + 1} preview`),
            title: optionalPhotoText(item.title, 'Photograph title', 180),
            alt: optionalPhotoText(item.alt, 'Alternative text', 300),
            caption: optionalPhotoText(item.caption, 'Caption', 600),
            location: optionalPhotoText(item.location, 'Location', 180),
            takenAt,
            width,
            height,
            mimeType: optionalPhotoText(item.mimeType, 'MIME type', 100),
        };
    });
}

export function validatePhotoJournalNote(value: unknown): string | null {
    return optionalPhotoText(value, 'Field note', PHOTO_JOURNAL_NOTE_MAX_LENGTH);
}

export function createPhotoJournalTitle(
    value: unknown,
    leadPhoto?: Pick<PhotoJournalItem, 'title' | 'caption'>,
    timestamp = Date.now(),
): string {
    const supplied = optionalPhotoText(value, 'Photo journal title', 180);
    if (supplied) return supplied;
    const photoLabel = optionalPhotoText(leadPhoto?.title ?? leadPhoto?.caption, 'Lead photograph title', 180);
    return photoLabel || `Photo journal · ${new Date(timestamp).toISOString().slice(0, 10)}`;
}

export function createPhotoJournalExcerpt(note: string | null, items: PhotoJournalItem[], maxLength = 240): string {
    const source = note || items.map((item) => item.caption).find(Boolean) || `${items.length} photographs`;
    const singleLine = source.replace(/\s+/g, ' ').trim();
    return singleLine.length <= maxLength ? singleLine : `${singleLine.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * All content types with their labels
 */
export const CONTENT_TYPES: Record<ContentType, { label: string; description: string }> = {
    blog: {
        label: 'Blog Post',
        description: 'Standard blog article',
    },
    blurb: {
        label: 'Blurb',
        description: 'A short thought that appears in the blog timeline',
    },
    photo: {
        label: 'Photo Journal',
        description: 'A photo-first story, travel log, or visual field note',
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
 * Display label for a post's content type, safe for UNTRUSTED values.
 *
 * `posts.content_type` is a plain text column with a default, not an enum, and `posts` is exposed
 * through generic CRUD — so a row can legitimately carry a type this build has never heard of.
 * Indexing CONTENT_TYPES directly on such a value yields `undefined` and turns `.label` into a
 * render-time TypeError that takes down the whole list. Fall back to the raw value instead.
 */
export function contentTypeLabel(contentType: string): string {
    return CONTENT_TYPES[contentType as ContentType]?.label ?? contentType;
}

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
