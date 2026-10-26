/**
 * Blog route handlers — the package-owned HTTP surface.
 *
 * App-specific behavior enters only through the injected seams in
 * {@link BlogRouterConfig} (DB connect, admin guard, cron auth, password
 * verify, demo seed content, default appId).
 */
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import { isEmail } from '@ottabase/utils/string';
import {
    DomainValidationError,
    globalRLS,
    INSIDER_ROLE_NAME,
    MAX_SEARCH_TERM_BYTES,
    Organization,
    OrganizationMember,
    RLSError,
    Role,
    User,
    UserRole,
    type SecurityContext,
} from '@ottabase/ottaorm';
import {
    OttablogPlugin,
    OttablogSettings,
    PostTranslation,
    OttablogTheme,
    Post,
    PostCategory,
    PostCategoryLink,
    PostSeries,
    PostTag,
    PostTagLink,
} from '../ottaorm-models';
import {
    BLOG_EXPORT_FORMAT,
    BLOG_EXPORT_VERSION,
    BLOG_IMPORT_BATCH_SIZE,
    type BlogExportFile,
    type BlogExportPost,
    type BlogImportResult,
} from '../import-export';
import { blogBasePath, blogPostPath } from '../paths';
import { signPreviewToken, verifyPreviewToken } from '../preview-token';
import { StudioManager, type StudioState } from '../studio';
import {
    ContentValidationError,
    generateSlug,
    LOCKED_TEASER_FIELDS,
    normalizeLanguageCode,
    POST_STATUSES,
    type BlogLanguage,
    type BlogInfo,
    type BlogLanguageConfig,
    type BlogScope,
    type EditorJSData,
    type LockedTeaserField,
    type PostCrosspost,
    type PostStatus,
} from '../types';
import type {
    BlogAdminResult,
    BlogDemoPostSeed,
    BlogEditorialWriteResult,
    BlogHandlers,
    BlogRequestContext,
    BlogRouterConfig,
    BlogTranslationBody,
} from './types';

function parseBoundedInteger(value: unknown, fallback: number, min: number, max: number): number {
    const raw = value == null || value === '' ? '' : String(value);
    if (!/^-?\d+$/.test(raw)) return fallback;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

async function readJson<T>(request: Request): Promise<T> {
    try {
        return (await request.json()) as T;
    } catch {
        return {} as T;
    }
}

/** A published post of one blog by slug. Slugs are unique per blog, never across blogs. */
async function findPublishedPostBySlug(
    slug: string,
    blog: BlogScope,
    contentTypeParam: string | null,
): Promise<Post | null> {
    return Post.first({
        slug,
        status: 'published',
        ...blog,
        ...(contentTypeParam ? { contentType: contentTypeParam } : {}),
    });
}

/** Responses that depend on who is asking, or on state an admin just changed. */
const NO_STORE = { 'Cache-Control': 'no-store' };

/** The blog a public request reads: its scope, and its public identity (null for the site blog). */
interface ResolvedBlog {
    scope: BlogScope;
    info: BlogInfo | null;
}

/** Conservative D1 bound-parameter chunk size for IN (...) lists that carry no other bound conditions. */
const D1_IN_CHUNK = 90;
// Public responses use an explicit allowlist. A user's account/login email is
// private even when that user is the author of public content.
const PUBLIC_AUTHOR_FIELDS = ['id', 'name', 'image'] as const;

/**
 * Chunk size for id-list queries that also carry the list handler's other bound
 * conditions (status, contentType, appId, organizationId, seriesId, pagination,
 * search LIKE terms) in the SAME statement — D1's bound-parameter ceiling covers
 * the whole statement, not just the id list, so this leaves headroom for them.
 */
const D1_FILTERED_ID_CHUNK = 80;

function chunkIds(ids: string[], size = D1_IN_CHUNK): string[][] {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += size) chunks.push(ids.slice(i, i + size));
    return chunks;
}

/** Run an id-list query in D1-safe chunks and concatenate the results. */
async function chunkedFetch<M>(
    ids: string[],
    fetch: (chunk: string[]) => Promise<M[]>,
    size = D1_IN_CHUNK,
): Promise<M[]> {
    const results: M[] = [];
    for (const chunk of chunkIds(ids, size)) {
        results.push(...(await fetch(chunk)));
    }
    return results;
}

/**
 * Post columns an import may set, with their JSON type. Doubles as the export column list.
 * Everything else — ids, scope, authorship, password hash, counters, timestamps the model owns —
 * is derived server-side. Each value still passes the model's write validation.
 */
const IMPORT_FIELD_TYPES = {
    title: 'string',
    slug: 'string',
    language: 'string',
    contentType: 'string',
    status: 'string',
    excerpt: 'string',
    content: 'object',
    blurbText: 'string',
    photoNote: 'string',
    photoAlbum: 'object',
    crossposts: 'object',
    heroImage: 'object',
    seoMeta: 'object',
    originalDate: 'object',
    meta: 'object',
    footnotes: 'object',
    privateNotes: 'object',
    isFeatured: 'boolean',
    allowComments: 'boolean',
    publishAt: 'number',
    publishedAt: 'number',
    seriesOrder: 'number',
} as const;

const MAX_TERM_NAME_LENGTH = 100;

interface ImportPostInput {
    data: Record<string, unknown>;
    tags: string[];
    categories: string[];
    series: string;
    isProtected: boolean;
}

/** Shape-check one untrusted import item. Returns the reason as a string when it is unusable. */
function readImportPost(raw: unknown): ImportPostInput | string {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'Each post must be an object';
    const input = raw as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    for (const [field, kind] of Object.entries(IMPORT_FIELD_TYPES)) {
        const value = input[field];
        if (value === undefined || value === null) continue;
        if (typeof value !== kind) return `${field} must be a ${kind}`;
        data[field] = value;
    }
    if (typeof data.title !== 'string' || !data.title.trim()) return 'Each post needs a title';
    if (data.status !== undefined && !Object.prototype.hasOwnProperty.call(POST_STATUSES, data.status as string)) {
        return `Unknown status "${String(data.status)}"`;
    }
    const names = (value: unknown) =>
        Array.isArray(value)
            ? value
                  .filter((name): name is string => typeof name === 'string')
                  .map((name) => name.trim())
                  .filter((name) => name && name.length <= MAX_TERM_NAME_LENGTH)
            : [];
    return {
        data,
        tags: names(input.tags),
        categories: names(input.categories),
        series: names([input.series])[0] ?? '',
        isProtected: input.isProtected === true,
    };
}

// Letters and digits in any script, plus - and _: what `/blog/$slug` can carry without escaping
// surprises. A provided slug that already fits is kept verbatim so URLs survive a migration.
const IMPORT_SLUG = /^[\p{L}\p{N}_-]{1,200}$/u;

function importSlug(slug: unknown, title: unknown): string {
    const given = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
    if (IMPORT_SLUG.test(given)) return given;
    return generateSlug(given || (typeof title === 'string' ? title : ''));
}

/** The keys a demo seed may carry: the import fields, plus the taxonomy named by name. */
const DEMO_SEED_KEYS = new Set([...Object.keys(IMPORT_FIELD_TYPES), 'tags', 'categories', 'series']);

/**
 * Every reason the demo seeds cannot run as written: a seed the import check refuses, a key it
 * would silently drop (a typo such as `heroimage`), a slug used twice. Empty when they are sound.
 * The seed refuses to write anything until it is; an app's fixture test calls it too.
 */
export function demoSeedProblems(seeds: readonly BlogDemoPostSeed[]): string[] {
    const problems: string[] = [];
    const slugs = new Set<string>();
    for (const seed of seeds) {
        const item = readImportPost(seed);
        if (typeof item === 'string') problems.push(`"${seed.slug}": ${item}`);
        for (const key of Object.keys(seed)) {
            if (!DEMO_SEED_KEYS.has(key)) problems.push(`"${seed.slug}": unknown field "${key}"`);
        }
        if (slugs.has(seed.slug)) problems.push(`"${seed.slug}": slug used twice`);
        slugs.add(seed.slug);
    }
    return problems;
}

type WriteCheck = (entity: typeof Post.entity, data: Record<string, unknown>) => void;

/**
 * Taxonomy by NAME, for import and the demo seed: find-or-create a tag, category or series in one
 * blog's vocabulary, then link terms to a post. `check` runs before every write; import passes its
 * RLS check, the platform-owner seed writes trusted fixtures and passes none.
 */
function taxonomyByName(blog: BlogScope, check: WriteCheck = () => {}) {
    const termIds = new Map<string, string>();
    const ensureTerm = async (kind: 'tag' | 'category' | 'series', name: string): Promise<string> => {
        const key = `${kind}:${name.toLowerCase()}`;
        const cached = termIds.get(key);
        if (cached) return cached;
        const Model = (kind === 'tag' ? PostTag : kind === 'category' ? PostCategory : PostSeries) as typeof PostTag;
        const nameField = kind === 'series' ? 'title' : 'name';
        const where: Record<string, unknown> = { ...blog };
        if (kind !== 'series') where.type = 'post';
        const slug = generateSlug(name);
        let term = await Model.first(slug ? { ...where, slug } : { ...where, [nameField]: name });
        if (!term) {
            const data = { ...where, [nameField]: name };
            check(Model.entity, data);
            term = await Model.create(data);
        }
        const id = term.get('id') as string;
        termIds.set(key, id);
        return id;
    };
    const linkTerms = async (postId: string, tags: string[], categories: string[]) => {
        // A Set: "JS" and "js" resolve to one tag, and the link tables are unique per pair.
        const tagIds = new Set<string>();
        for (const name of tags) tagIds.add(await ensureTerm('tag', name));
        for (const tagId of tagIds) {
            const link = { postId, tagId };
            check(PostTagLink.entity, link);
            await PostTagLink.create(link);
        }
        const categoryIds = new Set<string>();
        for (const name of categories) categoryIds.add(await ensureTerm('category', name));
        for (const categoryId of categoryIds) {
            const link = { postId, categoryId };
            check(PostCategoryLink.entity, link);
            await PostCategoryLink.create(link);
        }
    };
    return { ensureTerm, linkTerms };
}

/**
 * Blank every column that carries the post BODY, for a password-protected post whose reader has
 * not unlocked it. One list, both public projections: the lock screen is worthless if the payload
 * behind it still ships the text. Titles/excerpts stay — they are the teaser the lock screen shows.
 */
function stripProtectedBody(post: Record<string, unknown>): void {
    post.content = null;
    post.footnotes = null;
    post.blurbText = null;
    post.photoNote = null;
    post.photoAlbum = null;
    post.meta = null;
    // Crossposts point at copies of THIS post elsewhere, so leaving them on a protected payload
    // hands a reader the way around the password. Whether those copies are public is the author's
    // business; advertising them from the locked post is not.
    post.crossposts = null;
}

/** What one request may see of the blog's locked (invite-only) categories. */
interface LockState {
    /** Effectively locked categories of the blog scope (a lock covers child categories). */
    lockedCategoryIds: Set<string>;
    /** Fields of a locked post shown to a reader without access. Empty = hidden from them. */
    teaser: LockedTeaserField[];
    /** Locked categories exist and this caller cannot read them. */
    restricted: boolean;
}

const UNLOCKED: LockState = { lockedCategoryIds: new Set(), teaser: [], restricted: false };

/** Grant scope of the site blog: SYSTEM-scoped grants (rbac's SYSTEM_ORGANIZATION_ID). */
const SYSTEM_GRANT_SCOPE = 'system';

/**
 * Locked-post keys a teaser keeps besides the configured teaser fields. An allowlist, so a column
 * added later never ships to readers without access by default. Tags, series, crossposts and SEO
 * are left out: they describe the body.
 */
const TEASER_KEYS = [
    'id',
    'slug',
    'baseSlug',
    'language',
    'baseLanguage',
    'translationId',
    'availableLanguages',
    'contentType',
    'status',
    'publishedAt',
    'author',
    'authorId',
    'categories',
    'isFeatured',
    'readingTimeMinutes',
] as const;

/** A blurb's title and excerpt are cut from its text, so it has nothing safe to tease. */
function isTeasable(contentType: unknown, lock: LockState): boolean {
    return lock.teaser.length > 0 && contentType !== 'blurb';
}

/** The public teaser of a locked post for a reader without access. */
function lockedTeaserJson(post: Record<string, unknown>, teaser: LockedTeaserField[]): Record<string, unknown> {
    const json: Record<string, unknown> = { isLocked: true, teaser: true, allowComments: false };
    for (const key of TEASER_KEYS) if (key in post) json[key] = post[key];
    for (const field of LOCKED_TEASER_FIELDS) json[field] = teaser.includes(field) ? (post[field] ?? null) : null;
    return json;
}

/**
 * Where-clause keeping a restricted reader's results free of what they may not see: every locked
 * post when teasers are off (or `hideAll`), only the un-teasable locked blurbs when they are on.
 */
function lockedPostsWhere(lock: LockState, hideAll = false): Record<string, unknown> {
    if (!lock.restricted) return {};
    if (hideAll || lock.teaser.length === 0) return { isLocked: false };
    return { $or: [{ isLocked: false }, { contentType: { $ne: 'blurb' } }] };
}

/** A response that depends on the caller's access must never be shared by a cache. */
function lockHeaders(lock: LockState): HeadersInit | undefined {
    return lock.lockedCategoryIds.size > 0 ? { 'Cache-Control': 'private, no-store' } : undefined;
}

/**
 * Batch enrichment for a page of posts — flat queries instead of ~5 per post.
 * Output per post is shape-identical to publicPostJson's enriched object
 * (privateNotes stripped, protected content stripped, tags[], categories[],
 * seriesTitle, author{}). Query count is bounded: 6 flat queries per page
 * (each id list chunked at 90 for D1's bound-parameter limit), matching the
 * RSS handler's whereIn batching pattern.
 */
async function enrichPostsJsonBatch(
    records: Post[],
    options?: {
        language?: string | null;
        languageConfig?: BlogLanguageConfig;
        /**
         * Locked categories: flags locked posts and, for a restricted reader, swaps each for its
         * teaser or drops it. Checked against the page's real category links as well as the
         * stored `isLocked` flag, so a stale flag never ships a locked body.
         */
        lock?: LockState;
    },
): Promise<Record<string, unknown>[]> {
    if (records.length === 0) return [];
    const lock = options?.lock ?? UNLOCKED;

    const postIds = records.map((r) => r.get('id') as string);

    // Tags: links → tag rows. Best-effort, same as publicPostJson's per-post
    // try/catch: a transient query failure degrades to empty tags rather than
    // failing the whole page.
    const tagIdsByPost = new Map<string, string[]>();
    const tagJsonById = new Map<string, Record<string, unknown>>();
    try {
        const tagLinks = await chunkedFetch(postIds, (ids) => PostTagLink.where({ postId: ids }));
        for (const link of tagLinks) {
            const pid = link.get('postId') as string;
            const tid = link.get('tagId') as string;
            if (!tagIdsByPost.has(pid)) tagIdsByPost.set(pid, []);
            tagIdsByPost.get(pid)!.push(tid);
        }
        const uniqueTagIds = [...new Set(tagLinks.map((l) => l.get('tagId') as string))];
        const tagRows = await chunkedFetch(uniqueTagIds, (ids) => PostTag.whereIn('id', ids));
        for (const t of tagRows) tagJsonById.set(t.get('id') as string, t.toJson());
    } catch {
        // Tag enrichment is best-effort, same as publicPostJson.
    }

    // Categories: junction links → category rows. Same best-effort fallback
    // as tags above.
    const catIdsByPost = new Map<string, string[]>();
    const catById = new Map<string, { id: string; name: string; slug: string; isLocked: boolean }>();
    try {
        const catLinks = await chunkedFetch(postIds, (ids) => PostCategoryLink.where({ postId: ids }));
        for (const link of catLinks) {
            const pid = link.get('postId') as string;
            const cid = link.get('categoryId') as string;
            if (!catIdsByPost.has(pid)) catIdsByPost.set(pid, []);
            catIdsByPost.get(pid)!.push(cid);
        }
        const uniqueCatIds = [...new Set(catLinks.map((l) => l.get('categoryId') as string))];
        const catRows = await chunkedFetch(uniqueCatIds, (ids) => PostCategory.whereIn('id', ids));
        for (const c of catRows) {
            catById.set(c.get('id') as string, {
                id: c.get('id') as string,
                name: c.get('name') as string,
                slug: c.get('slug') as string,
                isLocked: lock.lockedCategoryIds.has(c.get('id') as string),
            });
        }
    } catch {
        // Category enrichment is best-effort, same as publicPostJson.
    }

    // Authors (public-safe projection only)
    const uniqueAuthorIds = [
        ...new Set(records.map((r) => r.get('authorId') as string | null).filter(Boolean)),
    ] as string[];
    const authorById = new Map<string, { id: unknown; name: unknown; image: unknown }>();
    if (uniqueAuthorIds.length > 0) {
        try {
            const { User } = await import('@ottabase/ottaorm');
            const authors = await chunkedFetch(uniqueAuthorIds, (ids) =>
                User.whereIn('id', ids, { select: [...PUBLIC_AUTHOR_FIELDS] }),
            );
            for (const author of authors) {
                authorById.set(author.get('id') as string, {
                    id: author.get('id'),
                    name: author.get('name'),
                    image: author.get('image'),
                });
            }
        } catch {
            // Author enrichment is best-effort, same as publicPostJson.
        }
    }

    // Series titles
    const uniqueSeriesIds = [
        ...new Set(records.map((r) => r.get('seriesId') as string | null).filter(Boolean)),
    ] as string[];
    const seriesTitleById = new Map<string, string | null>();
    if (uniqueSeriesIds.length > 0) {
        try {
            const seriesRows = await chunkedFetch(uniqueSeriesIds, (ids) => PostSeries.whereIn('id', ids));
            for (const s of seriesRows) seriesTitleById.set(s.get('id') as string, (s.get('title') as string) ?? null);
        } catch {
            // Series enrichment is best-effort, same as publicPostJson.
        }
    }

    const translationByPost = new Map<string, PostTranslation>();
    const publishedLanguagesByPost = new Map<string, string[]>();
    const language = options?.language;
    const publishedTranslations = await PostTranslation.forPublicPosts(postIds);
    for (const translation of publishedTranslations) {
        const postId = translation.get('postId') as string;
        const codes = publishedLanguagesByPost.get(postId) ?? [];
        codes.push(translation.get('language') as string);
        publishedLanguagesByPost.set(postId, codes);
        if (
            language &&
            options?.languageConfig?.supportedLanguages.some((item) => item.code === language) &&
            translation.get('language') === language
        ) {
            translationByPost.set(postId, translation as PostTranslation);
        }
    }

    const rows = records.map((record) => {
        const row = record as Post & { toJson?: () => Record<string, unknown> };
        const j =
            typeof row.toJson === 'function'
                ? row.toJson()
                : {
                      id: record.get('id'),
                      title: record.get('title'),
                      slug: record.get('slug'),
                      excerpt: record.get('excerpt'),
                      blurbText: record.get('blurbText'),
                      photoNote: record.get('photoNote'),
                      photoAlbum: record.get('photoAlbum'),
                      content: record.get('content'),
                      contentType: record.get('contentType'),
                      status: record.get('status'),
                      heroImage: record.get('heroImage'),
                      seoMeta: record.get('seoMeta'),
                      footnotes: record.get('footnotes'),
                      readingTimeMinutes: record.get('readingTimeMinutes'),
                      wordCount: record.get('wordCount'),
                      publishAt: record.get('publishAt'),
                      publishedAt: record.get('publishedAt'),
                      postedAt: record.get('postedAt'),
                      authorId: record.get('authorId'),
                  };
        const { privateNotes, ...baseRest } = j;
        const rest = mergeTranslationJson(
            baseRest,
            translationByPost.get(record.get('id') as string) ?? null,
            options?.languageConfig,
            false,
            publishedLanguagesByPost.get(record.get('id') as string),
        );

        if (rest.isProtected) stripProtectedBody(rest);

        const postId = rest.id as string;
        rest.author = rest.authorId ? (authorById.get(rest.authorId as string) ?? null) : null;
        rest.tags = (tagIdsByPost.get(postId) ?? []).map((tid) => tagJsonById.get(tid)).filter(Boolean);
        rest.categories = (catIdsByPost.get(postId) ?? []).map((cid) => catById.get(cid)).filter(Boolean);
        rest.seriesTitle = rest.seriesId ? (seriesTitleById.get(rest.seriesId as string) ?? null) : null;

        // A collection read never SELECTs Post.deferred, and `toJson()` walks loaded attributes, so
        // those columns would be absent from a list payload while a detail payload carries them —
        // the same endpoint family answering with two different shapes, and `post.content === null`
        // quietly false on one of them. Normalize to null: a list says "no body here", not "no such
        // field". privateNotes is excluded on purpose — it is destructured off above and must stay
        // off, not come back as an always-null key advertising that the column exists.
        for (const column of Post.deferred) {
            if (column !== 'privateNotes' && !(column in rest)) rest[column] = null;
        }

        const isLocked =
            lock.lockedCategoryIds.size > 0 &&
            (record.get('isLocked') === true ||
                (catIdsByPost.get(postId) ?? []).some((cid) => lock.lockedCategoryIds.has(cid)));
        rest.isLocked = isLocked;
        if (isLocked && lock.restricted) {
            return isTeasable(rest.contentType, lock) ? lockedTeaserJson(rest, lock.teaser) : null;
        }

        return rest;
    });
    return rows.filter((row): row is Record<string, unknown> => row !== null);
}

/**
 * Convert a Post model to a public-safe JSON object.
 * Strips privateNotes. Strips content from protected posts unless explicitly included.
 * Optionally enriches with tags, category name, and author info.
 */
function mergeTranslationJson(
    base: Record<string, unknown>,
    translation: PostTranslation | null,
    languageConfig?: BlogLanguageConfig,
    includeDeferred = true,
    publishedTranslationLanguages?: string[],
): Record<string, unknown> {
    const baseLanguage = typeof base.language === 'string' ? base.language : 'en';
    const translated = translation
        ? ((includeDeferred ? translation.toJson() : translation.toPublicListJson()) as Record<string, unknown>)
        : undefined;
    const localized: Record<string, unknown> = translated
        ? {
              ...base,
              title: translated.title,
              slug: translated.slug,
              baseSlug: base.slug,
              excerpt: translated.excerpt ?? base.excerpt,
              blurbText: translated.blurbText ?? base.blurbText,
              photoNote: translated.photoNote ?? base.photoNote,
              ...(includeDeferred
                  ? {
                        photoAlbum: translated.photoAlbum ?? base.photoAlbum,
                        content: translated.content ?? base.content,
                        seoMeta: translated.seoMeta ?? base.seoMeta,
                        footnotes: translated.footnotes ?? base.footnotes,
                    }
                  : {}),
              heroImage: translated.heroImage ?? base.heroImage,
              status: translated.status,
              readingTimeMinutes: translated.readingTimeMinutes,
              wordCount: translated.wordCount,
              publishAt: translated.publishAt,
              publishedAt: translated.publishedAt,
              postedAt: translated.postedAt,
              language: translated.language,
              baseLanguage,
              translationId: translated.id,
          }
        : { ...base, language: baseLanguage, baseLanguage, baseSlug: base.slug };
    const availableCodes = new Set([baseLanguage, ...(publishedTranslationLanguages ?? [])]);
    const configuredLanguages =
        languageConfig?.supportedLanguages.filter((item) => availableCodes.has(item.code)) ?? [];
    localized.availableLanguages =
        configuredLanguages.length > 0 ? configuredLanguages : [{ code: baseLanguage, name: baseLanguage }];
    return localized;
}

async function publicPostJson(
    record: Post,
    options?: {
        includeContent?: boolean;
        enrichTags?: boolean;
        enrichCategory?: boolean;
        enrichSeries?: boolean;
        enrichAuthor?: boolean;
        translation?: PostTranslation | null;
        languageConfig?: BlogLanguageConfig;
        /** Effectively locked categories of the blog, to flag each category. */
        lockedCategoryIds?: Set<string>;
    },
) {
    const j = record.toJson() as Record<string, unknown>;
    const { privateNotes, ...baseRest } = j;
    const publishedTranslations = options?.languageConfig
        ? await PostTranslation.forPublicPosts([String(record.get('id'))])
        : [];
    const rest = mergeTranslationJson(
        baseRest,
        options?.translation ?? null,
        options?.languageConfig,
        true,
        publishedTranslations.map((item) => item.get('language') as string),
    );

    // Strip content from protected posts
    if (rest.isProtected && !options?.includeContent) stripProtectedBody(rest);

    // Enrich with author info from User relationship
    if (options?.enrichAuthor && rest.authorId) {
        try {
            const author = await record.author([...PUBLIC_AUTHOR_FIELDS]);
            if (author) {
                rest.author = {
                    id: author.get('id'),
                    name: author.get('name'),
                    image: author.get('image'),
                };
            } else {
                rest.author = null;
            }
        } catch {
            rest.author = null;
        }
    }

    // Enrich with tags
    if (options?.enrichTags) {
        try {
            const tagModels = await record.tags();
            rest.tags = tagModels.map((t) => t.toJson());
        } catch {
            rest.tags = [];
        }
    }

    // Enrich with categories (many-to-many via PostCategoryLink)
    if (options?.enrichCategory) {
        try {
            const categoryLinks = await PostCategoryLink.where({ postId: rest.id as string });
            if (categoryLinks.length > 0) {
                const categoryIds = categoryLinks.map((cl) => cl.get('categoryId') as string);
                const categoryModels = await Promise.all(categoryIds.map((id) => PostCategory.find(id)));
                rest.categories = categoryModels.filter(Boolean).map((c) => ({
                    id: c!.get('id'),
                    name: c!.get('name'),
                    slug: c!.get('slug'),
                    isLocked: options?.lockedCategoryIds?.has(c!.get('id') as string) ?? false,
                }));
            } else {
                rest.categories = [];
            }
        } catch {
            rest.categories = [];
        }
    }

    // Enrich with series title
    if (options?.enrichSeries && rest.seriesId) {
        try {
            const series = await PostSeries.find(rest.seriesId as string);
            rest.seriesTitle = series ? series.get('title') : null;
        } catch {
            rest.seriesTitle = null;
        }
    }

    return rest;
}

/**
 * Build the full set of blog handlers with app dependencies injected.
 * Handlers are self-contained closures; the returned object satisfies {@link BlogHandlers}.
 */
export function createBlogHandlers<Env = unknown>(config: BlogRouterConfig<Env>): BlogHandlers<Env> {
    type Ctx = BlogRequestContext<Env>;

    function resolveAppId(context: Ctx): string {
        // App scope is server configuration, never request-controlled input.
        return config.defaultAppId(context.env);
    }

    function orgBlogsEnabled(env: Env): boolean {
        return typeof config.orgBlogs === 'function' ? config.orgBlogs(env) : config.orgBlogs === true;
    }

    const blogNotFound = () => errorResponse('Blog not found', 404, { code: 'BLOG_NOT_FOUND' });

    /**
     * The blog a PUBLIC request reads, from its URL only: `?blog=<orgSlug>` names an organization's
     * blog, no param is the site blog. Never the visitor's own workspace: a reader on another
     * organization's blog must see that blog, and anyone may ask for any blog. 404 for an unknown
     * or inactive organization, or when organization blogs are off.
     */
    async function blogFromUrl(context: Ctx): Promise<ResolvedBlog | Response> {
        const appId = resolveAppId(context);
        const slug = context.url.searchParams.get('blog')?.trim();
        if (!slug) return { scope: { appId, organizationId: null }, info: null };
        if (!orgBlogsEnabled(context.env)) return blogNotFound();
        const org = await Organization.findBySlug(slug);
        if (!org || (org.status ?? 'active') !== 'active') return blogNotFound();
        return { scope: { appId, organizationId: org.id }, info: { slug: org.slug, name: org.name } };
    }

    /**
     * An organization's blog goes public with its first published post. Before that it does not
     * exist for readers, so the public endpoints cannot be used to enumerate organizations.
     */
    async function notYetPublic(blog: ResolvedBlog): Promise<Response | null> {
        if (blog.scope.organizationId === null) return null;
        const [post] = await Post.where(
            { ...blog.scope, status: 'published', contentType: { $ne: 'changelog' } },
            { select: ['id'], limit: 1 },
        );
        return post ? null : blogNotFound();
    }

    /** The public blog of this request (see blogFromUrl), once it is public. */
    async function publicBlog(context: Ctx): Promise<ResolvedBlog | Response> {
        const blog = await blogFromUrl(context);
        if (blog instanceof Response) return blog;
        return (await notYetPublic(blog)) ?? blog;
    }

    /**
     * The blog an EDITORIAL request works on (Studio, imports, preview links): the host's choice,
     * the site blog by default. A request, not a grant: every caller re-checks access to it.
     */
    async function editorialScope(context: Ctx): Promise<BlogScope> {
        const organizationId = (await config.resolveEditorialScope?.(context)) ?? null;
        return { appId: resolveAppId(context), organizationId };
    }

    /** A blog's public identity for a scope: null for the site blog. */
    async function blogInfo(scope: BlogScope): Promise<BlogInfo | null> {
        if (scope.organizationId === null) return null;
        const org = await Organization.find(scope.organizationId);
        return org ? { slug: org.get('slug') as string, name: org.get('name') as string } : null;
    }

    /** One settings read per request and blog: the language and lock policies share the row. */
    const settingsByRequest = new WeakMap<Request, Map<string, Promise<OttablogSettings | null>>>();
    function settingsFor(context: Ctx, blog: BlogScope): Promise<OttablogSettings | null> {
        let byBlog = settingsByRequest.get(context.request);
        if (!byBlog) settingsByRequest.set(context.request, (byBlog = new Map()));
        const key = blog.appId + '|' + String(blog.organizationId);
        let settings = byBlog.get(key);
        if (!settings) byBlog.set(key, (settings = OttablogSettings.forBlog(blog)));
        return settings;
    }

    /**
     * Locked-category state for this request. Costs one small category query when nothing is
     * locked; the access check runs only when something is. `anonymous` skips it for responses a
     * shared cache may store (RSS, sitemap): they must look the same for everyone.
     */
    async function resolveLock(context: Ctx, blog: BlogScope, options?: { anonymous?: boolean }): Promise<LockState> {
        const lockedCategoryIds = await PostCategory.lockedIdsForScope(blog);
        if (lockedCategoryIds.size === 0) return UNLOCKED;
        const settings = await settingsFor(context, blog);
        const teaser = settings?.lockedTeaser() ?? [];
        const restricted = options?.anonymous === true || !(await canReadLocked(context, blog.organizationId));
        return { lockedCategoryIds, teaser, restricted };
    }

    /** Fail closed: no seam, or a failing one, means no access. */
    async function canReadLocked(context: Ctx, organizationId: string | null): Promise<boolean> {
        if (!config.canReadLocked) return false;
        try {
            return await config.canReadLocked(context, { organizationId });
        } catch {
            return false;
        }
    }

    /** A post's lock: the stored flag, confirmed against its category links (defense in depth). */
    async function postIsLocked(record: Post, lock: LockState): Promise<boolean> {
        if (lock.lockedCategoryIds.size === 0) return false;
        if (record.get('isLocked') === true) return true;
        const links = await PostCategoryLink.where({ postId: String(record.get('id')) }, { select: ['categoryId'] });
        return links.some((link) => lock.lockedCategoryIds.has(String(link.get('categoryId'))));
    }

    async function languageConfigFor(context: Ctx, blog: BlogScope): Promise<BlogLanguageConfig> {
        const settings = await settingsFor(context, blog);
        return (
            settings?.config() ?? {
                defaultLanguage: 'en',
                supportedLanguages: [{ code: 'en', name: 'English', nativeName: 'English' }],
                fallbackToDefault: true,
            }
        );
    }

    function requestedLanguage(context: Ctx, languageConfig?: BlogLanguageConfig): string | null {
        const resolveRange = (raw: string): string | null => {
            let normalized: string;
            try {
                normalized = normalizeLanguageCode(raw);
            } catch {
                return null;
            }
            if (!languageConfig) return normalized;
            const exact = languageConfig.supportedLanguages.find((item) => item.code === normalized);
            if (exact) return exact.code;
            const primary = normalized.split('-')[0];
            return languageConfig.supportedLanguages.find((item) => item.code === primary)?.code ?? null;
        };
        const explicit = context.url.searchParams.get('lang')?.trim();
        if (explicit) return resolveRange(explicit);
        const header = context.request.headers.get('accept-language');
        if (!header) return null;
        const candidates = header
            .split(',')
            .map((part, index) => {
                const pieces = part.trim().split(';');
                const range = pieces.shift()?.trim() ?? '';
                let quality = 1;
                for (const parameter of pieces) {
                    const match = /^q\s*=\s*([0-9.]+)$/i.exec(parameter.trim());
                    if (match) {
                        const parsed = Number(match[1]);
                        quality = Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : 0;
                    }
                }
                return { range, quality, index };
            })
            .filter((candidate) => candidate.range && candidate.quality > 0)
            .sort((a, b) => b.quality - a.quality || a.index - b.index);
        for (const candidate of candidates) {
            if (candidate.range === '*') return languageConfig?.defaultLanguage ?? null;
            const resolved = resolveRange(candidate.range);
            if (resolved) return resolved;
        }
        return null;
    }

    async function translationFor(
        postId: string,
        language: string | null,
        configForBlog: BlogLanguageConfig,
    ): Promise<PostTranslation | null> {
        if (!language) return null;
        if (!configForBlog.supportedLanguages.some((item) => item.code === language)) return null;
        return PostTranslation.findForPost(postId, language, 'published');
    }

    async function findLocalizedPostBySlug(
        context: Ctx,
        slug: string,
        blog: BlogScope,
        contentTypeParam: string | null,
        languageConfig: BlogLanguageConfig,
    ): Promise<{ record: Post; translation: PostTranslation | null; language: string } | null> {
        const language = requestedLanguage(context, languageConfig);
        const hasExplicitLanguage = Boolean(context.url.searchParams.get('lang')?.trim());
        const isEnabled = (code: unknown) => languageConfig.supportedLanguages.some((item) => item.code === code);
        const parentOf = (translation: PostTranslation) =>
            Post.first({
                id: translation.get('postId'),
                status: 'published',
                ...blog,
                ...(contentTypeParam ? { contentType: contentTypeParam } : {}),
            });

        if (language && isEnabled(language)) {
            const translation = await PostTranslation.findBySlug(slug, { ...blog, language, status: 'published' });
            const record = translation ? await parentOf(translation) : null;
            if (translation && record) return { record, translation, language };
        }

        // A translated slug is a complete public URL by itself. If there is no
        // explicit `?lang=` selector, resolve it across enabled languages even
        // when the browser's Accept-Language prefers another locale.
        if (!hasExplicitLanguage) {
            const translation = await PostTranslation.findBySlug(slug, { ...blog, status: 'published' });
            const translationLanguage = translation?.get('language');
            if (translation && typeof translationLanguage === 'string' && isEnabled(translationLanguage)) {
                const record = await parentOf(translation);
                if (record) return { record, translation, language: translationLanguage };
            }
        }

        const record = await findPublishedPostBySlug(slug, blog, contentTypeParam);
        if (!record) return null;
        const translation = await translationFor(record.get('id') as string, language, languageConfig);
        if (translation) return { record, translation, language: language! };
        const canonicalLanguage = (record.get('language') as string) || languageConfig.defaultLanguage;
        if (language && language !== canonicalLanguage && isEnabled(language) && !languageConfig.fallbackToDefault)
            return null;
        return { record, translation: null, language: canonicalLanguage };
    }

    /**
     * Guard a Studio operation on one blog: null = the site blog (platform admin), an id = that
     * organization's blog (its admin, or a platform admin). Without the scoped seam: platform only.
     */
    async function requireStudioAdmin(
        context: Ctx,
        organizationId: string | null,
    ): Promise<BlogAdminResult | Response> {
        if (config.requireScopedStudioAdmin) return config.requireScopedStudioAdmin(context, { organizationId });
        return config.requireAdmin(context);
    }

    /** The caller's editorial blog, once they are proven its Studio admin. */
    async function studioBlog(context: Ctx): Promise<{ blog: BlogScope; admin: BlogAdminResult } | Response> {
        const connectError = config.connect(context.env);
        if (connectError) return connectError;
        const blog = await editorialScope(context);
        const admin = await requireStudioAdmin(context, blog.organizationId);
        if (admin instanceof Response) return admin;
        return { blog, admin };
    }

    /**
     * Public rendering shape of the studio state: the active theme (the only one visitors render)
     * and enabled plugins with config, plus bare {pluginId, enabled:false} skeletons for disabled
     * rows so the client can deactivate statically-registered defaults. Inactive themes (and their
     * tokens/config) and disabled plugins' configs stay admin-only: any blog's public state is
     * readable by anyone, so the full payload must not be an anonymous enumeration surface.
     */
    function toPublicStudioState(state: StudioState) {
        return {
            activeThemeId: state.activeThemeId,
            languageConfig: state.languageConfig,
            themes: state.themes.filter((t) => t.isActive),
            plugins: state.plugins.map((p) =>
                p.enabled ? p : { ...p, config: null, description: null, name: p.pluginId },
            ),
        };
    }

    /**
     * A blog's default theme and plugin rows, created on its admin's first Studio load (never by a
     * visitor: no public write side effects). Until then the client renders its in-memory defaults.
     */
    async function seedStudioDefaults(blog: BlogScope, state: StudioState): Promise<void> {
        // Unique-violation tolerant: two concurrent admin loads may race the same seed inserts; the
        // loser's constraint error is benign (the row exists).
        const seedTolerant = async (create: () => Promise<unknown>) => {
            try {
                await create();
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (!/unique|constraint|duplicate/i.test(message)) throw error;
            }
        };
        if (state.themes.length === 0) {
            await seedTolerant(() =>
                OttablogTheme.create({
                    themeId: 'default',
                    name: 'Default',
                    description: 'Clean, modern default theme with dark mode support',
                    version: '1.0.0',
                    ...blog,
                    isActive: true,
                }),
            );
            await seedTolerant(() =>
                OttablogTheme.create({
                    themeId: 'minimal',
                    name: 'Minimal',
                    description: 'Clean, minimalist theme focused on typography and readability',
                    version: '1.0.0',
                    author: 'Ottabase',
                    ...blog,
                    isActive: false,
                }),
            );
        }
        if (state.plugins.length === 0) {
            await seedTolerant(() =>
                OttablogPlugin.create({
                    pluginId: 'content-injector-plugin',
                    name: 'Content Injector Plugin',
                    description: 'Injects custom content into posts',
                    ...blog,
                    enabled: false,
                }),
            );
        }
    }

    /**
     * Two payloads. Public (`?blog=`): what a reader's browser needs to render that blog: its
     * identity, active theme, enabled plugins and languages. Full (`?full=1`): the Studio of the
     * caller's editorial blog, for its admin only.
     */
    async function handleBlogStudioState(context: Ctx): Promise<Response> {
        const connectError = config.connect(context.env);
        if (connectError) return connectError;

        if (context.url.searchParams.get('full') === '1') {
            const studio = await studioBlog(context);
            if (studio instanceof Response) return studio;
            let state = await StudioManager.getState(studio.blog);
            if (state.themes.length === 0 || state.plugins.length === 0) {
                await seedStudioDefaults(studio.blog, state);
                state = await StudioManager.getState(studio.blog);
            }
            return jsonResponse({ ...state, blog: await blogInfo(studio.blog) }, 200, { headers: NO_STORE });
        }

        const blog = await publicBlog(context);
        if (blog instanceof Response) return blog;
        return jsonResponse({ ...toPublicStudioState(await StudioManager.getState(blog.scope)), blog: blog.info });
    }

    /** The blog an editor works on: its identity (null for the site blog) and language policy. */
    async function handleBlogStudioBlog(context: Ctx): Promise<Response> {
        const auth = await (config.requireContentEditor ?? config.requireAdmin)(context);
        if (auth instanceof Response) return auth;
        const connectError = config.connect(context.env);
        if (connectError) return connectError;
        const blog = await editorialScope(context);
        const [info, languageConfig] = await Promise.all([blogInfo(blog), languageConfigFor(context, blog)]);
        return jsonResponse({ blog: info, languageConfig }, 200, { headers: NO_STORE });
    }

    /** Save the editorial blog's language policy (its Studio admin). */
    async function handleBlogStudioLanguages(context: Ctx): Promise<Response> {
        const studio = await studioBlog(context);
        if (studio instanceof Response) return studio;
        const body = await readJson<{
            defaultLanguage?: unknown;
            supportedLanguages?: unknown;
            fallbackToDefault?: unknown;
        }>(context.request);
        if (typeof body.defaultLanguage !== 'string' || !Array.isArray(body.supportedLanguages)) {
            return errorResponse('defaultLanguage and supportedLanguages are required', 400, {
                code: 'VALIDATION_ERROR',
            });
        }
        if (body.fallbackToDefault !== undefined && typeof body.fallbackToDefault !== 'boolean') {
            return errorResponse('fallbackToDefault must be a boolean', 400, { code: 'VALIDATION_ERROR' });
        }
        try {
            const settings = await OttablogSettings.ensure(studio.blog);
            await settings.updateLanguages({
                defaultLanguage: body.defaultLanguage,
                supportedLanguages: body.supportedLanguages as BlogLanguage[],
                fallbackToDefault: body.fallbackToDefault as boolean | undefined,
            });
            return jsonResponse(settings.config(), 200, { headers: NO_STORE });
        } catch (error) {
            if (error instanceof ContentValidationError || error instanceof DomainValidationError) {
                return errorResponse(error.message, error instanceof DomainValidationError ? error.status : 400, {
                    code: 'VALIDATION_ERROR',
                });
            }
            throw error;
        }
    }

    // ============================================================
    // LOCKED CATEGORIES: teaser policy + invited readers (studio admin)
    // ============================================================

    /** The blog a studio access request administers, and where its reader grants live. */
    async function accessScope(context: Ctx) {
        const studio = await studioBlog(context);
        if (studio instanceof Response) return studio;
        return {
            ...studio.blog,
            // Site blog: SYSTEM-scoped grants. Org blog: grants in that org (members only).
            grantScope: studio.blog.organizationId ?? SYSTEM_GRANT_SCOPE,
            adminUserId: studio.admin.session?.user?.id ?? undefined,
        };
    }
    type AccessScope = Exclude<Awaited<ReturnType<typeof accessScope>>, Response>;

    async function accessState(scope: AccessScope) {
        const blog = { appId: scope.appId, organizationId: scope.organizationId };
        const [settings, categories, role] = await Promise.all([
            OttablogSettings.forBlog(blog),
            PostCategory.where(blog, { select: ['id', 'name', 'slug', 'parentId', 'isLocked'] }),
            Role.findByName(INSIDER_ROLE_NAME),
        ]);
        const lockedIds = PostCategory.effectiveLockedIds(
            categories.map((c) => ({
                id: String(c.get('id')),
                parentId: (c.get('parentId') as string | null) ?? null,
                isLocked: Boolean(c.get('isLocked')),
            })),
        );
        const grants = role ? await UserRole.where({ roleId: role.get('id'), organizationId: scope.grantScope }) : [];
        const userIds = [...new Set(grants.map((grant) => String(grant.get('userId'))))];
        const users = await User.whereIn('id', userIds, { select: ['id', 'name', 'email', 'image'] });
        return {
            lockedTeaser: settings?.lockedTeaser() ?? [],
            lockedCategories: categories
                .filter((c) => lockedIds.has(String(c.get('id'))))
                .map((c) => ({
                    id: c.get('id'),
                    name: c.get('name'),
                    slug: c.get('slug'),
                    inherited: !c.get('isLocked'),
                })),
            readers: users.map((user) => ({
                id: user.get('id'),
                name: user.get('name'),
                email: user.get('email'),
                image: user.get('image'),
            })),
        };
    }

    async function readerAccessChanged(env: Env, userId: string): Promise<void> {
        try {
            await config.onReaderAccessChanged?.(env, userId);
        } catch {
            // Session refresh is best-effort: the grant itself is already authoritative.
        }
    }

    /** GET: teaser policy, locked categories and invited readers. POST { lockedTeaser }: save the policy. */
    async function handleBlogStudioAccess(context: Ctx): Promise<Response> {
        const scope = await accessScope(context);
        if (scope instanceof Response) return scope;
        if (context.request.method === 'POST') {
            const body = await readJson<{ lockedTeaser?: unknown }>(context.request);
            if (!Array.isArray(body.lockedTeaser)) {
                return errorResponse('lockedTeaser must be an array of field names', 400, { code: 'VALIDATION_ERROR' });
            }
            const settings = await OttablogSettings.ensure({
                appId: scope.appId,
                organizationId: scope.organizationId,
            });
            await settings.updateLockedTeaser(body.lockedTeaser);
        }
        return jsonResponse(await accessState(scope), 200, { headers: NO_STORE });
    }

    /** POST { email }: give an existing account reader access to this blog's locked categories. */
    async function handleBlogStudioReaderGrant(context: Ctx): Promise<Response> {
        const scope = await accessScope(context);
        if (scope instanceof Response) return scope;
        const body = await readJson<{ email?: unknown }>(context.request);
        const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
        if (!isEmail(email)) {
            return errorResponse('Enter a valid email address', 400, {
                code: 'VALIDATION_ERROR',
                fieldErrors: { email: ['Enter a valid email address'] },
            });
        }
        const user = await User.findByEmail(email);
        if (!user) {
            return errorResponse('No account uses this email yet. Ask them to sign up, then invite them.', 404, {
                code: 'USER_NOT_FOUND',
            });
        }
        const userId = String(user.get('id'));
        // An org blog's grants are read in that org, which needs membership: invite them there first.
        if (scope.organizationId && !(await OrganizationMember.isMember(userId, scope.organizationId))) {
            return errorResponse('Add this person to the organization first, then invite them as a reader.', 409, {
                code: 'NOT_A_MEMBER',
            });
        }
        let role = await Role.findByName(INSIDER_ROLE_NAME);
        if (!role) {
            // Installs older than the insider role get it here (create-if-missing only).
            await Role.ensureDefaultRoles();
            role = await Role.findByName(INSIDER_ROLE_NAME);
        }
        if (!role) return errorResponse('Reader role is unavailable', 500, { code: 'ROLE_MISSING' });
        await user.assignRole(String(role.get('id')), scope.adminUserId, scope.grantScope);
        await readerAccessChanged(context.env, userId);
        return jsonResponse(await accessState(scope), 200, { headers: NO_STORE });
    }

    /** DELETE: revoke a reader's access to this blog's locked categories. */
    async function handleBlogStudioReaderRevoke(context: Ctx, userId: string): Promise<Response> {
        const scope = await accessScope(context);
        if (scope instanceof Response) return scope;
        const role = await Role.findByName(INSIDER_ROLE_NAME);
        if (role) {
            await UserRole.removeRole(userId, String(role.get('id')), scope.grantScope);
            await readerAccessChanged(context.env, userId);
        }
        return jsonResponse(await accessState(scope), 200, { headers: NO_STORE });
    }

    async function translationPostFor(
        context: Ctx,
        postId: string,
        _permission: 'read' | 'write',
    ): Promise<{ post: Post; securityContext: SecurityContext; languageConfig: BlogLanguageConfig } | Response> {
        const guard = config.requireContentEditor;
        if (!guard) return editorialGuardMissing();
        const auth = await guard(context);
        if (auth instanceof Response) return auth;
        const securityContext = editorialWriteContext(auth, context);
        if (securityContext instanceof Response) return securityContext;
        const connectError = config.connect(context.env);
        if (connectError) return connectError;
        let filter: Record<string, unknown>;
        try {
            filter = globalRLS.getReadFilter(Post.entity, securityContext);
        } catch {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }
        const post = await Post.first({ id: postId, ...filter });
        if (!post) return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        return {
            post,
            securityContext,
            // The post's own blog decides its languages.
            languageConfig: await languageConfigFor(context, {
                appId: post.get('appId') as string,
                organizationId: (post.get('organizationId') as string | null) ?? null,
            }),
        };
    }

    function translationPayload(body: BlogTranslationBody, language: string): Record<string, unknown> {
        const payload: Record<string, unknown> = { language };
        for (const key of [
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
        ] as const) {
            if (Object.prototype.hasOwnProperty.call(body, key)) payload[key] = body[key];
        }
        return payload;
    }

    async function handleBlogPostTranslations(context: Ctx, postId: string): Promise<Response> {
        const result = await translationPostFor(context, postId, 'read');
        if (result instanceof Response) return result;
        const translationLanguage = context.url.searchParams.get('language')?.trim();
        let translations: PostTranslation[];
        if (translationLanguage) {
            let normalizedLanguage: string;
            try {
                normalizedLanguage = normalizeLanguageCode(translationLanguage);
            } catch (error) {
                return errorResponse(error instanceof Error ? error.message : 'Invalid language', 400, {
                    code: 'VALIDATION_ERROR',
                });
            }
            const translation = await PostTranslation.findForPost(postId, normalizedLanguage);
            translations = translation ? [translation] : [];
        } else {
            translations = await PostTranslation.forPostSummary(postId);
        }
        return jsonResponse(
            {
                baseLanguage: result.post.get('language') || result.languageConfig.defaultLanguage,
                languageConfig: result.languageConfig,
                translations: translations.map((translation) =>
                    translationLanguage ? translation.toJson() : translation.toSummaryJson(),
                ),
            },
            200,
            { headers: NO_STORE },
        );
    }

    async function handleBlogPostTranslationCreate(context: Ctx, postId: string): Promise<Response> {
        const result = await translationPostFor(context, postId, 'write');
        if (result instanceof Response) return result;
        const body = await readJson<BlogTranslationBody>(context.request);
        if (typeof body.language !== 'string')
            return errorResponse('language is required', 400, { code: 'VALIDATION_ERROR' });
        let language: string;
        try {
            language = normalizeLanguageCode(body.language);
        } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Invalid language', 400, {
                code: 'VALIDATION_ERROR',
            });
        }
        if (language === result.post.get('language'))
            return errorResponse('The canonical language is edited on the main post', 400, {
                code: 'VALIDATION_ERROR',
            });
        if (
            (body.status === 'published' || body.status === 'scheduled') &&
            !result.securityContext.platformAdmin &&
            !hasGrantedPermission(result.securityContext.permissions, 'posts:publish')
        )
            return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
        try {
            const translation = await PostTranslation.createForPost(
                postId,
                {
                    ...translationPayload(body, language),
                    appId: result.post.get('appId') as string | null,
                    organizationId: result.post.get('organizationId') as string | null,
                } as import('../ottaorm-models/PostTranslation').PostTranslationWriteData,
                result.languageConfig,
            );
            return jsonResponse(translation.toJson(), 201);
        } catch (error) {
            if (error instanceof ContentValidationError || error instanceof DomainValidationError)
                return errorResponse(error.message, error instanceof DomainValidationError ? error.status : 400, {
                    code: 'VALIDATION_ERROR',
                });
            throw error;
        }
    }

    async function handleBlogPostTranslationUpdate(
        context: Ctx,
        postId: string,
        languageParam: string,
    ): Promise<Response> {
        const result = await translationPostFor(context, postId, 'write');
        if (result instanceof Response) return result;
        let language: string;
        try {
            language = normalizeLanguageCode(languageParam);
        } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Invalid language', 400, {
                code: 'VALIDATION_ERROR',
            });
        }
        const translation = await PostTranslation.findForPost(postId, language);
        if (!translation) return errorResponse('Translation not found', 404, { code: 'NOT_FOUND' });
        const body = await readJson<BlogTranslationBody>(context.request);
        const currentStatus = translation.get('status') as PostStatus;
        const effectiveStatus = body.status ?? currentStatus;
        const mayPublish =
            result.securityContext.platformAdmin ||
            hasGrantedPermission(result.securityContext.permissions, 'posts:publish');
        if (
            (currentStatus === 'published' ||
                currentStatus === 'scheduled' ||
                effectiveStatus === 'published' ||
                effectiveStatus === 'scheduled') &&
            !mayPublish
        ) {
            return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
        }
        try {
            const updated = await translation.updateContent(translationPayload(body, language), result.languageConfig);
            return jsonResponse(updated.toJson());
        } catch (error) {
            if (error instanceof ContentValidationError || error instanceof DomainValidationError)
                return errorResponse(error.message, error instanceof DomainValidationError ? error.status : 400, {
                    code: 'VALIDATION_ERROR',
                });
            throw error;
        }
    }

    async function handleBlogPostTranslationDelete(
        context: Ctx,
        postId: string,
        languageParam: string,
    ): Promise<Response> {
        const result = await translationPostFor(context, postId, 'write');
        if (result instanceof Response) return result;
        let language: string;
        try {
            language = normalizeLanguageCode(languageParam);
        } catch (error) {
            return errorResponse(error instanceof Error ? error.message : 'Invalid language', 400, {
                code: 'VALIDATION_ERROR',
            });
        }
        const translation = await PostTranslation.findForPost(postId, language);
        if (!translation) return errorResponse('Translation not found', 404, { code: 'NOT_FOUND' });
        if (
            (translation.get('status') === 'published' || translation.get('status') === 'scheduled') &&
            !result.securityContext.platformAdmin &&
            !hasGrantedPermission(result.securityContext.permissions, 'posts:publish')
        ) {
            return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
        }
        await PostTranslation.delete(translation.get('id') as string);
        return jsonResponse({ success: true });
    }

    async function handleBlogStudioActivateTheme(context: Ctx): Promise<Response> {
        const studio = await studioBlog(context);
        if (studio instanceof Response) return studio;
        const themeId = (await readJson<{ themeId?: string } | null>(context.request))?.themeId;
        if (!themeId) {
            return errorResponse('themeId is required', 400, { code: 'VALIDATION_ERROR' });
        }

        let themeRow = await OttablogTheme.findByThemeId(themeId, studio.blog);
        if (!themeRow) {
            await OttablogTheme.create({ themeId, name: themeId, ...studio.blog, isActive: false });
            themeRow = await OttablogTheme.findByThemeId(themeId, studio.blog);
        }
        await themeRow?.activate();
        return jsonResponse({ success: true });
    }

    async function handleBlogStudioPluginEnable(context: Ctx): Promise<Response> {
        const studio = await studioBlog(context);
        if (studio instanceof Response) return studio;
        const body = await readJson<{ pluginId?: string; enabled?: boolean } | null>(context.request);
        const pluginId = body?.pluginId;
        const enabled = body?.enabled ?? true;
        if (!pluginId) {
            return errorResponse('pluginId is required', 400, { code: 'VALIDATION_ERROR' });
        }

        const pluginRow = await OttablogPlugin.findByPluginId(pluginId, studio.blog);
        if (!pluginRow) {
            await OttablogPlugin.create({ pluginId, name: pluginId, ...studio.blog, enabled });
        } else {
            pluginRow.set('enabled', enabled);
            await pluginRow.save();
        }
        return jsonResponse({ success: true });
    }

    /**
     * POST /studio/theme/tokens: set a theme row's sparse brand-token overrides (the data-driven
     * half of blog theming). Tokens are validated at render time (theme-tokens.ts); here we only
     * require a JSON object shape so bad values can be corrected in place.
     */
    async function handleBlogStudioThemeTokens(context: Ctx): Promise<Response> {
        const studio = await studioBlog(context);
        if (studio instanceof Response) return studio;
        const body = await readJson<{
            themeId?: string;
            tokens?: { light?: Record<string, string>; dark?: Record<string, string> } | null;
        } | null>(context.request);
        const themeId = body?.themeId;
        if (!themeId) {
            return errorResponse('themeId is required', 400, { code: 'VALIDATION_ERROR' });
        }
        const tokens = body?.tokens ?? null;
        if (tokens !== null && (typeof tokens !== 'object' || Array.isArray(tokens))) {
            return errorResponse('tokens must be an object with light/dark records, or null', 400, {
                code: 'VALIDATION_ERROR',
            });
        }

        const themeRow = await OttablogTheme.findByThemeId(themeId, studio.blog);
        if (!themeRow) {
            return errorResponse('Theme not found', 404, { code: 'NOT_FOUND' });
        }
        themeRow.set('tokens', tokens);
        await themeRow.save();
        return jsonResponse({ success: true });
    }

    async function handleBlogStudioPluginConfig(context: Ctx): Promise<Response> {
        const studio = await studioBlog(context);
        if (studio instanceof Response) return studio;
        const body = await readJson<{ pluginId?: string; config?: Record<string, unknown> } | null>(context.request);
        const pluginId = body?.pluginId;
        if (!pluginId) {
            return errorResponse('pluginId is required', 400, { code: 'VALIDATION_ERROR' });
        }

        const pluginRow = await OttablogPlugin.findByPluginId(pluginId, studio.blog);
        if (!pluginRow) {
            return errorResponse('Plugin not found', 404, { code: 'NOT_FOUND' });
        }
        await pluginRow.updateConfig(body?.config ?? {});
        return jsonResponse({ success: true });
    }

    type BlurbBody = {
        text?: unknown;
        /** The same post elsewhere. Validated by the model (ContentValidationError → 400). */
        crossposts?: unknown;
        status?: unknown;
        allowComments?: unknown;
        publishAt?: unknown;
    };

    function readEditorialOptions(body: BlurbBody):
        | {
              status?: 'draft' | 'published' | 'archived' | 'scheduled';
              allowComments?: boolean;
              publishAt?: number | null;
          }
        | Response {
        const allowedStatuses = new Set(['draft', 'published', 'archived', 'scheduled']);
        if (body.status !== undefined && (typeof body.status !== 'string' || !allowedStatuses.has(body.status))) {
            return errorResponse('Invalid publication status', 400, { code: 'VALIDATION_ERROR' });
        }
        if (body.allowComments !== undefined && typeof body.allowComments !== 'boolean') {
            return errorResponse('allowComments must be a boolean', 400, { code: 'VALIDATION_ERROR' });
        }

        if (
            body.publishAt !== undefined &&
            body.publishAt !== null &&
            (typeof body.publishAt !== 'number' || !Number.isFinite(body.publishAt))
        ) {
            return errorResponse('publishAt must be a timestamp', 400, { code: 'VALIDATION_ERROR' });
        }

        return {
            status: body.status as 'draft' | 'published' | 'archived' | 'scheduled' | undefined,
            allowComments: body.allowComments as boolean | undefined,
            publishAt: body.publishAt as number | null | undefined,
        };
    }

    /**
     * The editorial write guard, or a 501 when the host app never configured one. Deliberately NOT
     * falling back to `requireAdmin`: its result carries no `securityContext`, so every write would
     * fail later with a misleading 401. An unconfigured route is a deployment fact, not an auth
     * failure, and it should read that way in the logs.
     */
    const editorialGuard = (kind: 'create' | 'update') =>
        kind === 'create' ? (config.requireContentCreator ?? config.requireContentEditor) : config.requireContentEditor;

    // Same shape as the `connect` binding error: a host-configuration gap, reported as one.
    const editorialGuardMissing = () =>
        errorResponse('Editorial content guard not configured', 500, { code: 'CONFIG_ERROR' });

    function editorialWriteContext(auth: BlogEditorialWriteResult, context: Ctx): SecurityContext | Response {
        const securityContext = auth.securityContext;
        const userId = securityContext.userId ?? auth.session?.user?.id ?? undefined;
        if (!userId) {
            return errorResponse('Authentication required', 401, { code: 'UNAUTHORIZED' });
        }
        return {
            ...securityContext,
            userId,
            appId: securityContext.appId ?? config.defaultAppId(context.env),
        };
    }

    function requiresPublishPermission(status: unknown): boolean {
        return status === 'published' || status === 'scheduled';
    }

    async function handleBlogBlurbCreate(context: Ctx): Promise<Response> {
        const guard = editorialGuard('create');
        if (!guard) return editorialGuardMissing();
        const auth = await guard(context);
        if (auth instanceof Response) return auth;

        const connectError = config.connect(context.env);
        if (connectError) return connectError;

        const securityContext = editorialWriteContext(auth, context);
        if (securityContext instanceof Response) return securityContext;
        if (securityContext.organizationId == null && !securityContext.platformAdmin) {
            return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
        }

        const body = await readJson<BlurbBody>(context.request);
        const options = readEditorialOptions(body);
        if (options instanceof Response) return options;
        // Draft, matching photo journals and Post.createBlurb — a body of just `{text}` must not
        // publish itself to the public timeline and RSS. Both editors always send an explicit status.
        const requestedStatus = options.status ?? 'draft';
        if (
            (requestedStatus === 'published' || requestedStatus === 'scheduled') &&
            !securityContext.platformAdmin &&
            !hasGrantedPermission(securityContext.permissions, 'posts:publish')
        ) {
            return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
        }

        const writeData: Record<string, unknown> = {
            contentType: 'blurb',
            organizationId: securityContext.organizationId ?? null,
            appId: securityContext.appId,
            userId: securityContext.userId,
            authorId: securityContext.userId,
        };

        try {
            globalRLS.validateWrite(Post.entity, securityContext, writeData, 'create');
            const post = await Post.createBlurb(body.text as string, {
                ...options,
                crossposts: body.crossposts as PostCrosspost[] | null | undefined,
                status: requestedStatus,
                organizationId: writeData.organizationId as string | null,
                appId: writeData.appId as string,
                userId: writeData.userId as string,
                authorId: writeData.authorId as string,
            });
            return jsonResponse(post.toJson(), 201);
        } catch (error) {
            if (error instanceof ContentValidationError) {
                return errorResponse(error.message, 400, { code: 'VALIDATION_ERROR' });
            }
            if (error instanceof RLSError) {
                return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
            }
            throw error;
        }
    }

    async function handleBlogBlurbUpdate(context: Ctx, postId: string): Promise<Response> {
        const guard = editorialGuard('update');
        if (!guard) return editorialGuardMissing();
        const auth = await guard(context);
        if (auth instanceof Response) return auth;

        const connectError = config.connect(context.env);
        if (connectError) return connectError;

        const securityContext = editorialWriteContext(auth, context);
        if (securityContext instanceof Response) return securityContext;

        let filter: Record<string, unknown>;
        try {
            filter = globalRLS.getReadFilter(Post.entity, securityContext);
        } catch {
            return errorResponse('Blurb not found', 404, { code: 'NOT_FOUND' });
        }
        const post = await Post.first({ id: postId, contentType: 'blurb', ...filter });
        if (!post) return errorResponse('Blurb not found', 404, { code: 'NOT_FOUND' });

        const body = await readJson<BlurbBody>(context.request);
        const options = readEditorialOptions(body);
        if (options instanceof Response) return options;
        const currentStatus = post.get('status');
        const effectiveStatus = options.status ?? currentStatus;
        if (
            (requiresPublishPermission(currentStatus) || requiresPublishPermission(effectiveStatus)) &&
            !securityContext.platformAdmin &&
            !hasGrantedPermission(securityContext.permissions, 'posts:publish')
        ) {
            return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
        }

        try {
            globalRLS.validateWrite(Post.entity, securityContext, post.toJson(), 'update');
            // PATCH: an ABSENT field means "unchanged". A status-only body (publish/schedule a
            // draft) must not read as "blurb text is required" — fall back to the stored text.
            const text = body.text === undefined ? (post.get('blurbText') as string) : body.text;
            const updated = await post.updateBlurb(text as string, {
                ...options,
                crossposts: body.crossposts as PostCrosspost[] | null | undefined,
            });
            return jsonResponse(updated.toJson());
        } catch (error) {
            if (error instanceof ContentValidationError) {
                return errorResponse(error.message, 400, { code: 'VALIDATION_ERROR' });
            }
            if (error instanceof RLSError) {
                return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
            }
            throw error;
        }
    }

    type PhotoJournalBody = BlurbBody & {
        title?: unknown;
        note?: unknown;
        photos?: unknown;
        isFeatured?: unknown;
        content?: unknown;
    };

    async function handleBlogPhotoJournalCreate(context: Ctx): Promise<Response> {
        const guard = editorialGuard('create');
        if (!guard) return editorialGuardMissing();
        const auth = await guard(context);
        if (auth instanceof Response) return auth;

        const connectError = config.connect(context.env);
        if (connectError) return connectError;
        const securityContext = editorialWriteContext(auth, context);
        if (securityContext instanceof Response) return securityContext;
        if (securityContext.organizationId == null && !securityContext.platformAdmin) {
            return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
        }

        const body = await readJson<PhotoJournalBody>(context.request);
        const options = readEditorialOptions(body);
        if (options instanceof Response) return options;
        if (body.isFeatured !== undefined && typeof body.isFeatured !== 'boolean') {
            return errorResponse('isFeatured must be a boolean', 400, { code: 'VALIDATION_ERROR' });
        }
        const requestedStatus = options.status ?? 'draft';
        if (
            (requestedStatus === 'published' || requestedStatus === 'scheduled') &&
            !securityContext.platformAdmin &&
            !hasGrantedPermission(securityContext.permissions, 'posts:publish')
        ) {
            return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
        }

        const writeData: Record<string, unknown> = {
            contentType: 'photo',
            organizationId: securityContext.organizationId ?? null,
            appId: securityContext.appId,
            userId: securityContext.userId,
            authorId: securityContext.userId,
        };
        try {
            globalRLS.validateWrite(Post.entity, securityContext, writeData, 'create');
            const post = await Post.createPhotoJournal(body.photos, {
                ...options,
                title: body.title as string | null | undefined,
                note: body.note as string | null | undefined,
                content: body.content as EditorJSData | null | undefined,
                crossposts: body.crossposts as PostCrosspost[] | null | undefined,
                isFeatured: body.isFeatured as boolean | undefined,
                status: requestedStatus,
                organizationId: writeData.organizationId as string | null,
                appId: writeData.appId as string,
                userId: writeData.userId as string,
                authorId: writeData.authorId as string,
            });
            return jsonResponse(post.toJson(), 201);
        } catch (error) {
            if (error instanceof ContentValidationError) {
                return errorResponse(error.message, 400, { code: 'VALIDATION_ERROR' });
            }
            if (error instanceof RLSError) return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
            throw error;
        }
    }

    async function handleBlogPhotoJournalUpdate(context: Ctx, postId: string): Promise<Response> {
        const guard = editorialGuard('update');
        if (!guard) return editorialGuardMissing();
        const auth = await guard(context);
        if (auth instanceof Response) return auth;

        const connectError = config.connect(context.env);
        if (connectError) return connectError;
        const securityContext = editorialWriteContext(auth, context);
        if (securityContext instanceof Response) return securityContext;

        let filter: Record<string, unknown>;
        try {
            filter = globalRLS.getReadFilter(Post.entity, securityContext);
        } catch {
            return errorResponse('Photo journal not found', 404, { code: 'NOT_FOUND' });
        }
        const post = await Post.first({ id: postId, contentType: 'photo', ...filter });
        if (!post) return errorResponse('Photo journal not found', 404, { code: 'NOT_FOUND' });

        const body = await readJson<PhotoJournalBody>(context.request);
        const options = readEditorialOptions(body);
        if (options instanceof Response) return options;
        if (body.isFeatured !== undefined && typeof body.isFeatured !== 'boolean') {
            return errorResponse('isFeatured must be a boolean', 400, { code: 'VALIDATION_ERROR' });
        }
        const currentStatus = post.get('status');
        const effectiveStatus = options.status ?? currentStatus;
        if (
            (requiresPublishPermission(currentStatus) || requiresPublishPermission(effectiveStatus)) &&
            !securityContext.platformAdmin &&
            !hasGrantedPermission(securityContext.permissions, 'posts:publish')
        ) {
            return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
        }

        try {
            globalRLS.validateWrite(Post.entity, securityContext, post.toJson(), 'update');
            // Same PATCH rule the model applies to `note`/`title`: an ABSENT album means
            // "unchanged", so publishing or scheduling an existing journal needs no photo payload.
            const photos = body.photos === undefined ? post.get('photoAlbum') : body.photos;
            const updated = await post.updatePhotoJournal(photos, {
                ...options,
                title: body.title as string | null | undefined,
                note: body.note as string | null | undefined,
                content: body.content as EditorJSData | null | undefined,
                crossposts: body.crossposts as PostCrosspost[] | null | undefined,
                isFeatured: body.isFeatured as boolean | undefined,
            });
            return jsonResponse(updated.toJson());
        } catch (error) {
            if (error instanceof ContentValidationError) {
                return errorResponse(error.message, 400, { code: 'VALIDATION_ERROR' });
            }
            if (error instanceof RLSError) return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
            throw error;
        }
    }

    async function handleBlogPostsList(context: Ctx): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const blog = await publicBlog(context);
        if (blog instanceof Response) return blog;
        const { scope } = blog;
        const page = parseBoundedInteger(url.searchParams.get('page'), 1, 1, 1000);
        const perPage = parseBoundedInteger(url.searchParams.get('perPage'), 15, 1, 50);
        const contentType = url.searchParams.get('contentType') || null;
        const seriesId = url.searchParams.get('seriesId') || null;
        const categoryId = url.searchParams.get('categoryId') || null;
        const tagId = url.searchParams.get('tagId') || null;
        const authorId = url.searchParams.get('authorId') || null;
        const search = url.searchParams.get('search') || null;
        const orderBy = url.searchParams.get('orderBy') || 'publishedAt';
        const orderDirection = (url.searchParams.get('orderDirection') || 'desc') as 'asc' | 'desc';
        // Date archive: filter posts by year (and optionally month) of publishedAt
        const yearParam = url.searchParams.get('year') || null;
        const monthParam = url.searchParams.get('month') || null;
        const languageConfig = await languageConfigFor(context, scope);
        const language = requestedLanguage(context, languageConfig);

        // Always one blog: on a shared database, one blog's list never serves another's.
        const where: Record<string, unknown> = { status: 'published', ...scope };
        if (contentType) {
            where.contentType = contentType;
        } else {
            // By default, exclude changelog posts from the blog list (changelog has its own UI at /changelog)
            where.contentType = { $ne: 'changelog' };
        }
        if (seriesId) where.seriesId = seriesId;
        if (authorId) where.authorId = authorId;

        // Date archive filtering: publishedAt range for year/month
        if (yearParam) {
            const year = parseBoundedInteger(yearParam, 0, 1970, 2100);
            if (year === 0) {
                return errorResponse('year must be a number between 1970 and 2100', 400, { code: 'VALIDATION_ERROR' });
            }
            const month = monthParam ? parseBoundedInteger(monthParam, 0, 1, 12) : 0;
            if (monthParam && month === 0) {
                return errorResponse('month must be a number between 1 and 12', 400, { code: 'VALIDATION_ERROR' });
            }
            const rangeStart = month > 0 ? new Date(Date.UTC(year, month - 1, 1)) : new Date(Date.UTC(year, 0, 1));
            const rangeEnd = month > 0 ? new Date(Date.UTC(year, month, 1)) : new Date(Date.UTC(year + 1, 0, 1));
            where.publishedAt = { $gte: rangeStart.getTime(), $lt: rangeEnd.getTime() };
        }

        // Locked categories, in SQL so pagination and totals stay true. Search hides every locked
        // post from a restricted reader: matching on a hidden excerpt or blurb would leak it.
        const lock = await resolveLock(context, scope);
        Object.assign(where, lockedPostsWhere(lock, Boolean(search?.trim())));
        const emptyPage = () =>
            jsonResponse({ data: [], pagination: { page, perPage, total: 0, totalPages: 0 } }, 200, {
                headers: lockHeaders(lock),
            });

        // Tag-based filtering: find post IDs that have this tag, then filter
        let tagFilterPostIds: string[] | null = null;
        if (tagId) {
            const links = await PostTagLink.where({ tagId });
            tagFilterPostIds = links.map((l) => l.get('postId') as string);
            if (tagFilterPostIds.length === 0) {
                // No posts have this tag — return empty
                return emptyPage();
            }
        }

        // Category-based filtering: find post IDs that have this category via junction table
        let categoryFilterPostIds: string[] | null = null;
        if (categoryId) {
            const links = await PostCategoryLink.where({ categoryId });
            categoryFilterPostIds = links.map((l) => l.get('postId') as string);
            if (categoryFilterPostIds.length === 0) {
                return emptyPage();
            }
        }

        // Combine junction-based filters (tag ∩ category) into one id set.
        const hasJunctionFilter = tagFilterPostIds !== null || categoryFilterPostIds !== null;
        let junctionIds: string[] | null = null;
        if (hasJunctionFilter) {
            if (tagFilterPostIds && categoryFilterPostIds) {
                const catSet = new Set(categoryFilterPostIds);
                junctionIds = [...new Set(tagFilterPostIds.filter((id) => catSet.has(id)))];
            } else {
                junctionIds = [...new Set(tagFilterPostIds ?? categoryFilterPostIds!)];
            }
            // buildWhereConditions silently DROPS empty arrays, so an explicit
            // empty-intersection early-return is load-bearing, not cosmetic.
            if (junctionIds.length === 0) {
                return emptyPage();
            }
        }

        // When fallback is disabled, a localized list contains both posts whose canonical
        // language is the requested language and posts with a published translation.
        if (
            language &&
            languageConfig.supportedLanguages.some((item) => item.code === language) &&
            !languageConfig.fallbackToDefault
        ) {
            const [translatedRows, canonicalRows] = await Promise.all([
                PostTranslation.where({ language, status: 'published', ...scope }, { select: ['postId'] }),
                Post.where({ ...where, language }, { select: ['id'] }),
            ]);
            const visibleIds = [
                ...new Set([
                    ...translatedRows.map((row) => row.get('postId') as string),
                    ...canonicalRows.map((row) => row.get('id') as string),
                ]),
            ];
            if (visibleIds.length === 0) return emptyPage();
            if (junctionIds) {
                const visibleSet = new Set(visibleIds);
                junctionIds = junctionIds.filter((id) => visibleSet.has(id));
                if (junctionIds.length === 0) return emptyPage();
            } else {
                where.id = visibleIds;
            }
        }

        const searchTerm = search?.trim() || null;
        if (searchTerm && new TextEncoder().encode(searchTerm).byteLength > MAX_SEARCH_TERM_BYTES) {
            return jsonResponse({ error: 'Search term is too long', code: 'INVALID_SEARCH' }, 400);
        }
        const searchFields = ['title', 'slug', 'excerpt', 'blurbText', 'photoNote'];
        let localizedSearchMatched = false;
        if (searchTerm && language && languageConfig.supportedLanguages.some((item) => item.code === language)) {
            const [localizedIds, canonicalIds] = await Promise.all([
                PostTranslation.searchPostIds(searchTerm, { ...scope, language, status: 'published' }),
                Post.searchPostIds(searchTerm, searchFields, where),
            ]);
            const matchingIds = [...new Set([...localizedIds, ...canonicalIds])];
            if (matchingIds.length > 0) {
                localizedSearchMatched = true;
                if (junctionIds) {
                    const matchingSet = new Set(matchingIds);
                    junctionIds = junctionIds.filter((id) => matchingSet.has(id));
                    if (junctionIds.length === 0) return emptyPage();
                } else {
                    where.id = matchingIds;
                }
            }
        }
        const searchTermForPosts = localizedSearchMatched ? null : searchTerm;

        let result;
        if (junctionIds !== null && junctionIds.length <= D1_FILTERED_ID_CHUNK) {
            // Junction filter pushed into SQL (array-where → inArray): paginate
            // and COUNT in the database instead of fetching the whole corpus.
            // The id list rides in the SAME statement as `where` (status,
            // contentType, appId, ...) plus pagination/search params, so the
            // smaller filtered-chunk threshold (not D1_IN_CHUNK) applies here.
            const idWhere = { ...where, id: junctionIds };
            result = searchTermForPosts
                ? await Post.searchPaginate(searchTermForPosts, searchFields, page, perPage, idWhere, {
                      orderBy,
                      orderDirection,
                  })
                : await Post.paginate(page, perPage, idWhere, { orderBy, orderDirection });
        } else if (junctionIds !== null) {
            // Very large tag/category (> the filtered-id chunk): fetch the
            // tagged rows chunk-wise by id — bounded by the tag's size, never the
            // whole published corpus — then order/paginate in memory. The search
            // term is applied as the JS equivalent of the LIKE %term% condition.
            // Each chunk carries the same `where` conditions as the id list, so
            // it uses the filtered (not plain) chunk size too.
            const rows = await chunkedFetch(
                junctionIds,
                (ids) => Post.where({ ...where, id: ids }, { orderBy, orderDirection }),
                D1_FILTERED_ID_CHUNK,
            );
            const needle = searchTermForPosts?.toLowerCase() ?? null;
            const filtered = needle
                ? rows.filter((p) =>
                      searchFields.some((f) => ((p.get(f) as string | null) ?? '').toLowerCase().includes(needle)),
                  )
                : rows;
            const direction = orderDirection === 'asc' ? 1 : -1;
            filtered.sort((a, b) => {
                const av = a.get(orderBy) as number | string | null;
                const bv = b.get(orderBy) as number | string | null;
                if (av === bv) return 0;
                if (av === null || av === undefined) return 1;
                if (bv === null || bv === undefined) return -1;
                return av < bv ? -direction : direction;
            });
            const total = filtered.length;
            result = {
                data: filtered.slice((page - 1) * perPage, page * perPage),
                page,
                perPage,
                total,
                totalPages: Math.ceil(total / perPage),
            };
        } else if (searchTermForPosts) {
            // Single data+COUNT round-trip instead of the previous double scan
            // (the second of which fetched every matching row just for .length).
            result = await Post.searchPaginate(searchTermForPosts, searchFields, page, perPage, where, {
                orderBy,
                orderDirection,
            });
        } else {
            result = await Post.paginate(page, perPage, where, { orderBy, orderDirection });
        }

        // Enrich the page with tags, categories, series, and author — batched
        // flat queries (see enrichPostsJsonBatch) instead of ~5 queries per post.
        const data = await enrichPostsJsonBatch(result.data as Post[], { language, languageConfig, lock });
        return jsonResponse(
            {
                data,
                pagination: {
                    page: result.page,
                    perPage: result.perPage,
                    total: result.total,
                    totalPages: result.totalPages,
                },
            },
            200,
            { headers: lockHeaders(lock) },
        );
    }

    /**
     * Signed draft preview: when a valid, unexpired `?preview=` token names this slug in THIS blog,
     * load the post WITHOUT the published-status filter. The blog is inside the signature (bound at
     * mint time), so a token never reaches another blog's post. Null when preview does not apply.
     */
    async function findPostForPreview(context: Ctx, slug: string, blog: BlogScope): Promise<Post | null> {
        const token = context.url.searchParams.get('preview');
        if (!token) return null;
        const secret = config.previewTokenSecret?.(context.env);
        if (!secret) return null;

        const payload = await verifyPreviewToken(secret, token);
        if (
            !payload ||
            payload.slug !== slug ||
            payload.appId !== blog.appId ||
            payload.organizationId !== blog.organizationId
        )
            return null;
        return Post.first({ slug, ...blog });
    }

    async function handleBlogPostBySlug(context: Ctx, slug: string): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        // A preview reads its draft before the blog's first post goes public.
        const blog = await blogFromUrl(context);
        if (blog instanceof Response) return blog;
        const { scope } = blog;
        const preview = await findPostForPreview(context, slug, scope);
        if (!preview) {
            const notPublic = await notYetPublic(blog);
            if (notPublic) return notPublic;
        }
        const contentTypeParam = url.searchParams.get('contentType') || null;
        const languageConfig = await languageConfigFor(context, scope);
        const localized = preview
            ? {
                  record: preview,
                  translation: null,
                  language: (preview.get('language') as string) || languageConfig.defaultLanguage,
              }
            : await findLocalizedPostBySlug(context, slug, scope, contentTypeParam, languageConfig);
        const record = localized?.record;

        if (!record) {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        // Changelogs require explicit opt-in via contentType=changelog parameter.
        // Without it, changelog posts are hidden from the regular blog API.
        if (!contentTypeParam && record.get('contentType') === 'changelog') {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        // View tracking disabled by default (D1 write cost per view).
        // Call POST /api/blog/posts/:slug/track-view explicitly when needed.

        // A preview token is the editor's review artifact, minted by someone who may edit the
        // post, so it skips the locked-category check like it skips the published filter.
        const lock = preview ? UNLOCKED : await resolveLock(context, scope);
        const isLocked = await postIsLocked(record, lock);
        const asTeaser = isLocked && lock.restricted;
        if (asTeaser && !isTeasable(record.get('contentType'), lock)) {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        const data = await publicPostJson(record, {
            // A preview link is the review artifact — the token grants content access
            // (password-protection stripping still applies to normal public reads).
            includeContent: !!preview,
            enrichTags: !asTeaser,
            enrichCategory: true,
            enrichSeries: !asTeaser,
            enrichAuthor: true,
            translation: localized?.translation ?? null,
            languageConfig,
            lockedCategoryIds: lock.lockedCategoryIds,
        });
        data.isLocked = isLocked;
        if (asTeaser) return jsonResponse(lockedTeaserJson(data, lock.teaser), 200, { headers: lockHeaders(lock) });
        return jsonResponse(preview ? { ...data, preview: true } : data, 200, { headers: lockHeaders(lock) });
    }

    async function handleBlogPostUnlock(context: Ctx): Promise<Response> {
        const { request, env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const body = await readJson<{ slug: string; password: string }>(request);
        const slug = body?.slug?.trim();
        const password = body?.password;

        if (!slug || password === undefined || password === null) {
            return errorResponse('slug and password are required', 400, { code: 'VALIDATION_ERROR' });
        }

        const blog = await publicBlog(context);
        if (blog instanceof Response) return blog;
        const { scope } = blog;
        const contentTypeParam = url.searchParams.get('contentType') || null;
        const languageConfig = await languageConfigFor(context, scope);
        const localized = await findLocalizedPostBySlug(context, slug, scope, contentTypeParam, languageConfig);
        const record = localized?.record;
        if (!record) {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        // Changelogs require explicit opt-in via contentType=changelog parameter.
        // Without it, changelog posts are hidden from the regular blog API.
        if (!contentTypeParam && record.get('contentType') === 'changelog') {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        // A password never opens a locked category: that needs reader access, not a secret.
        const lock = await resolveLock(context, scope);
        const isLocked = await postIsLocked(record, lock);
        if (isLocked && lock.restricted) {
            return isTeasable(record.get('contentType'), lock)
                ? errorResponse('This post is for invited readers', 403, { code: 'LOCKED' })
                : errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        const isProtected = record.get('isProtected');
        const passwordHash = record.get('passwordHash');
        if (!isProtected || !passwordHash) {
            const data = await publicPostJson(record, {
                includeContent: true,
                enrichTags: true,
                enrichCategory: true,
                enrichSeries: true,
                enrichAuthor: true,
                translation: localized?.translation ?? null,
                languageConfig,
                lockedCategoryIds: lock.lockedCategoryIds,
            });
            return jsonResponse({ ...data, isLocked }, 200, { headers: lockHeaders(lock) });
        }

        const valid = await config.verifyPassword(String(password), String(passwordHash));
        if (!valid) {
            return errorResponse('Invalid password', 401, { code: 'INVALID_PASSWORD' });
        }

        const data = await publicPostJson(record, {
            includeContent: true,
            enrichTags: true,
            enrichCategory: true,
            enrichSeries: true,
            enrichAuthor: true,
            translation: localized?.translation ?? null,
            languageConfig,
            lockedCategoryIds: lock.lockedCategoryIds,
        });
        return jsonResponse({ ...data, isLocked }, 200, { headers: lockHeaders(lock) });
    }

    // ============================================================
    // ARCHIVE PAGES: tag, category, series by slug
    // ============================================================

    /**
     * Whether this reader can see a published post of the blog matching `where`. An archive (tag,
     * series) whose every post is hidden from them does not exist for them: its name would say
     * what the hidden posts are about.
     */
    async function hasVisiblePost(scope: BlogScope, lock: LockState, where: Record<string, unknown>): Promise<boolean> {
        const [post] = await Post.where(
            { ...where, ...scope, status: 'published', contentType: { $ne: 'changelog' }, ...lockedPostsWhere(lock) },
            { select: ['id'], limit: 1 },
        );
        return Boolean(post);
    }

    async function handleBlogTagBySlug(context: Ctx, slug: string): Promise<Response> {
        const connectError = config.connect(context.env);
        if (connectError) return connectError;
        const blog = await publicBlog(context);
        if (blog instanceof Response) return blog;

        const type = context.url.searchParams.get('type') || 'post';
        const tag = await PostTag.findBySlug(slug, { ...blog.scope, type });
        if (!tag) return errorResponse('Tag not found', 404, { code: 'NOT_FOUND' });
        const lock = await resolveLock(context, blog.scope);
        if (lock.restricted) {
            const links = await PostTagLink.where({ tagId: String(tag.get('id')) }, { select: ['postId'] });
            const postIds = links.map((link) => String(link.get('postId')));
            if (postIds.length === 0 || !(await hasVisiblePost(blog.scope, lock, { id: postIds }))) {
                return errorResponse('Tag not found', 404, { code: 'NOT_FOUND' });
            }
        }
        return jsonResponse(tag.toJson(), 200, { headers: lockHeaders(lock) });
    }

    async function handleBlogCategoryBySlug(context: Ctx, slug: string): Promise<Response> {
        const connectError = config.connect(context.env);
        if (connectError) return connectError;
        const blog = await publicBlog(context);
        if (blog instanceof Response) return blog;

        const type = context.url.searchParams.get('type') || 'post';
        const category = await PostCategory.findBySlug(slug, { ...blog.scope, type });
        if (!category) {
            return errorResponse('Category not found', 404, { code: 'NOT_FOUND' });
        }
        // `isLocked` reports the EFFECTIVE lock (a parent's lock covers its children). With
        // teasers off, a locked category does not exist for a reader without access.
        const lock = await resolveLock(context, blog.scope);
        const isLocked = lock.lockedCategoryIds.has(String(category.get('id')));
        if (isLocked && lock.restricted && lock.teaser.length === 0) {
            return errorResponse('Category not found', 404, { code: 'NOT_FOUND' });
        }
        return jsonResponse({ ...category.toJson(), isLocked }, 200, { headers: lockHeaders(lock) });
    }

    /** The blog's series this reader can see a post of, in display order. */
    async function handleBlogSeriesList(context: Ctx): Promise<Response> {
        const connectError = config.connect(context.env);
        if (connectError) return connectError;
        const blog = await publicBlog(context);
        if (blog instanceof Response) return blog;

        const lock = await resolveLock(context, blog.scope);
        const ids = await Post.seriesIdsOf({
            ...blog.scope,
            status: 'published',
            contentType: { $ne: 'changelog' },
            ...lockedPostsWhere(lock),
        });
        const series = await chunkedFetch(ids, (chunk) => PostSeries.whereIn('id', chunk));
        series.sort(
            (a, b) =>
                Number(a.get('sortOrder') ?? 0) - Number(b.get('sortOrder') ?? 0) ||
                String(a.get('title')).localeCompare(String(b.get('title'))),
        );
        return jsonResponse({ data: series.map((row) => row.toJson()) }, 200, { headers: lockHeaders(lock) });
    }

    async function handleBlogSeriesBySlug(context: Ctx, slug: string): Promise<Response> {
        const connectError = config.connect(context.env);
        if (connectError) return connectError;
        const blog = await publicBlog(context);
        if (blog instanceof Response) return blog;

        const series = await PostSeries.findBySlug(slug, blog.scope);
        const lock = await resolveLock(context, blog.scope);
        if (!series || !(await hasVisiblePost(blog.scope, lock, { seriesId: String(series.get('id')) }))) {
            return errorResponse('Series not found', 404, { code: 'NOT_FOUND' });
        }
        return jsonResponse(series.toJson(), 200, { headers: lockHeaders(lock) });
    }

    /**
     * Public author card for the author archive page. Answers only for a user with a post in this
     * blog the reader can see, so the route cannot be used to look up arbitrary accounts by id,
     * and only with the public author projection (never the account email).
     */
    async function handleBlogAuthorById(context: Ctx, authorId: string): Promise<Response> {
        const connectError = config.connect(context.env);
        if (connectError) return connectError;
        const blog = await publicBlog(context);
        if (blog instanceof Response) return blog;

        // Someone who only wrote what this reader may not see is not an author to them. Changelog
        // entries live at /changelog, so they do not make someone a blog author either.
        const lock = await resolveLock(context, blog.scope);
        const [post] = await Post.where(
            {
                authorId,
                ...blog.scope,
                status: 'published',
                contentType: { $ne: 'changelog' },
                ...lockedPostsWhere(lock),
            },
            { select: ['id', 'authorId'], limit: 1 },
        );
        const author = post ? await post.author([...PUBLIC_AUTHOR_FIELDS]) : null;
        if (!author) {
            return errorResponse('Author not found', 404, { code: 'NOT_FOUND' });
        }
        return jsonResponse({ id: author.get('id'), name: author.get('name'), image: author.get('image') }, 200, {
            headers: lockHeaders(lock),
        });
    }

    // ============================================================
    // RELATED POSTS
    // ============================================================

    async function handleBlogRelatedPosts(context: Ctx, postId: string): Promise<Response> {
        const connectError = config.connect(context.env);
        if (connectError) return connectError;
        const blog = await publicBlog(context);
        if (blog instanceof Response) return blog;
        const { scope } = blog;
        const limit = parseBoundedInteger(context.url.searchParams.get('limit'), 4, 1, 10);

        const post = await Post.first({ id: postId, status: 'published', ...scope });
        if (!post) {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        const lock = await resolveLock(context, scope);
        if (lock.restricted && (await postIsLocked(post, lock)) && !isTeasable(post.get('contentType'), lock)) {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        // Gather category IDs from junction table for junction-aware related lookup
        const categoryLinks = await PostCategoryLink.where({ postId });
        const categoryIds = categoryLinks.map((cl) => cl.get('categoryId') as string);

        const related = await Post.related(postId, {
            ...scope,
            categoryIds,
            contentType: post.get('contentType') as string,
            // Suggestions never tease: a restricted reader is only pointed at what they can read.
            excludeLocked: lock.restricted,
            limit,
        });

        // Batched enrichment (adds categories/seriesTitle alongside tags/author —
        // additive fields, same per-post shape as the list endpoint).
        const languageConfig = await languageConfigFor(context, scope);
        const data = await enrichPostsJsonBatch(related, {
            language: requestedLanguage(context, languageConfig),
            languageConfig,
            lock: { ...lock, teaser: [] },
        });
        return jsonResponse(data, 200, { headers: lockHeaders(lock) });
    }

    // ============================================================
    // RSS FEED
    // ============================================================

    async function handleBlogRssFeed(context: Ctx): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const blog = await publicBlog(context);
        if (blog instanceof Response) return blog;
        const { scope } = blog;
        const languageConfig = await languageConfigFor(context, scope);
        const language = requestedLanguage(context, languageConfig);
        const contentType = url.searchParams.get('contentType') || null;
        const limit = parseBoundedInteger(url.searchParams.get('limit'), 25, 1, 100);

        const where: Record<string, unknown> = {
            status: 'published',
            ...scope,
            contentType: contentType ?? { $ne: 'changelog' },
        };
        // A feed is publicly cached and read by feed readers without a session: always the
        // anonymous view (teasers only, when enabled), whoever fetched it.
        const lock = await resolveLock(context, scope, { anonymous: true });
        Object.assign(where, lockedPostsWhere(lock));

        const posts = await Post.where(where, {
            orderBy: 'publishedAt',
            orderDirection: 'desc',
            limit,
        });

        // A translation may be newer than its canonical post. Start with the
        // canonical feed window, then add parents referenced by the localized
        // feed window before sorting. Otherwise a newly published translation
        // for an older post can never reach a localized RSS feed.
        let feedCandidates = posts;
        if (language) {
            const translationRows = await PostTranslation.forPublicFeed({ ...scope, language, limit });
            const translatedPostIds = [
                ...new Set(translationRows.map((row) => row.get('postId') as string).filter(Boolean)),
            ];
            if (translatedPostIds.length > 0) {
                const translatedParents = await Post.where(
                    { ...where, id: { $in: translatedPostIds } },
                    { orderBy: 'publishedAt', orderDirection: 'desc', limit: translatedPostIds.length },
                );
                const byId = new Map<string, Post>();
                for (const post of [...posts, ...translatedParents]) byId.set(post.get('id') as string, post);
                feedCandidates = [...byId.values()];
            }
        }

        // Load author names from User model via authorId relationship
        // Collect unique authorIds and fetch users in one batch
        const authorIds = [
            ...new Set(feedCandidates.map((p) => p.get('authorId') as string | null).filter(Boolean)),
        ] as string[];
        const authorMap = new Map<string, string>();
        if (authorIds.length > 0) {
            const { User } = await import('@ottabase/ottaorm');
            const authors = await User.whereIn('id', authorIds, { select: ['id', 'name'] });
            for (const author of authors) {
                const id = author.get('id') as string;
                const name = author.get('name') as string;
                if (id && name) authorMap.set(id, name);
            }
        }

        // Derive the site URL from the request
        const siteUrl = `${url.protocol}//${url.host}`;
        const blogSlug = blog.info?.slug ?? null;
        const feedTitle = url.searchParams.get('title') || blog.info?.name || 'Blog';
        const feedDescription = url.searchParams.get('description') || 'Latest posts';

        const escapeXml = (str: string): string =>
            str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        const absoluteMediaUrl = (value: string | null | undefined): string | null => {
            if (!value) return null;
            try {
                const resolved = new URL(value, siteUrl);
                return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.toString() : null;
            } catch {
                return null;
            }
        };

        const localizedRows = await enrichPostsJsonBatch(feedCandidates, { language, languageConfig, lock });
        const localizedById = new Map(localizedRows.map((row) => [row.id as string, row]));
        // Enrichment drops what this reader may not see; never fall back to the raw row for it.
        const visibleCandidates = feedCandidates.filter((post) => localizedById.has(post.get('id') as string));
        const feedPosts =
            language && !languageConfig.fallbackToDefault
                ? visibleCandidates.filter((post) => {
                      const localized = localizedById.get(post.get('id') as string);
                      return localized?.translationId
                          ? localized.language === language
                          : post.get('language') === language;
                  })
                : visibleCandidates;
        const feedEntries = feedPosts
            .map((post) => ({
                post,
                localized: localizedById.get(post.get('id') as string) ?? (post.toJson() as Record<string, unknown>),
            }))
            .sort((a, b) => {
                const av = Number(a.localized.publishedAt ?? a.post.get('publishedAt') ?? 0);
                const bv = Number(b.localized.publishedAt ?? b.post.get('publishedAt') ?? 0);
                return bv - av;
            })
            .slice(0, limit);
        const items = feedEntries
            .map(({ post, localized }) => {
                const isBlurb = localized.contentType === 'blurb';
                const isPhotoJournal = post.get('contentType') === 'photo';
                const title = escapeXml((localized.title as string) || '');
                const link = escapeXml(
                    siteUrl +
                        blogPostPath(
                            blogSlug,
                            localized.slug as string,
                            localized.translationId ? (localized.language as string | undefined) : null,
                        ),
                );
                const excerpt = escapeXml(
                    (isBlurb ? (localized.blurbText as string) : (localized.excerpt as string)) || '',
                );
                // Get author name from User relationship (via authorId)
                const authorId = post.get('authorId') as string | null;
                const authorName = authorId ? escapeXml(authorMap.get(authorId) || '') : '';
                const publishedAt =
                    (localized.publishedAt as number | null) ?? (post.get('publishedAt') as number | null);
                const pubDate = publishedAt ? new Date(publishedAt).toUTCString() : '';
                const heroImage = localized.heroImage as { url?: string; mimeType?: string } | null;
                const enclosureUrl = absoluteMediaUrl(heroImage?.url);

                return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${excerpt}</description>
      ${authorName ? `<dc:creator>${authorName}</dc:creator>` : ''}
      ${isBlurb ? '<category>Blurb</category>' : ''}${isPhotoJournal ? '<category>Photo Journal</category>' : ''}
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}
      ${enclosureUrl ? `<enclosure url="${escapeXml(enclosureUrl)}" type="${escapeXml(heroImage?.mimeType || 'image/jpeg')}" />` : ''}
    </item>`;
            })
            .join('\n');

        const lastBuildDate =
            feedPosts.length > 0
                ? new Date(
                      Number(
                          feedEntries[0].localized.publishedAt ?? feedEntries[0].post.get('publishedAt') ?? Date.now(),
                      ),
                  ).toUTCString()
                : new Date().toUTCString();

        const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(siteUrl + blogBasePath(blogSlug))}</link>
    <description>${escapeXml(feedDescription)}</description>
    <language>${escapeXml(language || languageConfig.defaultLanguage)}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(siteUrl + '/api/blog/rss' + (blogSlug ? '?blog=' + encodeURIComponent(blogSlug) : ''))}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

        return new Response(rss, {
            headers: {
                'Content-Type': 'application/rss+xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
                Vary: 'Accept-Language',
            },
        });
    }

    // ============================================================
    // SITEMAP
    // ============================================================

    async function handleBlogSitemap(context: Ctx): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const blog = await publicBlog(context);
        if (blog instanceof Response) return blog;
        const { scope } = blog;
        const blogSlug = blog.info?.slug ?? null;
        const languageConfig = await languageConfigFor(context, scope);
        // Bounded at the sitemap protocol's own 50k-URL-per-file ceiling, not a
        // lower default: crawlers never pass ?limit=, so a smaller default would
        // silently drop older posts from a real deployment's sitemap the moment
        // it passed that default (the old endpoint was unbounded). Sitemap-index
        // pagination is the follow-up once a single deployment nears 50k posts.
        const urlLimit = parseBoundedInteger(url.searchParams.get('limit'), 50000, 1, 50000);
        const page = parseBoundedInteger(url.searchParams.get('page'), 1, 1, 1000000);
        const where: Record<string, unknown> = {
            status: 'published',
            contentType: { $ne: 'changelog' },
            ...scope,
            // Publicly cached: the anonymous view. Teased locked posts keep their (teaser) URL.
            ...lockedPostsWhere(await resolveLock(context, scope, { anonymous: true })),
        };
        const enabledLanguages = new Set(languageConfig.supportedLanguages.map((item) => item.code));
        const maxVariantsPerPost = Math.max(1, enabledLanguages.size + 1);
        const safePageSize = Math.max(1, Math.floor(Math.max(1, urlLimit - 1) / maxVariantsPerPost));
        const requestedPageSize = parseBoundedInteger(
            url.searchParams.get('pageSize'),
            safePageSize,
            1,
            Math.max(1, urlLimit - 1),
        );
        const pageSize = Math.min(requestedPageSize, safePageSize);
        const siteUrl = url.protocol + '//' + url.host;
        const escapeXml = (str: string): string =>
            str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');

        if (url.pathname.endsWith('/sitemap-index.xml')) {
            const summary = await Post.paginate(1, pageSize, where, { orderBy: 'publishedAt', orderDirection: 'desc' });
            const totalPages = Math.max(1, summary.totalPages);
            const blogQuery = blogSlug ? '&blog=' + encodeURIComponent(blogSlug) : '';
            const entries = Array.from({ length: totalPages }, (_, index) => {
                const pageNumber = index + 1;
                return (
                    '  <sitemap>\n    <loc>' +
                    escapeXml(
                        siteUrl + '/api/blog/sitemap.xml?page=' + pageNumber + '&pageSize=' + pageSize + blogQuery,
                    ) +
                    '</loc>\n  </sitemap>'
                );
            }).join('\n');
            const indexXml =
                '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
                entries +
                '\n</sitemapindex>';
            return new Response(indexXml, {
                headers: {
                    'Content-Type': 'application/xml; charset=utf-8',
                    'Cache-Control': 'public, max-age=3600',
                    Vary: 'Accept-Language',
                },
            });
        }

        const postsPage = await Post.where(where, {
            orderBy: 'publishedAt',
            orderDirection: 'desc',
            limit: pageSize + 1,
            offset: (page - 1) * pageSize,
        });
        const hasNextPage = postsPage.length > pageSize;
        const posts = postsPage.slice(0, pageSize);
        const publishedTranslations = await PostTranslation.forPublicPosts(
            posts.map((post) => post.get('id') as string),
        );
        const translationsByPost = new Map<string, PostTranslation[]>();
        for (const translation of publishedTranslations) {
            const postId = translation.get('postId') as string;
            const rows = translationsByPost.get(postId) ?? [];
            rows.push(translation);
            translationsByPost.set(postId, rows);
        }

        const absoluteUrl = (slug: string, language: string, canonical = false): string =>
            siteUrl + blogPostPath(blogSlug, slug, canonical ? null : language);
        const dateOnly = (value: unknown): string => {
            const timestamp = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : 0;
            return timestamp ? new Date(timestamp).toISOString().split('T')[0] : '';
        };
        const urlBlock = (
            loc: string,
            lastmod: string,
            changefreq: string,
            priority: string,
            alternates: Array<{ language: string; href: string }>,
        ): string =>
            [
                '  <url>',
                '    <loc>' + escapeXml(loc) + '</loc>',
                ...alternates.map(
                    (alternate) =>
                        '    <xhtml:link rel="alternate" hreflang="' +
                        escapeXml(alternate.language) +
                        '" href="' +
                        escapeXml(alternate.href) +
                        '" />',
                ),
                lastmod ? '    <lastmod>' + escapeXml(lastmod) + '</lastmod>' : '',
                '    <changefreq>' + changefreq + '</changefreq>',
                '    <priority>' + priority + '</priority>',
                '  </url>',
            ]
                .filter(Boolean)
                .join('\n');

        const urls: string[] = [];
        let truncated = false;
        for (const post of posts) {
            const postId = post.get('id') as string;
            const translations = (translationsByPost.get(postId) ?? []).filter((translation) => {
                const language = translation.get('language') as string;
                return enabledLanguages.has(language) && language !== (post.get('language') as string | undefined);
            });
            let canonicalLanguage = languageConfig.defaultLanguage;
            try {
                canonicalLanguage = normalizeLanguageCode(
                    String(post.get('language') || languageConfig.defaultLanguage),
                );
            } catch {
                /* use blog default */
            }
            const variants = [
                { language: canonicalLanguage, slug: post.get('slug') as string, canonical: true },
                ...translations.map((translation) => ({
                    language: translation.get('language') as string,
                    slug: translation.get('slug') as string,
                    canonical: false,
                })),
            ];
            const alternates = variants.map((variant) => ({
                language: variant.language,
                href: absoluteUrl(variant.slug, variant.language, variant.canonical),
            }));
            const lastmod = dateOnly(post.get('updatedAt'));
            const isBlurb = post.get('contentType') === 'blurb';
            for (const variant of variants) {
                if (urls.length + 1 >= urlLimit) {
                    truncated = true;
                    break;
                }
                urls.push(
                    urlBlock(
                        absoluteUrl(variant.slug, variant.language, variant.canonical),
                        lastmod,
                        isBlurb ? 'daily' : 'weekly',
                        isBlurb ? '0.5' : '0.7',
                        alternates,
                    ),
                );
            }
            if (truncated) break;
        }

        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>${escapeXml(siteUrl + blogBasePath(blogSlug))}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
${urls}
</urlset>`;

        return new Response(sitemap, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
                Vary: 'Accept-Language',
                'X-Sitemap-Page': String(page),
                ...(hasNextPage ? { 'X-Sitemap-Next-Page': String(page + 1) } : {}),
                ...(truncated ? { 'X-Sitemap-Truncated': 'true' } : {}),
            },
        });
    }

    // ============================================================
    // SCHEDULED POST PUBLISHING (cron handler)
    // ============================================================

    async function handleBlogPublishScheduled(context: Ctx): Promise<Response> {
        const { env, request, url } = context;

        if (!config.checkCronAuth(request, env)) {
            return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
        }

        const connectError = config.connect(env);
        if (connectError) return connectError;

        // Deliberately cross-app when no ?appId is given: one shared-DB cron
        // publishes every app's due posts. Pass ?appId= to restrict a run.
        const appId = url.searchParams.get('appId') || null;
        const [result, translationResult] = await Promise.all([
            Post.publishScheduled({ appId: appId ?? undefined }),
            PostTranslation.publishScheduled({ appId: appId ?? undefined }),
        ]);

        return jsonResponse({
            published: result.posts.length + translationResult.translations.length,
            posts: result.posts,
            translations: translationResult.translations,
            hasMore: result.hasMore || translationResult.hasMore,
        });
    }

    /**
     * Seed the app's public demo content into the SITE blog: sample articles, release notes, and
     * the block kitchensink that exercises every renderer. `requireAdmin` is wired to a
     * system-scoped platform admin gate, so only the platform owner can run it, and the site blog
     * is theirs to edit.
     *
     * Create-only: an existing slug is reported under `existing` and left untouched, so re-running
     * is safe after an administrator has tailored the seeded content.
     */
    async function handleBlogDemoSeed(context: Ctx): Promise<Response> {
        const auth = await config.requireAdmin(context);
        if (auth instanceof Response) return auth;

        const seeds = config.demoPosts;
        if (!seeds?.length) {
            return errorResponse('Demo content is not configured', 404, { code: 'NOT_FOUND' });
        }
        // Seeds are app fixtures, so a malformed one is a bug to surface, and before any write:
        // never a half-seeded blog, never a bad seed hidden behind a row that already exists.
        const problems = demoSeedProblems(seeds);
        if (problems.length > 0) throw new Error(`Demo posts: ${problems.join('; ')}`);

        const connectError = config.connect(context.env);
        if (connectError) return connectError;

        const site: BlogScope = { appId: resolveAppId(context), organizationId: null };
        const userId = auth.session?.user?.id ?? null;
        const now = Date.now();
        const taxonomy = taxonomyByName(site);
        const created: Array<{ id: unknown; slug: string; contentType: string }> = [];
        const existing: string[] = [];

        for (const seed of seeds) {
            const where: Record<string, unknown> = { slug: seed.slug, ...site };

            if (await Post.first(where)) {
                existing.push(seed.slug);
                continue;
            }

            const item = readImportPost(seed) as ImportPostInput; // checked above

            let post: Post;
            try {
                const seriesId = item.series ? await taxonomy.ensureTerm('series', item.series) : undefined;
                // Absent columns stay absent (never nulled), so each keeps its own default.
                post = await Post.create({
                    ...item.data,
                    ...(item.data.content ? { content: { ...(item.data.content as EditorJSData), time: now } } : {}),
                    status: 'published',
                    publishedAt: item.data.publishedAt ?? now,
                    ...(seriesId ? { seriesId } : {}),
                    userId,
                    authorId: userId,
                    ...site,
                });
            } catch (error) {
                // A concurrent seed request may win after our lookup. Re-check
                // only for a uniqueness conflict; all other failures must remain visible.
                const message = error instanceof Error ? error.message : String(error);
                if (!/unique|constraint|duplicate/i.test(message) || !(await Post.first(where))) {
                    throw error;
                }
                existing.push(seed.slug);
                continue;
            }
            const postId = post.get('id') as string;
            created.push({ id: postId, slug: seed.slug, contentType: seed.contentType });
            await taxonomy.linkTerms(postId, item.tags, item.categories);
        }

        return jsonResponse({ created, existing, total: seeds.length });
    }

    /**
     * POST /posts/preview-token: mint a signed draft-preview link for a post of the caller's
     * editorial blog. Gated by the editorial guard (requireContentEditor, falling back to
     * requireAdmin). 404 when no preview secret is configured.
     */
    async function handleBlogPreviewTokenMint(context: Ctx): Promise<Response> {
        const guard = config.requireContentEditor ?? config.requireAdmin;
        const auth = await guard(context);
        if (auth instanceof Response) return auth;

        const secret = config.previewTokenSecret?.(context.env);
        if (!secret) {
            return errorResponse('Preview tokens are not configured', 404, { code: 'NOT_FOUND' });
        }

        const connectError = config.connect(context.env);
        if (connectError) return connectError;

        const body = await readJson<{ slug?: string; ttlMs?: number } | null>(context.request);
        const slug = body?.slug?.trim();
        if (!slug) {
            return errorResponse('slug is required', 400, { code: 'VALIDATION_ERROR' });
        }

        // The post must exist in the editorial blog (any status: that is the point).
        const blog = await editorialScope(context);
        const post = await Post.first({ slug, ...blog });
        if (!post) {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        // OBJECT-level authorization: the baseline guard proves "may edit posts somewhere"; it must
        // not mint previews for posts the caller cannot edit (another author's draft, another
        // blog's post via a request-supplied scope, a password-protected post's content). Authors
        // always pass for their OWN posts; anything else requires the app's canManagePost check
        // against the POST ROW's org, never the request's. Denial answers 404, identical to a
        // missing post, so minting cannot be used as a cross-blog slug-existence oracle.
        const callerId = auth.session?.user?.id ?? null;
        const postAuthorId = (post.get('authorId') as string | null) ?? null;
        const postUserId = (post.get('userId') as string | null) ?? null;
        const isOwnPost = !!callerId && (callerId === postAuthorId || callerId === postUserId);
        if (!isOwnPost) {
            const managed = config.canManagePost
                ? await config.canManagePost(context, {
                      id: post.get('id') as string,
                      authorId: postAuthorId,
                      userId: postUserId,
                      organizationId: (post.get('organizationId') as string | null) ?? null,
                  })
                : false;
            if (!managed) {
                return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
            }
        }

        // Clamp TTL to [1 minute, 7 days]; default 24h lives in signPreviewToken.
        const ttlMs =
            typeof body?.ttlMs === 'number' && Number.isFinite(body.ttlMs)
                ? Math.min(7 * 24 * 60 * 60 * 1000, Math.max(60 * 1000, body.ttlMs))
                : undefined;

        const { token, expiresAt } = await signPreviewToken(secret, { slug, ...blog, ttlMs });
        const blogSlug = (await blogInfo(blog))?.slug ?? null;
        return jsonResponse({
            token,
            expiresAt,
            path: `${blogPostPath(blogSlug, slug)}?preview=${encodeURIComponent(token)}`,
        });
    }

    // ============================================================
    // IMPORT / EXPORT
    // ============================================================

    /**
     * Full-fidelity backup of every post the caller can read (any status), with taxonomy carried
     * by name so the file imports into another app, organization, or database. Translations,
     * versions, and password hashes are not exported.
     */
    async function handleBlogExport(context: Ctx): Promise<Response> {
        const guard = editorialGuard('update');
        if (!guard) return editorialGuardMissing();
        const auth = await guard(context);
        if (auth instanceof Response) return auth;

        const connectError = config.connect(context.env);
        if (connectError) return connectError;

        const securityContext = editorialWriteContext(auth, context);
        if (securityContext instanceof Response) return securityContext;

        let filter: Record<string, unknown>;
        try {
            filter = globalRLS.getReadFilter(Post.entity, securityContext);
        } catch {
            return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
        }

        // ponytail: the whole blog in one response; page it if exports outgrow Worker memory.
        const posts = await Post.where(filter, { orderBy: 'createdAt', orderDirection: 'asc', withDeferred: true });
        const postIds = posts.map((post) => post.get('id') as string);
        const unique = (values: unknown[]) => [...new Set(values.filter((v): v is string => typeof v === 'string'))];

        const [tagLinks, categoryLinks] = await Promise.all([
            chunkedFetch(postIds, (ids) => PostTagLink.whereIn('postId', ids)),
            chunkedFetch(postIds, (ids) => PostCategoryLink.whereIn('postId', ids)),
        ]);
        const [tags, categories, series] = await Promise.all([
            chunkedFetch(unique(tagLinks.map((link) => link.get('tagId'))), (ids) =>
                PostTag.whereIn('id', ids, { select: ['id', 'name'] }),
            ),
            chunkedFetch(unique(categoryLinks.map((link) => link.get('categoryId'))), (ids) =>
                PostCategory.whereIn('id', ids, { select: ['id', 'name'] }),
            ),
            chunkedFetch(unique(posts.map((post) => post.get('seriesId'))), (ids) =>
                PostSeries.whereIn('id', ids, { select: ['id', 'title'] }),
            ),
        ]);
        const nameById = new Map<string, string>();
        for (const row of [...tags, ...categories]) nameById.set(row.get('id') as string, row.get('name') as string);
        for (const row of series) nameById.set(row.get('id') as string, row.get('title') as string);

        const namesByPost = (links: Array<{ get(field: string): unknown }>, termField: string) => {
            const byPost = new Map<string, string[]>();
            for (const link of links) {
                const name = nameById.get(link.get(termField) as string);
                if (!name) continue;
                const postId = link.get('postId') as string;
                byPost.set(postId, [...(byPost.get(postId) ?? []), name]);
            }
            return byPost;
        };
        const tagNames = namesByPost(tagLinks, 'tagId');
        const categoryNames = namesByPost(categoryLinks, 'categoryId');

        const file: BlogExportFile = {
            format: BLOG_EXPORT_FORMAT,
            version: BLOG_EXPORT_VERSION,
            exportedAt: new Date().toISOString(),
            posts: posts.map((post) => {
                const id = post.get('id') as string;
                const row: Record<string, unknown> = {};
                for (const field of Object.keys(IMPORT_FIELD_TYPES)) {
                    const value = post.get(field);
                    row[field] = value instanceof Date ? value.getTime() : (value ?? null);
                }
                return {
                    ...row,
                    isProtected: post.get('isProtected') === true,
                    tags: tagNames.get(id) ?? [],
                    categories: categoryNames.get(id) ?? [],
                    series: nameById.get(post.get('seriesId') as string) ?? null,
                } as BlogExportPost;
            }),
        };
        return jsonResponse(file, 200, { headers: NO_STORE });
    }

    /**
     * Create posts from an export file or converted Markdown, at most BLOG_IMPORT_BATCH_SIZE per
     * request. Every post is created as the caller, in the caller's scope, through the fat model.
     * Same rules as the editor: published/scheduled rows need `posts:publish` (otherwise they land
     * as drafts), and taxonomy is linked only for callers who may manage it. Existing slugs are
     * skipped, never overwritten, so re-running an import is safe.
     */
    async function handleBlogImport(context: Ctx): Promise<Response> {
        const guard = editorialGuard('create');
        if (!guard) return editorialGuardMissing();
        const auth = await guard(context);
        if (auth instanceof Response) return auth;

        const connectError = config.connect(context.env);
        if (connectError) return connectError;

        const securityContext = editorialWriteContext(auth, context);
        if (securityContext instanceof Response) return securityContext;
        if (securityContext.organizationId == null && !securityContext.platformAdmin) {
            return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
        }

        const body = await readJson<{ posts?: unknown }>(context.request);
        if (!Array.isArray(body.posts) || body.posts.length === 0 || body.posts.length > BLOG_IMPORT_BATCH_SIZE) {
            return errorResponse(`posts must be an array of 1-${BLOG_IMPORT_BATCH_SIZE} items`, 400, {
                code: 'VALIDATION_ERROR',
            });
        }

        const scope = {
            organizationId: securityContext.organizationId ?? null,
            appId: securityContext.appId as string,
            userId: securityContext.userId as string,
            authorId: securityContext.userId as string,
        };
        try {
            globalRLS.validateWrite(Post.entity, securityContext, scope, 'create');
        } catch (error) {
            if (error instanceof RLSError) return errorResponse('Access denied', 403, { code: 'FORBIDDEN' });
            throw error;
        }

        const permissions = securityContext.permissions;
        const canPublish = Boolean(securityContext.platformAdmin) || hasGrantedPermission(permissions, 'posts:publish');
        // Mirrors generic CRUD: blog taxonomy is shared vocabulary, so writes need a content administrator.
        const canManageTaxonomy =
            Boolean(securityContext.platformAdmin) ||
            hasGrantedPermission(permissions, 'org:admin') ||
            hasGrantedPermission(permissions, 'taxonomy:manage');
        // The caller's blog: its own vocabulary, slugs and languages.
        const blog: BlogScope = { appId: scope.appId, organizationId: scope.organizationId };
        const languageConfig = await languageConfigFor(context, blog);
        const taxonomy = taxonomyByName(blog, (entity, data) =>
            globalRLS.validateWrite(entity, securityContext, data, 'create'),
        );

        const result: BlogImportResult = { created: [], skipped: [], warnings: [] };
        for (const raw of body.posts) {
            const item = readImportPost(raw);
            if (typeof item === 'string') {
                result.skipped.push({ slug: '', reason: item });
                continue;
            }
            const slug = importSlug(item.data.slug, item.data.title);
            if (!slug) {
                result.skipped.push({ slug: String(item.data.title), reason: 'Needs a title or slug usable in a URL' });
                continue;
            }
            if (await Post.first({ slug, ...blog })) {
                result.skipped.push({ slug, reason: 'A post with this slug already exists' });
                continue;
            }

            let status = (item.data.status as PostStatus | undefined) ?? 'draft';
            if (item.isProtected) {
                status = 'draft';
                result.warnings.push({
                    slug,
                    message:
                        'Was password-protected: imported as an unprotected draft. Set a new password before publishing.',
                });
            } else if ((status === 'published' || status === 'scheduled') && !canPublish) {
                status = 'draft';
                result.warnings.push({
                    slug,
                    message: 'Imported as a draft: publishing needs the posts:publish permission.',
                });
            }

            const hasTaxonomy = item.tags.length > 0 || item.categories.length > 0 || Boolean(item.series);
            if (hasTaxonomy && !canManageTaxonomy) {
                result.warnings.push({
                    slug,
                    message: 'Tags, categories, and series were not linked: they need taxonomy:manage.',
                });
            }
            const linkTaxonomy = hasTaxonomy && canManageTaxonomy;

            let post: Post;
            try {
                const seriesId =
                    linkTaxonomy && item.series ? await taxonomy.ensureTerm('series', item.series) : undefined;
                post = await Post.create({
                    ...item.data,
                    slug,
                    status,
                    language: item.data.language ?? languageConfig.defaultLanguage,
                    ...(seriesId ? { seriesId } : {}),
                    ...scope,
                });
            } catch (error) {
                if (error instanceof ContentValidationError || error instanceof DomainValidationError) {
                    result.skipped.push({ slug, reason: error.message });
                    continue;
                }
                if (error instanceof RLSError) {
                    result.skipped.push({ slug, reason: 'Access denied' });
                    continue;
                }
                throw error;
            }
            const postId = post.get('id') as string;
            result.created.push({ slug, id: postId });

            if (!linkTaxonomy) continue;
            try {
                await taxonomy.linkTerms(postId, item.tags, item.categories);
            } catch (error) {
                if (!(error instanceof RLSError)) throw error;
                result.warnings.push({ slug, message: 'Tags or categories could not be linked: access denied.' });
            }
        }

        return jsonResponse(result);
    }

    return {
        handleBlogStudioState,
        handleBlogStudioBlog,
        handleBlogStudioLanguages,
        handleBlogStudioAccess,
        handleBlogStudioReaderGrant,
        handleBlogStudioReaderRevoke,
        handleBlogPostTranslations,
        handleBlogPostTranslationCreate,
        handleBlogPostTranslationUpdate,
        handleBlogPostTranslationDelete,
        handleBlogStudioActivateTheme,
        handleBlogStudioPluginEnable,
        handleBlogStudioPluginConfig,
        handleBlogPostsList,
        handleBlogBlurbCreate,
        handleBlogBlurbUpdate,
        handleBlogPhotoJournalCreate,
        handleBlogPhotoJournalUpdate,
        handleBlogPostBySlug,
        handleBlogPostUnlock,
        handleBlogTagBySlug,
        handleBlogCategoryBySlug,
        handleBlogSeriesList,
        handleBlogSeriesBySlug,
        handleBlogAuthorById,
        handleBlogRelatedPosts,
        handleBlogRssFeed,
        handleBlogSitemap,
        handleBlogPublishScheduled,
        handleBlogDemoSeed,
        handleBlogPreviewTokenMint,
        handleBlogStudioThemeTokens,
        handleBlogExport,
        handleBlogImport,
    };
}
