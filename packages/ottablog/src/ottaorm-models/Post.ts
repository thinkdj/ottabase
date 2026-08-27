/**
 * BlogPost Model
 *
 * OttaORM model for blog posts using @ottabase/ottablog schema.
 * Supports multiple content types, SEO, hero images, and OttaEditor content.
 */
import type { DbDriver } from '@ottabase/db/drizzle';
import {
    BaseModel,
    DomainValidationError,
    ModelFields,
    type IModelConstructorParams,
    type PackageType,
    type UpdateMutationContext,
} from '@ottabase/ottaorm';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import {
    calculateReadingTime,
    BlurbValidationError,
    ContentValidationError,
    CONTENT_TYPES,
    createBlurbExcerpt,
    createBlurbTitle,
    createPhotoJournalExcerpt,
    createPhotoJournalTitle,
    extractExcerpt,
    generateSlug,
    POST_STATUSES,
    PhotoJournalValidationError,
    validateCrossposts,
    validateBlurbText,
    validatePhotoJournalItems,
    validatePostContent,
    validatePhotoJournalNote,
    validatePostWrite,
    normalizePostTimestamp,
    type ContentType,
    type EditorJSData,
    type PhotoJournalItem,
    type PostCrosspost,
    type PostStatus,
} from '../types';
import { postsTable } from './Post.schema';
import { postCategoryLinksTable } from './PostCategoryLink';
import { PostTag } from './PostTag';
import { postTagLinksTable } from './PostTagLink';

export { postsTable, type NewPost, type NewPostType, type PostType } from './Post.schema';

export interface BlurbWriteOptions {
    /**
     * The same post elsewhere. `undefined` leaves it unchanged on update; `null`/`[]` clears it.
     * A bare string is shorthand for `{ url }`, and the two forms may be mixed in one list.
     */
    crossposts?: Array<PostCrosspost | string> | null;
    status?: PostStatus;
    allowComments?: boolean;
    publishAt?: number | null;
    publishedAt?: number | null;
    appId?: string | null;
    organizationId?: string | null;
    userId?: string | null;
    authorId?: string | null;
}

export interface PhotoJournalWriteOptions extends BlurbWriteOptions {
    title?: string | null;
    note?: string | null;
    isFeatured?: boolean;
    /**
     * Optional rich body rendered under the album. The album stays the opener and the SEO
     * photo list; this is where a journal alternates narrative with its own galleries, using
     * the image and media-gallery blocks the editor already ships.
     */
    content?: EditorJSData | null;
}

export interface ScheduledPublishResult {
    posts: Array<{ id: string; title: string; slug: string }>;
    /** More due rows existed when this bounded batch was selected. */
    hasMore: boolean;
}

/** Leaves five D1 bind slots for status/timestamp predicates and update values. */
const MAX_SCHEDULED_PUBLISH_BATCH = 90;

function photoJournalWordCount(note: string | null, items: PhotoJournalItem[]): number {
    return [note, ...items.map((item) => item.caption), ...items.map((item) => item.location)]
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .split(/\s+/)
        .filter(Boolean).length;
}

function photoJournalHero(item: PhotoJournalItem, title: string) {
    return {
        url: item.url,
        alt: item.alt || item.caption || title,
        caption: item.caption || undefined,
        mediaId: item.mediaId || undefined,
        width: item.width || undefined,
        height: item.height || undefined,
        mimeType: item.mimeType || undefined,
    };
}

const SUBTYPE_WRITE_FIELDS = new Set([
    'blurbText',
    'photoNote',
    'photoAlbum',
    'content',
    'contentType',
    'title',
    'excerpt',
    'heroImage',
    'footnotes',
    'categoryId',
    'seriesId',
    'seriesOrder',
    'readingTimeMinutes',
    'wordCount',
]);

function photoJournalWordCountForWrite(note: string | null, items: PhotoJournalItem[], content: EditorJSData | null) {
    const body = content ? calculateReadingTime(content) : null;
    return {
        readingTimeMinutes: body?.minutes ?? 1,
        wordCount: photoJournalWordCount(note, items) + (body?.words ?? 0),
    };
}

/**
 * Own the publication state machine at the model boundary so every write path agrees.
 * `publishedAt` is the editorial first-publication date; `postedAt` is when the current transition
 * actually went live. Editing an already-live post preserves both, while entering `published`
 * initializes missing values and entering any non-scheduled state clears a stale schedule.
 */
function publicationFieldsForWrite(
    effective: Record<string, any>,
    data: Record<string, any>,
    operation: 'create' | 'update',
    current?: Record<string, any>,
): Record<string, any> {
    const status = (effective.status ?? 'draft') as PostStatus;
    const enteringStatus = operation === 'create' || (data.status !== undefined && data.status !== current?.status);

    if (status === 'scheduled') {
        const publishAt = normalizePostTimestamp(effective.publishAt, 'Publish date');
        if (publishAt === null) {
            throw new ContentValidationError('Scheduled posts must include a publish date');
        }
        return {
            ...(operation === 'create' || enteringStatus || data.publishAt !== undefined ? { publishAt } : {}),
            ...(operation === 'create' ? { publishedAt: null, postedAt: null } : {}),
        };
    }

    if (status === 'published') {
        const now = Date.now();
        const publishedAt = normalizePostTimestamp(effective.publishedAt, 'Published date') ?? now;
        const postedAt = enteringStatus ? now : (normalizePostTimestamp(effective.postedAt, 'Posted date') ?? now);
        return {
            ...(operation === 'create' || enteringStatus ? { publishAt: null } : {}),
            ...(operation === 'create' ||
            enteringStatus ||
            data.publishedAt !== undefined ||
            effective.publishedAt == null
                ? { publishedAt }
                : {}),
            ...(operation === 'create' || enteringStatus || data.postedAt !== undefined || effective.postedAt == null
                ? { postedAt }
                : {}),
        };
    }

    return operation === 'create'
        ? { publishAt: null, publishedAt: null, postedAt: null }
        : data.status !== undefined
          ? { publishAt: null }
          : {};
}

/**
 * Normalize the complete effective post, then return only the fields this operation should
 * write. Updates use a trusted complete current row when the caller already loaded one,
 * otherwise they fetch it so omitted subtype columns are validated and preserved instead
 * of being judged in isolation.
 */
function normalizeWriteData(
    data: Record<string, any>,
    operation: 'create' | 'update',
    current?: Record<string, any>,
): Record<string, any> {
    const currentType = current?.contentType;
    const requestedType = data.contentType;
    const isTypeTransition =
        operation === 'update' &&
        requestedType !== undefined &&
        requestedType !== currentType &&
        (currentType === 'blurb' || currentType === 'photo');
    const effectiveInput = { ...(current ?? {}), ...data };

    // Remove the old subtype's columns before validating the target subtype. Explicit target
    // fields in `data` win, so blurb -> photo and photo -> blurb remain valid transitions.
    if (isTypeTransition) {
        if (currentType === 'blurb') effectiveInput.blurbText = data.blurbText ?? null;
        if (currentType === 'photo') {
            effectiveInput.photoNote = data.photoNote ?? null;
            effectiveInput.photoAlbum = data.photoAlbum ?? null;
        }
    }

    const effective = validatePostWrite(effectiveInput);
    const writeData = {
        ...data,
        ...publicationFieldsForWrite(effective, data, operation, current),
        ...(operation === 'create' ? { authorId: data.authorId ?? data.userId ?? null } : {}),
    };
    const contentType = effective.contentType ?? 'blog';
    const subtypeWrite = operation === 'create' || Object.keys(data).some((key) => SUBTYPE_WRITE_FIELDS.has(key));

    if (contentType === 'blurb' && subtypeWrite) {
        const text = validateBlurbText(effective.blurbText);
        return {
            ...writeData,
            title: createBlurbTitle(text),
            excerpt: createBlurbExcerpt(text),
            blurbText: text,
            photoNote: null,
            photoAlbum: null,
            content: null,
            contentType: 'blurb',
            categoryId: null,
            seriesId: null,
            seriesOrder: null,
            heroImage: null,
            footnotes: null,
            readingTimeMinutes: 1,
            wordCount: text.split(/\s+/).filter(Boolean).length,
            isProtected: false,
            passwordHash: null,
            passwordHint: null,
        };
    }

    if (contentType === 'photo' && subtypeWrite) {
        const items = validatePhotoJournalItems(effective.photoAlbum);
        const note = validatePhotoJournalNote(effective.photoNote);
        const content = validatePostContent(effective.content);
        const title = createPhotoJournalTitle(effective.title, items[0]);
        return {
            ...writeData,
            title,
            excerpt: createPhotoJournalExcerpt(note, items),
            blurbText: null,
            photoNote: note,
            photoAlbum: items,
            content,
            contentType: 'photo',
            categoryId: null,
            seriesId: null,
            seriesOrder: null,
            heroImage: photoJournalHero(items[0], title),
            footnotes: null,
            ...photoJournalWordCountForWrite(note, items, content),
            isProtected: false,
            passwordHash: null,
            passwordHint: null,
        };
    }

    // Leaving a blurb/photo explicitly clears every derived field. A photo body's omission is
    // also an explicit clear: retaining it would make an article carry a hidden journal body.
    if (operation === 'update' && (currentType === 'blurb' || currentType === 'photo') && data.contentType) {
        return {
            ...writeData,
            blurbText: null,
            photoNote: null,
            photoAlbum: null,
            content: data.content === undefined ? null : effective.content,
            heroImage: null,
            footnotes: null,
        };
    }

    if (contentType !== 'blurb' && contentType !== 'photo' && (operation === 'create' || data.content !== undefined)) {
        const content = validatePostContent(effective.content);
        const reading = content ? calculateReadingTime(content) : { minutes: 1, words: 0 };
        return {
            ...writeData,
            content,
            readingTimeMinutes: reading.minutes,
            wordCount: reading.words,
        };
    }

    return operation === 'create'
        ? {
              ...writeData,
              contentType,
              blurbText: null,
              photoNote: null,
              photoAlbum: null,
          }
        : writeData;
}

function normalizeWriteDataForCrud(
    data: Record<string, any>,
    operation: 'create' | 'update',
    current?: Record<string, any>,
): Record<string, any> {
    try {
        return normalizeWriteData(data, operation, current);
    } catch (error) {
        if (error instanceof ContentValidationError) {
            throw new DomainValidationError(error.message, { status: 422 });
        }
        throw error;
    }
}

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
        photoAlbum: 'json' as const,
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

    /**
     * The big JSON columns, skipped by list/feed/sitemap reads.
     *
     * A page of posts renders from `excerpt`, `blurbText`, and `photoAlbum`; it never touches a
     * body. Carrying 15 full bodies out of D1 to drop them at serialization is the single largest
     * avoidable cost on `/blog`. Detail reads (`find`/`first`) are unaffected, so the body is
     * always there when a post page asks for it.
     *
     * `photoAlbum` is deliberately NOT here: the timeline collage genuinely renders it.
     *
     * `privateNotes` is here for the read cost ONLY — it is not what keeps notes private. That is
     * the strip in ottablog's public serializers, which runs on detail reads too. Deleting that
     * strip on the strength of this line would leak notes on every post page.
     */
    static deferred = ['content', 'footnotes', 'privateNotes'];

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
            'blurbText',
            'crossposts',
            'photoNote',
            'photoAlbum',
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
            'isFeatured',
            'allowComments',
            'isProtected',
            'passwordHash',
            'passwordHint',
            'publishAt',
            'appId',
            'organizationId',
            'userId',
            'maxVersionsToKeep',
        ],
        update: [
            'title',
            'slug',
            'excerpt',
            'blurbText',
            'crossposts',
            'photoNote',
            'photoAlbum',
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
            'isFeatured',
            'allowComments',
            'isProtected',
            'passwordHash',
            'passwordHint',
            'publishAt',
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
        blurbText: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Blurb',
                description: 'Short-form thought shown directly in the blog timeline',
                placeholder: 'Share a quick thought...',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: false,
            },
        },
        crossposts: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Also posted at',
                description: 'The same post on Instagram, X, Facebook — flag one as the original if it started there',
            },
            formConfig: {
                visible: false,
            },
            tableConfig: {
                visible: false,
            },
        },
        photoNote: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: {
                label: 'Field note',
                description: 'Optional short context for a photo-first journal',
                placeholder: 'A few words about this place, day, or moment...',
            },
            formConfig: {
                visible: true,
                fieldType: 'textarea',
            },
            tableConfig: {
                visible: false,
            },
        },
        photoAlbum: {
            type: 'json',
            editable: true,
            uiConfig: {
                label: 'Photographs',
                description: 'Ordered photographs and their journal metadata',
            },
            formConfig: {
                visible: false,
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

    /**
     * Content integrity for EVERY write path, per the Fat Models rule in AGENTS.MD.
     *
     * `create`, `update`, and instance `save()` all funnel through `prepareForDatabase`, so this one
     * override is what makes the caps and shape rules unskippable — the convenience methods
     * (createBlurb, createPhotoJournal, updatePhotoJournal) and the routes that re-apply the same
     * validators are now defence in depth, not the only guard. A host app calling `Post.create()`
     * directly inherits identical rules.
     *
     * Deliberately here rather than in `validationRules`: those are per-field string rules resolved
     * against a schema, and these are cross-field (a `contentType` decides which columns may carry
     * a value) with normalization attached (URLs come back sanitized, blank albums come back null).
     *
     * Partial payloads are the norm — `Post.update(id, { viewCount })` sends one column — so
     * `validatePostWrite` judges only what is present. See its own comment for the PATCH contract.
     */
    protected static prepareForDatabase(data: Record<string, any>): Record<string, any> {
        return super.prepareForDatabase(validatePostWrite(data));
    }

    static async create<T extends typeof BaseModel>(
        this: T,
        data: Record<string, any>,
        driver?: DbDriver,
    ): Promise<InstanceType<T>> {
        const withDefaults = { ...(this.defaults as Record<string, any>), ...data };
        const normalized = normalizeWriteDataForCrud(withDefaults, 'create');
        return (await super.create.call(this, normalized, driver)) as InstanceType<T>;
    }

    protected static async prepareUpdateMutation(
        data: Record<string, any>,
        { id, currentData, driver }: UpdateMutationContext,
    ): Promise<Record<string, any>> {
        const canReuseCurrent =
            currentData !== undefined &&
            String(currentData[this.primaryKey]) === String(id) &&
            typeof currentData.contentType === 'string';
        let current = canReuseCurrent ? (currentData as Record<string, any>) : undefined;
        if (!current) {
            const record = await this.find(id, driver);
            if (!record) {
                // Let the guarded persistence statement report the missing/concurrent row.
                return data;
            }
            current = record.toJson() as Record<string, any>;
        }

        return normalizeWriteDataForCrud(data, 'update', current);
    }

    // ============================================================
    // QUERY HELPERS
    // ============================================================

    /**
     * Find a post by slug (unique per appId)
     */
    static async findBySlug(slug: string, options?: { appId?: string }): Promise<Post | null> {
        const query: Record<string, unknown> = { slug };
        if (options?.appId) query.appId = options.appId;

        // `first`, not `where`: this returns ONE post for a detail view, and a collection read
        // would omit the deferred columns, so callers would find the body missing.
        return (await this.first(query)) as Post | null;
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
        return super.search(query, fields, where, options, driver) as Promise<InstanceType<T>[]>;
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

    /**
     * Create a first-class short-form post. Identity and derived search/feed
     * fields are owned by the model so every caller gets the same invariants.
     */
    static async createBlurb(textValue: string, options: BlurbWriteOptions = {}): Promise<Post> {
        const text = validateBlurbText(textValue);
        const now = Date.now();
        const status = options.status ?? 'draft';
        const publishAt = status === 'scheduled' ? normalizePostTimestamp(options.publishAt, 'Publish date') : null;
        if (status === 'scheduled' && publishAt === null) {
            throw new BlurbValidationError('Scheduled blurbs must include a publish date');
        }

        const words = text.split(/\s+/).filter(Boolean).length;
        const publishedAt =
            status === 'published' ? (normalizePostTimestamp(options.publishedAt, 'Published date') ?? now) : null;

        return (await this.create({
            title: createBlurbTitle(text),
            slug: `blurb-${now.toString(36)}-${crypto.randomUUID().slice(0, 8)}`,
            excerpt: createBlurbExcerpt(text),
            blurbText: text,
            crossposts: validateCrossposts(options.crossposts),
            photoNote: null,
            photoAlbum: null,
            content: null,
            contentType: 'blurb',
            categoryId: null,
            seriesId: null,
            seriesOrder: null,
            heroImage: null,
            footnotes: null,
            status,
            readingTimeMinutes: 1,
            wordCount: words,
            isFeatured: false,
            allowComments: options.allowComments ?? true,
            isProtected: false,
            passwordHash: null,
            passwordHint: null,
            publishAt,
            publishedAt,
            postedAt: status === 'published' ? now : null,
            appId: options.appId ?? null,
            organizationId: options.organizationId ?? null,
            userId: options.userId ?? null,
            authorId: options.authorId ?? options.userId ?? null,
        })) as Post;
    }

    /** Create a photo-first post while deriving all compatibility metadata from its lead photograph. */
    static async createPhotoJournal(albumValue: unknown, options: PhotoJournalWriteOptions = {}): Promise<Post> {
        const items = validatePhotoJournalItems(albumValue);
        const note = validatePhotoJournalNote(options.note);
        const now = Date.now();
        const title = createPhotoJournalTitle(options.title, items[0], now);
        const status = options.status ?? 'draft';
        const publishAt = status === 'scheduled' ? normalizePostTimestamp(options.publishAt, 'Publish date') : null;
        if (status === 'scheduled' && publishAt === null) {
            throw new PhotoJournalValidationError('Scheduled photo journals must include a publish date');
        }

        const slugBase = generateSlug(title) || 'photo-journal';
        const publishedAt =
            status === 'published' ? (normalizePostTimestamp(options.publishedAt, 'Published date') ?? now) : null;
        const content = validatePostContent(options.content);
        const body = content ? calculateReadingTime(content) : null;
        return (await this.create({
            title,
            slug: `${slugBase}-${now.toString(36)}-${crypto.randomUUID().slice(0, 6)}`,
            excerpt: createPhotoJournalExcerpt(note, items),
            blurbText: null,
            crossposts: validateCrossposts(options.crossposts),
            photoNote: note,
            photoAlbum: items,
            content,
            contentType: 'photo',
            categoryId: null,
            seriesId: null,
            seriesOrder: null,
            heroImage: photoJournalHero(items[0], title),
            footnotes: null,
            status,
            readingTimeMinutes: body?.minutes ?? 1,
            wordCount: photoJournalWordCount(note, items) + (body?.words ?? 0),
            isFeatured: options.isFeatured ?? false,
            allowComments: options.allowComments ?? true,
            isProtected: false,
            passwordHash: null,
            passwordHint: null,
            publishAt,
            publishedAt,
            postedAt: status === 'published' ? now : null,
            appId: options.appId ?? null,
            organizationId: options.organizationId ?? null,
            userId: options.userId ?? null,
            authorId: options.authorId ?? options.userId ?? null,
        })) as Post;
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

    /** Whether this post uses the short-form blurb contract. */
    isBlurb(): boolean {
        return this.get('contentType') === 'blurb';
    }

    /**
     * Update a blurb and all fields derived from its text. Article-only fields
     * remain unavailable through this method by design.
     */
    async updateBlurb(textValue: string, options: BlurbWriteOptions = {}) {
        if (!this.isBlurb()) throw new BlurbValidationError('Post is not a blurb');

        const text = validateBlurbText(textValue);
        const words = text.split(/\s+/).filter(Boolean).length;
        this.set('blurbText', text);
        // PATCH semantics: absent means unchanged, explicit null/[] clears it.
        if (options.crossposts !== undefined) this.set('crossposts', validateCrossposts(options.crossposts));
        this.set('photoNote', null);
        this.set('photoAlbum', null);
        this.set('title', createBlurbTitle(text));
        this.set('excerpt', createBlurbExcerpt(text));
        this.set('readingTimeMinutes', 1);
        this.set('wordCount', words);
        this.set('content', null);
        this.set('contentType', 'blurb');
        this.set('categoryId', null);
        this.set('seriesId', null);
        this.set('seriesOrder', null);
        this.set('heroImage', null);
        this.set('footnotes', null);
        this.set('isFeatured', false);
        this.set('isProtected', false);
        this.set('passwordHash', null);
        this.set('passwordHint', null);

        if (typeof options.allowComments === 'boolean') this.set('allowComments', options.allowComments);
        if (options.status) {
            const publishAt =
                options.status === 'scheduled' ? normalizePostTimestamp(options.publishAt, 'Publish date') : null;
            if (options.status === 'scheduled' && publishAt === null) {
                throw new BlurbValidationError('Scheduled blurbs must include a publish date');
            }
            this.set('status', options.status);
            this.set('publishAt', publishAt);
            if (options.status === 'published') {
                const now = Date.now();
                this.set(
                    'publishedAt',
                    this.get('publishedAt') || normalizePostTimestamp(options.publishedAt, 'Published date') || now,
                );
                this.set('postedAt', now);
            }
        }

        return this.save();
    }

    isPhotoJournal(): boolean {
        return this.get('contentType') === 'photo';
    }

    /** Update a photo journal while keeping its permalink stable and lead-photo metadata in sync. */
    async updatePhotoJournal(albumValue: unknown, options: PhotoJournalWriteOptions = {}) {
        if (!this.isPhotoJournal()) throw new PhotoJournalValidationError('Post is not a photo journal');

        const items = validatePhotoJournalItems(albumValue);
        // An ABSENT field means "unchanged" on a partial update — fall back to the stored value,
        // exactly as the title does below. Passing `options.note` straight through would validate
        // `undefined` to null and erase the field note (and the excerpt derived from it) on any
        // PATCH that omits it. An explicit `null` still clears it.
        const noteInput = options.note === undefined ? this.get('photoNote') : options.note;
        const note = validatePhotoJournalNote(noteInput);
        const titleInput = options.title === undefined ? this.get('title') : options.title;
        const title = createPhotoJournalTitle(titleInput, items[0]);
        // Absent means unchanged, same as the note above; an explicit null clears the body. Unlike
        // the note, "unchanged" here LEAVES THE ATTRIBUTE ALONE rather than reading and rewriting
        // it: `content` is deferred (see Post.deferred), so a record loaded by a collection read
        // does not carry it, and reading-to-rewrite would blank the body on any such instance.
        // Not setting it keeps the column out of the UPDATE entirely, which is what unchanged means.
        const contentProvided = options.content !== undefined;
        const content = contentProvided ? validatePostContent(options.content) : null;
        const body = contentProvided && content ? calculateReadingTime(content) : null;
        // Read BEFORE the setters below overwrite them: this is the album's contribution to the
        // stored word count as it stands, which is what lets the body's share be recovered.
        const previousAlbumWords = photoJournalWordCount(
            (this.get('photoNote') as string | null) ?? null,
            (this.get('photoAlbum') as PhotoJournalItem[] | null) ?? [],
        );
        const previousTotal = (this.get('wordCount') as number | null) ?? 0;
        this.set('title', title);
        this.set('excerpt', createPhotoJournalExcerpt(note, items));
        this.set('blurbText', null);
        // Same PATCH semantics as everywhere else: absent means unchanged, null/[] clears.
        if (options.crossposts !== undefined) this.set('crossposts', validateCrossposts(options.crossposts));
        this.set('photoNote', note);
        this.set('photoAlbum', items);
        if (contentProvided) this.set('content', content);
        this.set('contentType', 'photo');
        this.set('categoryId', null);
        this.set('seriesId', null);
        this.set('seriesOrder', null);
        this.set('heroImage', photoJournalHero(items[0], title));
        this.set('footnotes', null);
        // Album words always recount, because the note and captions in THIS write changed them.
        // The body's share is recovered by subtracting the album's PREVIOUS words from the stored
        // total, so a note-only edit keeps the body's contribution without reading `content` — which
        // is deferred and may not be loaded. Only when the body is part of the write is its own
        // count authoritative, and only then does reading time change.
        const albumWords = photoJournalWordCount(note, items);
        if (contentProvided) {
            this.set('readingTimeMinutes', body?.minutes ?? 1);
            this.set('wordCount', albumWords + (body?.words ?? 0));
        } else {
            this.set('wordCount', albumWords + Math.max(0, previousTotal - previousAlbumWords));
        }
        this.set('isProtected', false);
        this.set('passwordHash', null);
        this.set('passwordHint', null);

        if (typeof options.allowComments === 'boolean') this.set('allowComments', options.allowComments);
        if (typeof options.isFeatured === 'boolean') this.set('isFeatured', options.isFeatured);
        if (options.status) {
            const publishAt =
                options.status === 'scheduled' ? normalizePostTimestamp(options.publishAt, 'Publish date') : null;
            if (options.status === 'scheduled' && publishAt === null) {
                throw new PhotoJournalValidationError('Scheduled photo journals must include a publish date');
            }
            this.set('status', options.status);
            this.set('publishAt', publishAt);
            if (options.status === 'published') {
                const now = Date.now();
                this.set(
                    'publishedAt',
                    this.get('publishedAt') || normalizePostTimestamp(options.publishedAt, 'Published date') || now,
                );
                this.set('postedAt', now);
            }
        }

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
     * The body, or null when this record came from a collection read that deferred it.
     *
     * `get('content')` THROWS on such a record — deliberately, so a lazy read cannot be mistaken for
     * an empty one (see AbstractBaseModel.get). The derive-from-body helpers below want the other
     * answer: with no body in hand there is nothing to derive, so they leave the stored value alone
     * rather than failing a save that never concerned the body.
     */
    private loadedContent(): EditorJSData | null {
        if (this.omitted.includes('content')) return null;
        return this.get('content') as EditorJSData | null;
    }

    /**
     * Update reading time and word count from content
     */
    updateReadingStats() {
        const content = this.loadedContent();
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
        const content = this.loadedContent();
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
     * Publish one bounded batch of due posts in a single conditional UPDATE.
     *
     * The old row-by-row save loop issued a read plus an update for every post,
     * which could exhaust D1's per-invocation query budget. Selecting at most 91
     * lightweight rows and updating at most 90 IDs keeps both memory and query
     * count constant. The status/time predicates are repeated in the UPDATE so
     * overlapping cron invocations cannot report the same post as published.
     */
    static async publishScheduled(
        options?: { appId?: string; batchSize?: number },
        driver?: DbDriver,
    ): Promise<ScheduledPublishResult> {
        const batchSize = options?.batchSize ?? MAX_SCHEDULED_PUBLISH_BATCH;
        if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > MAX_SCHEDULED_PUBLISH_BATCH) {
            throw new TypeError(
                `publishScheduled batchSize must be an integer from 1 to ${MAX_SCHEDULED_PUBLISH_BATCH}`,
            );
        }

        const now = Date.now();
        const query: Record<string, unknown> = { status: 'scheduled' };
        if (options?.appId) query.appId = options.appId;

        const due = await this.where(
            { ...query, publishAt: { $lte: now } },
            {
                orderBy: 'publishAt',
                orderDirection: 'asc',
                limit: batchSize + 1,
                select: ['id', 'title', 'slug', 'publishAt'],
            },
            driver,
        );
        const selected = due.slice(0, batchSize);
        if (selected.length === 0) return { posts: [], hasMore: false };

        const ids = selected.map((post) => String(post.get('id')));
        const db = this.getDriver(driver).getDb();
        const posts = await db
            .update(postsTable)
            .set({
                status: 'published',
                publishedAt: sql`${postsTable.publishAt}`,
                postedAt: now,
                updatedAt: now,
            })
            .where(and(inArray(postsTable.id, ids), eq(postsTable.status, 'scheduled'), lte(postsTable.publishAt, now)))
            .returning({ id: postsTable.id, title: postsTable.title, slug: postsTable.slug });

        return {
            posts,
            hasMore: due.length > batchSize,
        };
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
            categoryIds?: string[];
            contentType?: string;
            appId?: string;
            /** Org-mode scoping: null = platform-owned rows only; undefined = no org filter. */
            organizationId?: string | null;
            limit?: number;
        },
    ): Promise<Post[]> {
        const limit = options?.limit ?? 4;
        const results: Post[] = [];
        const seenIds = new Set<string>([postId]);
        const orgScoped = options?.organizationId !== undefined;
        const appScoped = !!options?.appId;
        const inAppScope = (p: Post): boolean => !appScoped || p.get('appId') === options?.appId;
        const inOrgScope = (p: Post): boolean =>
            !orgScoped || ((p.get('organizationId') as string | null) ?? null) === (options?.organizationId ?? null);

        // 1. Same categories via junction table (best signal)
        const catIds = options?.categoryIds?.length ? options.categoryIds : [];
        if (catIds.length > 0) {
            // Find other posts sharing any of the same categories — single
            // array-where query (inArray) instead of one query per category.
            const { PostCategoryLink } = await import('./PostCategoryLink');
            const allCatLinks = await PostCategoryLink.where({ categoryId: catIds });
            const candidateIds = [
                ...new Set(allCatLinks.map((l) => l.get('postId') as string).filter((id) => !seenIds.has(id))),
            ];

            if (candidateIds.length > 0) {
                // BaseModel owns D1-safe IN chunking and the stable cross-chunk
                // merge, including the global limit. Keep that logic in one place.
                const candidates = await this.where(
                    {
                        id: candidateIds,
                        status: 'published',
                        ...(options?.appId ? { appId: options.appId } : {}),
                        ...(orgScoped ? { organizationId: options?.organizationId ?? null } : {}),
                    },
                    {
                        orderBy: 'publishedAt',
                        orderDirection: 'desc',
                        limit: limit + 1,
                    },
                );
                for (const p of candidates) {
                    if (
                        !seenIds.has(p.get('id') as string) &&
                        p.get('status') === 'published' &&
                        inAppScope(p as Post) &&
                        inOrgScope(p as Post) &&
                        results.length < limit
                    ) {
                        results.push(p as Post);
                        seenIds.add(p.get('id') as string);
                    }
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
                    ...(orgScoped ? { organizationId: options?.organizationId ?? null } : {}),
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
