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

/**
 * Base for every expected author-input failure on post content.
 *
 * Callers catch THIS rather than listing subclasses: the write boundaries (the blog routes and
 * generic CRUD) turn any of them into a 400, so a new validator must not require every catch
 * site to be found and edited before its error stops being a 500.
 */
export class ContentValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ContentValidationError';
    }
}

/** Largest millisecond value accepted by JavaScript's Date/`toISOString`. */
export const MAX_JAVASCRIPT_DATE_TIMESTAMP = 8_640_000_000_000_000;

function isJavascriptDateTimestamp(value: number): boolean {
    return Number.isFinite(value) && Math.abs(value) <= MAX_JAVASCRIPT_DATE_TIMESTAMP;
}

/** Normalize a D1 timestamp and reject values that cannot represent a real instant. */
export function normalizePostTimestamp(value: unknown, label: string): number | null {
    if (value === undefined || value === null || value === '') return null;

    const timestamp =
        value instanceof Date ? value.getTime() : typeof value === 'number' ? value : new Date(String(value)).getTime();
    if (!isJavascriptDateTimestamp(timestamp) || timestamp <= 0) {
        throw new ContentValidationError(`${label} must be a valid positive date`);
    }
    return Math.trunc(timestamp);
}

/** Expected author-input failure that may safely be returned as a 4xx response. */
export class BlurbValidationError extends ContentValidationError {
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

/**
 * The same content living somewhere else.
 *
 * Modelled as one list rather than a "source URL", because the two directions people actually
 * publish in are the same relationship seen from opposite ends: you either wrote it here and
 * pushed copies to Instagram/X/Facebook (`origin` unset — this post is the original), or you
 * wrote it there and this is the copy (`origin: true` on that one entry). A single URL field
 * could only ever express one of those, and never the common case of three copies at once.
 */
export interface PostCrosspost {
    /** Absolute http(s) permalink to the copy. */
    url: string;
    /** Set on the entry this post was copied FROM. At most one per post; usually none. */
    origin?: boolean;
}

/** Enough for the platforms anyone actually syndicates to, low enough to bound the payload. */
export const MAX_CROSSPOSTS = 10;
export const CROSSPOST_URL_MAX_LENGTH = 2048;

/** Expected author-input failure on the crosspost list of any content type. */
export class CrosspostValidationError extends ContentValidationError {
    constructor(message: string) {
        super(message);
        this.name = 'CrosspostValidationError';
    }
}

/**
 * Validate one crosspost permalink. Absolute HTTP(S) only — unlike a photo URL this always points
 * off-site and is rendered with `target="_blank"`, so an app-relative value is a bug, not a
 * shorthand. Returns null for blank, which the caller drops.
 */
function crosspostUrl(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'string') throw new CrosspostValidationError('Each link must be a URL');

    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > CROSSPOST_URL_MAX_LENGTH) {
        throw new CrosspostValidationError(`Links must be ${CROSSPOST_URL_MAX_LENGTH} characters or fewer`);
    }

    const sanitized = sanitizeUrl(trimmed);
    if (sanitized === '#' || !/^https?:\/\/[^/]/i.test(sanitized)) {
        throw new CrosspostValidationError(`"${trimmed}" is not a full http(s) link`);
    }
    return sanitized;
}

/**
 * Validate the crosspost list. Accepts bare strings as a shorthand for `{ url }` so an API caller
 * can send `["https://…"]`. Blank rows are dropped rather than rejected — the editor always has a
 * trailing empty one — and duplicates collapse to the first occurrence.
 */
export function validateCrossposts(value: unknown): PostCrosspost[] | null {
    if (value === undefined || value === null) return null;
    if (!Array.isArray(value)) throw new CrosspostValidationError('Links must be a list');
    if (value.length > MAX_CROSSPOSTS) {
        throw new CrosspostValidationError(`Up to ${MAX_CROSSPOSTS} links per post`);
    }

    const seen = new Set<string>();
    const items: PostCrosspost[] = [];
    for (const raw of value) {
        const entry = typeof raw === 'string' ? { url: raw } : raw;
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            throw new CrosspostValidationError('Each link must be a URL');
        }
        const url = crosspostUrl((entry as Record<string, unknown>).url);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        // Strictly boolean: a truthy test would read `origin: "false"` as true, and could then
        // reject the whole list for having two originals.
        const origin = (entry as Record<string, unknown>).origin;
        if (origin !== undefined && typeof origin !== 'boolean') {
            throw new CrosspostValidationError('The original marker must be true or false');
        }
        items.push(origin === true ? { url, origin: true } : { url });
    }

    if (items.filter((item) => item.origin).length > 1) {
        throw new CrosspostValidationError('Only one link can be the original');
    }
    return items.length > 0 ? items : null;
}

/** Host shown for a crosspost, e.g. `instagram.com`. Empty when the URL is unusable. */
export function crosspostLabel(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./i, '');
    } catch {
        return '';
    }
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
export const PHOTO_JOURNAL_URL_MAX_LENGTH = 4096;
export const PHOTO_JOURNAL_ALBUM_MAX_BYTES = 512 * 1024;

/** Expected author-input failure that may safely be exposed as a 4xx response. */
export class PhotoJournalValidationError extends ContentValidationError {
    constructor(message: string) {
        super(message);
        this.name = 'PhotoJournalValidationError';
    }
}

/**
 * Serialized ceiling for a post body. D1 caps a whole row, and the body shares that row with the
 * album, the note, and every other column, so the body gets a fraction rather than the lot.
 * Generous for prose: images live in the body as URLs, never as inline data.
 */
export const POST_CONTENT_MAX_BYTES = 512 * 1024;

/** Expected author-input failure on a post body. */
export class PostContentValidationError extends ContentValidationError {
    constructor(message: string) {
        super(message);
        this.name = 'PostContentValidationError';
    }
}

/**
 * Shape- and size-check a post body at the write boundary.
 *
 * Only the envelope is checked: the blocks themselves are the editor's contract and are
 * sanitized at render. This exists so a malformed or unbounded body fails with a 400 instead of
 * reaching the renderer as an unrenderable object, or the database as a row it cannot store.
 *
 * Deliberately NOT photo-journal-specific. `content` is one column shared by every content type,
 * written by both the model's own routes and generic CRUD, so a guard that only covered journals
 * would leave the same column unguarded on every other path into it.
 */
export function validatePostContent(value: unknown): EditorJSData | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'object' || Array.isArray(value) || !Array.isArray((value as EditorJSData).blocks)) {
        throw new PostContentValidationError('Post content must be editor content with a blocks array');
    }

    // Bytes, not characters: what the database stores is UTF-8, and a body of emoji or CJK is
    // twice the bytes of its length.
    const bytes = new TextEncoder().encode(JSON.stringify(value)).length;
    if (bytes > POST_CONTENT_MAX_BYTES) {
        throw new PostContentValidationError(
            `Post content must be ${Math.floor(POST_CONTENT_MAX_BYTES / 1024)}KB or smaller`,
        );
    }
    return value as EditorJSData;
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
    if (trimmed.length > PHOTO_JOURNAL_URL_MAX_LENGTH) {
        throw new PhotoJournalValidationError(`${label} must be ${PHOTO_JOURNAL_URL_MAX_LENGTH} characters or fewer`);
    }
    const sanitized = sanitizeUrl(trimmed);
    if (sanitized.startsWith('//') || sanitized === '#' || !/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(sanitized)) {
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

    // Identity namespaces are intentionally independent. An app-generated photo `id` may happen
    // to equal another asset's media-library ID (or even its URL) without identifying the same
    // photograph. Conflating the namespaces rejected valid albums while still making it hard to
    // explain which identity was duplicated.
    const seenIds = new Set<string>();
    const seenMediaIds = new Set<string>();
    const seenUrls = new Set<string>();
    const items: PhotoJournalItem[] = [];

    value.forEach((raw, index) => {
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
        if (takenAt !== null && !isJavascriptDateTimestamp(takenAt)) {
            throw new PhotoJournalValidationError(`Photograph ${index + 1} has an invalid date`);
        }

        const mediaId = optionalPhotoText(item.mediaId, 'Media ID', 128);
        const entry: PhotoJournalItem = {
            id: optionalPhotoText(item.id, 'Photograph ID', 128) ?? mediaId ?? crypto.randomUUID(),
            mediaId,
            url: safePhotoUrl(item.url, `Photograph ${index + 1} URL`, true)!,
            thumbnailUrl: safePhotoUrl(item.thumbnailUrl, `Photograph ${index + 1} thumbnail`),
            previewUrl: safePhotoUrl(item.previewUrl, `Photograph ${index + 1} preview`),
            title: optionalPhotoText(item.title, 'Photograph title', 180),
            alt: optionalPhotoText(item.alt, 'Alternative text', 300),
            caption: optionalPhotoText(item.caption, 'Caption', 600),
            location: optionalPhotoText(item.location, 'Location', 180),
            takenAt: takenAt === null ? null : Math.trunc(takenAt),
            width,
            height,
            mimeType: optionalPhotoText(item.mimeType, 'MIME type', 100),
        };

        /*
         * The same photograph twice is a caller mistake, and a silently damaging one: `id` is both
         * the React key for the tile and the lightbox registration key, so a repeat renders one
         * frame where two were asked for and leaves that frame unopenable. Reject on ANY identity
         * a duplicate can arrive under — an explicit `id`, the media library's `mediaId`, or the URL
         * itself. Rejecting preserves the caller's ordered album instead of silently changing it.
         */
        if (
            seenIds.has(entry.id) ||
            (entry.mediaId != null && seenMediaIds.has(entry.mediaId)) ||
            seenUrls.has(entry.url)
        ) {
            throw new PhotoJournalValidationError(`Photograph ${index + 1} duplicates an earlier photograph`);
        }
        seenIds.add(entry.id);
        if (entry.mediaId != null) seenMediaIds.add(entry.mediaId);
        seenUrls.add(entry.url);
        items.push(entry);
    });

    const bytes = new TextEncoder().encode(JSON.stringify(items)).length;
    if (bytes > PHOTO_JOURNAL_ALBUM_MAX_BYTES) {
        throw new PhotoJournalValidationError(
            `Photo journal metadata must be ${Math.floor(PHOTO_JOURNAL_ALBUM_MAX_BYTES / 1024)}KB or smaller`,
        );
    }

    return items;
}

export function validatePhotoJournalNote(value: unknown): string | null {
    return optionalPhotoText(value, 'Field note', PHOTO_JOURNAL_NOTE_MAX_LENGTH);
}

/**
 * Every content column on a post, checked as ONE payload, at the only place all writes meet.
 *
 * `Post.prepareForDatabase` runs this, so `create`, `update`, and instance `save()` all inherit it
 * and no caller can opt out — that is the whole point. The routes keep calling it too (generic CRUD
 * does), which turns a throw into a 400 with a useful message instead of a 500; that is now defence
 * in depth rather than the only guard.
 *
 * PATCH semantics, matching the model's write methods: a key that is ABSENT means "not in this
 * write" and is left alone; an explicit `null` clears. Only keys actually present are rewritten, so
 * the result is safe to hand to the database as-is.
 *
 * Cross-field rules exist because the columns are not independent. `contentType` decides which of
 * them are meaningful, and a post claiming one type while carrying another's payload renders as a
 * blank frame or a missing body — the renderer dispatches on `contentType` alone. Those rules apply
 * only when `contentType` is part of THIS write: a partial update that never mentions it cannot be
 * judged without re-reading the row, and a read per write is a cost every caller would pay for a
 * case the write methods already prevent.
 */
export function validatePostWrite<T extends Record<string, any>>(data: T): T {
    const out: Record<string, any> = { ...data };
    const present = (key: string) => key in out && out[key] !== undefined;

    if (present('contentType')) {
        if (
            typeof out.contentType !== 'string' ||
            !Object.prototype.hasOwnProperty.call(CONTENT_TYPES, out.contentType)
        ) {
            throw new ContentValidationError('contentType must be a supported content type');
        }
    }
    if (present('status')) {
        if (typeof out.status !== 'string' || !Object.prototype.hasOwnProperty.call(POST_STATUSES, out.status)) {
            throw new ContentValidationError('status must be a supported publication status');
        }
    }

    if (present('blurbText') && out.blurbText !== null) out.blurbText = validateBlurbText(out.blurbText);
    if (present('photoNote')) out.photoNote = validatePhotoJournalNote(out.photoNote);
    if (present('crossposts')) out.crossposts = validateCrossposts(out.crossposts);
    if (present('content')) out.content = validatePostContent(out.content);
    if (present('publishAt')) out.publishAt = normalizePostTimestamp(out.publishAt, 'Publish date');
    if (present('publishedAt')) out.publishedAt = normalizePostTimestamp(out.publishedAt, 'Published date');
    if (present('postedAt')) out.postedAt = normalizePostTimestamp(out.postedAt, 'Posted date');
    if (present('photoAlbum')) {
        // An empty album is stored as NULL rather than `[]`, so "this post has no photographs" has
        // one representation. The `contentType` rule below is what reports it when that is wrong,
        // with a message about the post rather than about the array.
        const album = out.photoAlbum;
        out.photoAlbum =
            album === null || (Array.isArray(album) && album.length === 0) ? null : validatePhotoJournalItems(album);
    }

    if (!present('contentType')) return out as T;
    const contentType = out.contentType;

    if (contentType === 'photo') {
        if (!present('photoAlbum') || out.photoAlbum === null) {
            throw new PhotoJournalValidationError('A photo journal needs at least one photograph');
        }
    } else if (out.photoAlbum != null || out.photoNote != null) {
        throw new PhotoJournalValidationError(`A ${contentType} post cannot carry a photo album or field note`);
    }

    if (contentType === 'blurb') {
        if (!present('blurbText') || out.blurbText === null) {
            throw new BlurbValidationError('Blurb text is required');
        }
    } else if (out.blurbText != null) {
        throw new BlurbValidationError(`A ${contentType} post cannot carry blurb text`);
    }

    return out as T;
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
