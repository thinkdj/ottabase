/** Fat model for a localized version of a post. */
import type { DbDriver } from '@ottabase/db/drizzle';
import { BaseModel, DomainValidationError, ModelFields, type PackageType } from '@ottabase/ottaorm';
import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import {
    calculateReadingTime,
    generateSlug,
    normalizeLanguageCode,
    normalizePostTimestamp,
    validatePostContent,
    validatePostWrite,
    type BlogLanguageConfig,
    type ContentType,
    type EditorJSData,
    type HeroImage,
    type PhotoJournalItem,
    type PostStatus,
    type SeoMeta,
} from '../types';
import { postTranslationsTable } from './PostTranslation.schema';

export { postTranslationsTable } from './PostTranslation.schema';
export type { NewPostTranslationType, PostTranslationType } from './PostTranslation.schema';

export interface PostTranslationCanonicalData {
    contentType: ContentType;
    excerpt?: string | null;
    blurbText?: string | null;
    photoNote?: string | null;
    photoAlbum?: PhotoJournalItem[] | null;
    content?: EditorJSData | null;
    heroImage?: HeroImage | null;
    footnotes?: EditorJSData | null;
}

export interface PostTranslationWriteData {
    language?: string;
    canonical?: PostTranslationCanonicalData;
    title?: string;
    slug?: string | null;
    excerpt?: string | null;
    blurbText?: string | null;
    photoNote?: string | null;
    photoAlbum?: PhotoJournalItem[] | null;
    content?: EditorJSData | null;
    heroImage?: HeroImage | null;
    seoMeta?: SeoMeta | null;
    footnotes?: EditorJSData | null;
    status?: PostStatus;
    publishAt?: number | null;
    appId?: string | null;
    organizationId?: string | null;
}

export interface TranslationScheduledPublishResult {
    translations: Array<{ id: string; postId: string; language: string; title: string; slug: string }>;
    hasMore: boolean;
}

const MAX_SCHEDULED_TRANSLATION_BATCH = 90;
const MAX_EXCERPT_LENGTH = 2000;
const MAX_SEO_BYTES = 64 * 1024;

function wordCount(content: EditorJSData | null | undefined, extra: string[] = []): { minutes: number; words: number } {
    const base = content ? calculateReadingTime(content) : { minutes: 1, words: 0 };
    const extraWords = extra.filter(Boolean).join(' ').split(/\s+/).filter(Boolean).length;
    return { minutes: Math.max(1, Math.ceil((base.words + extraWords) / 200)), words: base.words + extraWords };
}

function optionalText(value: unknown, label: string, maxLength: number): string | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string') throw new DomainValidationError(label + ' must be text', { status: 422 });
    const normalized = value.replace(/\r\n?/g, '\n').trim();
    if (normalized.length > maxLength) {
        throw new DomainValidationError(label + ' must be ' + maxLength + ' characters or fewer', { status: 422 });
    }
    return normalized || null;
}

function timestampValue(value: unknown): number | null {
    if (value instanceof Date) return value.getTime();
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function removeUndefined(data: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function seoText(value: unknown, label: string, max: number): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') throw new DomainValidationError(label + ' must be text', { status: 422 });
    const normalized = value.trim();
    if (normalized.length > max) throw new DomainValidationError(label + ' is too long', { status: 422 });
    return normalized || undefined;
}

function normalizeSeoMeta(value: unknown): SeoMeta | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new DomainValidationError('SEO metadata must be an object', { status: 422 });
    }
    const raw = value as Record<string, unknown>;
    const result: SeoMeta = {};
    const title = seoText(raw.title, 'SEO title', 200);
    const description = seoText(raw.description, 'SEO description', 500);
    const ogType = seoText(raw.ogType, 'SEO Open Graph type', 50);
    const twitterCard = seoText(raw.twitterCard, 'SEO Twitter card', 40);
    if (title) result.title = title;
    if (description) result.description = description;
    if (ogType) result.ogType = ogType;
    if (twitterCard && ['summary', 'summary_large_image', 'player', 'app'].includes(twitterCard)) {
        result.twitterCard = twitterCard as SeoMeta['twitterCard'];
    } else if (twitterCard) {
        throw new DomainValidationError('SEO Twitter card is invalid', { status: 422 });
    }
    for (const key of ['canonicalUrl', 'ogImage'] as const) {
        const text = seoText(raw[key], 'SEO ' + key, 4096);
        if (text) {
            const safe = sanitizeUrl(text);
            if (safe === '#') throw new DomainValidationError('SEO ' + key + ' must be a safe URL', { status: 422 });
            result[key] = safe;
        }
    }
    if (raw.keywords !== undefined && raw.keywords !== null) {
        if (!Array.isArray(raw.keywords) || raw.keywords.length > 30) {
            throw new DomainValidationError('SEO keywords must be a list of up to 30 items', { status: 422 });
        }
        result.keywords = raw.keywords.map((keyword, index) => {
            const text = seoText(keyword, 'SEO keyword ' + (index + 1), 100);
            if (!text) throw new DomainValidationError('SEO keywords cannot be blank', { status: 422 });
            return text;
        });
    }
    for (const key of ['noIndex', 'noFollow'] as const) {
        if (raw[key] !== undefined && typeof raw[key] !== 'boolean') {
            throw new DomainValidationError('SEO ' + key + ' must be a boolean', { status: 422 });
        }
        if (raw[key] !== undefined) result[key] = raw[key] as boolean;
    }
    if (new TextEncoder().encode(JSON.stringify(result)).length > MAX_SEO_BYTES) {
        throw new DomainValidationError('SEO metadata is too large', { status: 422 });
    }
    return result;
}

function normalizeTranslationData(
    data: PostTranslationWriteData,
    config: BlogLanguageConfig,
    previous?: Record<string, unknown>,
): Record<string, unknown> {
    const canonical = data.canonical;
    const supplied = removeUndefined(data as Record<string, unknown>);
    const effective = { ...(previous ?? {}), ...supplied };
    const valueFor = (key: string, canonicalValue: unknown): unknown => {
        if (Object.prototype.hasOwnProperty.call(supplied, key)) return supplied[key];
        if (previous && Object.prototype.hasOwnProperty.call(previous, key)) return previous[key];
        return canonicalValue;
    };
    const contentType = canonical?.contentType ?? (effective.contentType as ContentType | undefined);
    const inherited = {
        excerpt: valueFor('excerpt', canonical?.excerpt),
        blurbText: valueFor('blurbText', canonical?.blurbText),
        photoNote: valueFor('photoNote', canonical?.photoNote),
        photoAlbum: valueFor('photoAlbum', canonical?.photoAlbum),
        content: valueFor('content', canonical?.content),
        heroImage: valueFor('heroImage', canonical?.heroImage),
        footnotes: valueFor('footnotes', canonical?.footnotes),
    };
    const language = normalizeLanguageCode(effective.language);
    if (!config.supportedLanguages.some((item) => item.code === language)) {
        throw new DomainValidationError('This language is not enabled for the blog', { status: 422 });
    }
    const title = typeof effective.title === 'string' ? effective.title.trim() : '';
    if (title.length < 3 || title.length > 200) {
        throw new DomainValidationError('Translation title must be between 3 and 200 characters', { status: 422 });
    }
    const rawSlug = typeof effective.slug === 'string' ? effective.slug.trim() : '';
    const generated = generateSlug(title);
    const slug = (rawSlug || generated + '-' + language.toLowerCase()).slice(0, 200);
    if (!slug || !/^[A-Za-z0-9_-]+$/.test(slug)) {
        throw new DomainValidationError(
            'Translation slug can only contain letters, numbers, hyphens, and underscores',
            { status: 422 },
        );
    }

    const validated = validatePostWrite({
        contentType,
        status: effective.status ?? 'draft',
        publishAt: effective.publishAt,
        blurbText: inherited.blurbText,
        photoNote: inherited.photoNote,
        photoAlbum: inherited.photoAlbum,
        content: inherited.content,
    });
    const content = validated.content as EditorJSData | null;
    const photoAlbum = validated.photoAlbum as PhotoJournalItem[] | null;
    const blurbText = validated.blurbText as string | null;
    const photoNote = validated.photoNote as string | null;
    const footnotes = validatePostContent(inherited.footnotes);
    const excerpt = optionalText(inherited.excerpt, 'Excerpt', MAX_EXCERPT_LENGTH);
    const seoMeta = normalizeSeoMeta(effective.seoMeta);
    const status = effective.status as PostStatus;
    const publishAt = status === 'scheduled' ? normalizePostTimestamp(effective.publishAt, 'Publish date') : null;
    if (status === 'scheduled' && publishAt === null) {
        throw new DomainValidationError('Scheduled translations must include a publish date', { status: 422 });
    }

    const now = Date.now();
    const previousPublishedAt = timestampValue(previous?.publishedAt);
    const previousPostedAt = timestampValue(previous?.postedAt);
    const publishedAt = status === 'published' ? (previousPublishedAt ?? now) : previousPublishedAt;
    const postedAt = status === 'published' ? (previousPostedAt ?? publishedAt ?? now) : previousPostedAt;
    const stats = wordCount(content, [
        blurbText ?? '',
        photoNote ?? '',
        ...(photoAlbum ?? []).flatMap((item) => [item.caption ?? '', item.location ?? '']),
    ]);

    return {
        language,
        title,
        slug,
        excerpt,
        blurbText,
        photoNote,
        photoAlbum,
        content,
        heroImage: inherited.heroImage ?? null,
        seoMeta,
        footnotes,
        status,
        readingTimeMinutes: stats.minutes,
        wordCount: stats.words,
        publishAt,
        publishedAt,
        postedAt,
    };
}

export class PostTranslation extends BaseModel {
    static entity = 'post_translations';
    static table = postTranslationsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/ottablog';
    static packageType: PackageType = 'package';
    static deferred = ['content', 'footnotes', 'photoAlbum', 'seoMeta'];

    static casts = {
        photoAlbum: 'json' as const,
        content: 'json' as const,
        heroImage: 'json' as const,
        seoMeta: 'json' as const,
        footnotes: 'json' as const,
        readingTimeMinutes: 'number' as const,
        wordCount: 'number' as const,
        publishAt: 'date' as const,
        publishedAt: 'date' as const,
        postedAt: 'date' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    static writable = {
        create: [
            'postId',
            'language',
            'title',
            'slug',
            'excerpt',
            'blurbText',
            'photoNote',
            'photoAlbum',
            'content',
            'heroImage',
            'seoMeta',
            'footnotes',
            'status',
            'publishAt',
            'appId',
            'organizationId',
        ],
        update: [
            'language',
            'title',
            'slug',
            'excerpt',
            'blurbText',
            'photoNote',
            'photoAlbum',
            'content',
            'heroImage',
            'seoMeta',
            'footnotes',
            'status',
            'publishAt',
        ],
    };

    protected static fields: ModelFields = {
        id: { type: 'id', primaryKey: true, editable: false, uiConfig: { label: 'ID' } },
        postId: {
            type: 'string',
            editable: false,
            filterable: true,
            uiConfig: { label: 'Post ID' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        language: {
            type: 'string',
            editable: true,
            filterable: true,
            sortable: true,
            uiConfig: { label: 'Language', description: 'BCP-47 language code' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 100 },
        },
        title: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Title' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 240 },
        },
        slug: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Slug' },
            formConfig: { visible: true, fieldType: 'input' },
            tableConfig: { visible: true, colWidth: 200 },
        },
        excerpt: {
            type: 'string',
            editable: true,
            searchable: true,
            uiConfig: { label: 'Excerpt' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        blurbText: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Blurb text' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        photoNote: {
            type: 'string',
            editable: true,
            uiConfig: { label: 'Photo note' },
            formConfig: { visible: true, fieldType: 'textarea' },
            tableConfig: { visible: false },
        },
        photoAlbum: {
            type: 'json',
            editable: true,
            uiConfig: { label: 'Photo album' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        content: {
            type: 'json',
            editable: true,
            uiConfig: { label: 'Content' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        heroImage: {
            type: 'json',
            editable: true,
            uiConfig: { label: 'Hero image' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        seoMeta: {
            type: 'json',
            editable: true,
            uiConfig: { label: 'SEO metadata' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        footnotes: {
            type: 'json',
            editable: true,
            uiConfig: { label: 'Footnotes' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        status: {
            type: 'string',
            editable: true,
            filterable: true,
            uiConfig: { label: 'Status' },
            formConfig: { visible: true, fieldType: 'select' },
            tableConfig: { visible: true, colWidth: 100 },
        },
        publishAt: {
            type: 'date',
            editable: true,
            uiConfig: { label: 'Publish at' },
            formConfig: { visible: true, fieldType: 'datetime' },
            tableConfig: { visible: false },
        },
        appId: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'App ID' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        organizationId: {
            type: 'string',
            editable: false,
            uiConfig: { label: 'Organization ID' },
            formConfig: { visible: false },
            tableConfig: { visible: false },
        },
        readingTimeMinutes: {
            type: 'number',
            editable: false,
            uiConfig: { label: 'Reading time' },
            tableConfig: { visible: false },
        },
        wordCount: {
            type: 'number',
            editable: false,
            uiConfig: { label: 'Word count' },
            tableConfig: { visible: false },
        },
        createdAt: { type: 'date', editable: false, uiConfig: { label: 'Created' }, tableConfig: { visible: false } },
        updatedAt: { type: 'date', editable: false, uiConfig: { label: 'Updated' }, tableConfig: { visible: false } },
    };

    static async findForPost(
        postId: string,
        language: string,
        options?: { appId?: string | null; organizationId?: string | null; status?: PostStatus },
    ): Promise<PostTranslation | null> {
        const where: Record<string, unknown> = { postId, language: normalizeLanguageCode(language) };
        if (options?.appId !== undefined) where.appId = options.appId;
        if (options?.organizationId !== undefined) where.organizationId = options.organizationId;
        if (options?.status) where.status = options.status;
        return (await this.first(where)) as PostTranslation | null;
    }

    static async forPost(postId: string, options?: { appId?: string | null; organizationId?: string | null }) {
        const where: Record<string, unknown> = { postId };
        if (options?.appId !== undefined) where.appId = options.appId;
        if (options?.organizationId !== undefined) where.organizationId = options.organizationId;
        return this.where(where, { orderBy: 'language', orderDirection: 'asc', withDeferred: true }) as Promise<
            PostTranslation[]
        >;
    }

    static async forPublicPosts(
        postIds: string[],
        options: { language?: string; appId?: string | null; organizationId?: string | null; status?: PostStatus },
    ): Promise<PostTranslation[]> {
        if (postIds.length === 0) return [];
        const where: Record<string, unknown> = {
            postId: postIds,
            ...(options.language ? { language: normalizeLanguageCode(options.language) } : {}),
            status: options.status ?? 'published',
        };
        if (options.appId !== undefined) where.appId = options.appId;
        if (options.organizationId !== undefined) where.organizationId = options.organizationId;
        return this.where(where, {
            orderBy: 'postId',
            orderDirection: 'asc',
            select: [
                'id',
                'postId',
                'language',
                'title',
                'slug',
                'excerpt',
                'blurbText',
                'photoNote',
                'heroImage',
                'status',
                'readingTimeMinutes',
                'wordCount',
                'publishAt',
                'publishedAt',
                'postedAt',
            ],
        }) as Promise<PostTranslation[]>;
    }

    static async forPublicFeed(options: {
        language: string;
        appId?: string | null;
        organizationId?: string | null;
        limit: number;
    }): Promise<PostTranslation[]> {
        const where: Record<string, unknown> = {
            language: normalizeLanguageCode(options.language),
            status: 'published',
        };
        if (options.appId !== undefined) where.appId = options.appId;
        if (options.organizationId !== undefined) where.organizationId = options.organizationId;
        return this.where(where, {
            orderBy: 'publishedAt',
            orderDirection: 'desc',
            limit: options.limit,
            select: [
                'id',
                'postId',
                'language',
                'title',
                'slug',
                'excerpt',
                'blurbText',
                'photoNote',
                'heroImage',
                'status',
                'readingTimeMinutes',
                'wordCount',
                'publishAt',
                'publishedAt',
                'postedAt',
            ],
        }) as Promise<PostTranslation[]>;
    }

    toPublicListJson(): Record<string, unknown> {
        return {
            id: this.get('id'),
            postId: this.get('postId'),
            language: this.get('language'),
            title: this.get('title'),
            slug: this.get('slug'),
            excerpt: this.get('excerpt'),
            blurbText: this.get('blurbText'),
            photoNote: this.get('photoNote'),
            heroImage: this.get('heroImage'),
            status: this.get('status'),
            readingTimeMinutes: this.get('readingTimeMinutes'),
            wordCount: this.get('wordCount'),
            publishAt: this.get('publishAt'),
            publishedAt: this.get('publishedAt'),
            postedAt: this.get('postedAt'),
        };
    }

    static async searchPostIds(
        query: string,
        options: {
            language: string;
            appId?: string | null;
            organizationId?: string | null;
            status?: PostStatus;
            limit?: number;
        },
    ): Promise<string[]> {
        const where: Record<string, unknown> = {
            language: normalizeLanguageCode(options.language),
            status: options.status ?? 'published',
        };
        if (options.appId !== undefined) where.appId = options.appId;
        if (options.organizationId !== undefined) where.organizationId = options.organizationId;
        const rows = await this.search(
            query,
            ['title', 'slug', 'excerpt', 'blurbText', 'photoNote', 'content'],
            where,
            { limit: options.limit ?? 10000, select: ['postId'] },
        );
        return [...new Set(rows.map((row) => String(row.get('postId'))))];
    }

    static async findBySlug(
        slug: string,
        options: { appId?: string | null; organizationId?: string | null; language?: string; status?: PostStatus },
    ): Promise<PostTranslation | null> {
        const where: Record<string, unknown> = { slug };
        if (options.appId !== undefined) where.appId = options.appId;
        if (options.organizationId !== undefined) where.organizationId = options.organizationId;
        if (options.language) where.language = normalizeLanguageCode(options.language);
        if (options.status) where.status = options.status;
        return (await this.first(where)) as PostTranslation | null;
    }

    private static async assertSlugAvailable(
        slug: string,
        scope: { appId?: string | null; organizationId?: string | null },
    ): Promise<void> {
        const { Post } = await import('./Post');
        const canonical = await Post.first({
            slug,
            ...(scope.appId !== undefined ? { appId: scope.appId } : {}),
            ...(scope.organizationId !== undefined ? { organizationId: scope.organizationId } : {}),
        });
        if (canonical) {
            throw new DomainValidationError('Translation slug is already used by a canonical post in this blog', {
                status: 422,
            });
        }
    }

    private static async canonicalDataForPost(postId: string): Promise<PostTranslationCanonicalData> {
        const { Post } = await import('./Post');
        const post = await Post.find(postId);
        if (!post) throw new DomainValidationError('The canonical post no longer exists', { status: 422 });
        return {
            contentType: post.get('contentType') as ContentType,
            excerpt: post.get('excerpt') as string | null,
            blurbText: post.get('blurbText') as string | null,
            photoNote: post.get('photoNote') as string | null,
            photoAlbum: post.get('photoAlbum') as PhotoJournalItem[] | null,
            content: post.get('content') as EditorJSData | null,
            heroImage: post.get('heroImage') as HeroImage | null,
            footnotes: post.get('footnotes') as EditorJSData | null,
        };
    }

    static async createForPost(
        postId: string,
        data: PostTranslationWriteData,
        config: BlogLanguageConfig,
    ): Promise<PostTranslation> {
        const normalized = normalizeTranslationData(
            { ...data, canonical: await this.canonicalDataForPost(postId) },
            config,
        );
        await this.assertSlugAvailable(normalized.slug as string, {
            appId: data.appId,
            organizationId: data.organizationId,
        });
        const existing = await this.findForPost(postId, normalized.language as string, {
            appId: data.appId,
            organizationId: data.organizationId,
        });
        if (existing) return existing.updateContent(normalized, config);
        try {
            return (await this.create({
                postId,
                appId: data.appId ?? null,
                organizationId: data.organizationId ?? null,
                ...normalized,
            })) as PostTranslation;
        } catch (error) {
            if (this.isUniqueConstraintError(error)) {
                const raced = await this.findForPost(postId, normalized.language as string, {
                    appId: data.appId,
                    organizationId: data.organizationId,
                });
                if (raced) return raced.updateContent(normalized, config);
                throw new DomainValidationError('Translation slug is already used in this blog', {
                    status: 422,
                    code: 'TRANSLATION_SLUG_CONFLICT',
                });
            }
            throw error;
        }
    }

    private static isUniqueConstraintError(error: unknown): boolean {
        return /unique|constraint|duplicate/i.test(error instanceof Error ? error.message : String(error));
    }

    async updateContent(
        data: PostTranslationWriteData | Record<string, unknown>,
        config: BlogLanguageConfig,
    ): Promise<PostTranslation> {
        const patch = removeUndefined(data as Record<string, unknown>);
        const normalized = normalizeTranslationData(
            {
                ...(patch as PostTranslationWriteData),
                canonical: await PostTranslation.canonicalDataForPost(String(this.get('postId'))),
            },
            config,
            this.toJson() as Record<string, unknown>,
        );
        await PostTranslation.assertSlugAvailable(normalized.slug as string, {
            appId: this.get('appId') as string | null,
            organizationId: this.get('organizationId') as string | null,
        });
        for (const [key, value] of Object.entries(normalized)) this.set(key, value);
        try {
            return (await this.save()) as PostTranslation;
        } catch (error) {
            if (PostTranslation.isUniqueConstraintError(error)) {
                throw new DomainValidationError('Translation slug is already used in this blog', {
                    status: 422,
                    code: 'TRANSLATION_SLUG_CONFLICT',
                });
            }
            throw error;
        }
    }

    async publish(): Promise<PostTranslation> {
        const now = Date.now();
        const publishedAt = timestampValue(this.get('publishedAt')) ?? now;
        const postedAt = timestampValue(this.get('postedAt')) ?? publishedAt;
        this.set('status', 'published');
        this.set('publishedAt', publishedAt);
        this.set('postedAt', postedAt);
        this.set('publishAt', null);
        return (await this.save()) as PostTranslation;
    }

    async unpublish(): Promise<PostTranslation> {
        this.set('status', 'draft');
        this.set('publishAt', null);
        return (await this.save()) as PostTranslation;
    }

    static async publishScheduled(
        options?: { appId?: string; batchSize?: number },
        driver?: DbDriver,
    ): Promise<TranslationScheduledPublishResult> {
        const batchSize = options?.batchSize ?? MAX_SCHEDULED_TRANSLATION_BATCH;
        if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > MAX_SCHEDULED_TRANSLATION_BATCH) {
            throw new TypeError(
                'publishScheduled batchSize must be an integer from 1 to ' + MAX_SCHEDULED_TRANSLATION_BATCH,
            );
        }
        const now = Date.now();
        const query: Record<string, unknown> = { status: 'scheduled', publishAt: { $lte: now } };
        if (options?.appId) query.appId = options.appId;
        const due = await this.where(query, {
            orderBy: 'publishAt',
            orderDirection: 'asc',
            limit: batchSize + 1,
            select: ['id', 'postId', 'language', 'title', 'slug', 'publishAt', 'publishedAt', 'postedAt'],
        });
        const selected = due.slice(0, batchSize);
        if (selected.length === 0) return { translations: [], hasMore: false };

        const ids = selected.map((translation) => String(translation.get('id')));
        const db = this.getDriver(driver).getDb();
        const translations = await db
            .update(postTranslationsTable)
            .set({
                status: 'published',
                publishedAt: sql.raw('coalesce(published_at, publish_at, ' + String(now) + ')'),
                postedAt: sql.raw('coalesce(posted_at, ' + String(now) + ')'),
                publishAt: null,
                updatedAt: now,
            })
            .where(
                and(
                    inArray(postTranslationsTable.id, ids),
                    eq(postTranslationsTable.status, 'scheduled'),
                    lte(postTranslationsTable.publishAt, now),
                ),
            )
            .returning({
                id: postTranslationsTable.id,
                postId: postTranslationsTable.postId,
                language: postTranslationsTable.language,
                title: postTranslationsTable.title,
                slug: postTranslationsTable.slug,
            });

        return { translations, hasMore: due.length > batchSize };
    }
}
