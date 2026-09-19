/**
 * Blog route handlers — the package-owned HTTP surface.
 *
 * Bodies were moved verbatim from apps/otta-web/worker/routes/blog.ts; the only
 * changes are the injected seams in {@link BlogRouterConfig} (DB connect, admin
 * guard, cron auth, password verify, demo seed content, default appId).
 */
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import {
    DomainValidationError,
    globalRLS,
    MAX_SEARCH_TERM_BYTES,
    RLSError,
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
import { signPreviewToken, verifyPreviewToken } from '../preview-token';
import { StudioManager } from '../studio';
import {
    ContentValidationError,
    normalizeLanguageCode,
    type BlogLanguage,
    type BlogLanguageConfig,
    type EditorJSData,
    type PostCrosspost,
    type PostStatus,
} from '../types';
import type {
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

function resolveOrgId(request: Request, fallback: string | null = null): string | null {
    const fromSession = fallback?.trim();
    if (fromSession && fromSession !== 'null' && fromSession !== 'undefined') return fromSession;

    const fromHeader = request.headers.get('x-org-id')?.trim();
    if (fromHeader && fromHeader !== 'null' && fromHeader !== 'undefined') return fromHeader;

    return null;
}

/**
 * Public blog lookup by slug: always discriminates by appId.
 * Never queries by slug alone — the same slug can exist across apps (see Post schema indexes).
 * In org mode the lookup also discriminates by organizationId (null = platform-owned rows),
 * since org mode allows the same slug across orgs within one app.
 */
async function findPublishedPostBySlug(
    slug: string,
    appId: string,
    contentTypeParam: string | null,
    organizationId?: string | null,
): Promise<Post | null> {
    const primary: Record<string, unknown> = { slug, status: 'published', appId };
    if (contentTypeParam) primary.contentType = contentTypeParam;
    if (organizationId !== undefined) primary.organizationId = organizationId;
    return Post.first(primary);
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

/**
 * Batch enrichment for a page of posts — flat queries instead of ~5 per post.
 * Output per post is shape-identical to publicPostJson's enriched object
 * (privateNotes stripped, protected content stripped, tags[], categories[],
 * legacy categoryName/categorySlug, seriesTitle, author{}). Query count is
 * bounded: 6 flat queries per page (each id list chunked at 90 for D1's
 * bound-parameter limit), matching the RSS handler's whereIn batching pattern.
 */
async function enrichPostsJsonBatch(
    records: Post[],
    options?: {
        language?: string | null;
        languageConfig?: BlogLanguageConfig;
        appId?: string | null;
        organizationId?: string | null;
    },
): Promise<Record<string, unknown>[]> {
    if (records.length === 0) return [];

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

    // Categories: junction links plus legacy single-category column. Same
    // best-effort fallback as tags above.
    const catIdsByPost = new Map<string, string[]>();
    const catById = new Map<string, { id: string; name: string; slug: string }>();
    try {
        const catLinks = await chunkedFetch(postIds, (ids) => PostCategoryLink.where({ postId: ids }));
        for (const link of catLinks) {
            const pid = link.get('postId') as string;
            const cid = link.get('categoryId') as string;
            if (!catIdsByPost.has(pid)) catIdsByPost.set(pid, []);
            catIdsByPost.get(pid)!.push(cid);
        }
        const legacyCatIds = records.map((r) => r.get('categoryId') as string | null).filter(Boolean) as string[];
        const uniqueCatIds = [...new Set([...catLinks.map((l) => l.get('categoryId') as string), ...legacyCatIds])];
        const catRows = await chunkedFetch(uniqueCatIds, (ids) => PostCategory.whereIn('id', ids));
        for (const c of catRows) {
            catById.set(c.get('id') as string, {
                id: c.get('id') as string,
                name: c.get('name') as string,
                slug: c.get('slug') as string,
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
    const publishedTranslations = await PostTranslation.forPublicPosts(postIds, {
        status: 'published',
        ...(options?.appId !== undefined ? { appId: options.appId } : {}),
        ...(options?.organizationId !== undefined ? { organizationId: options.organizationId } : {}),
    });
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

    return records.map((record) => {
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
        if (rest.categoryId) {
            const legacy = catById.get(rest.categoryId as string);
            rest.categoryName = legacy ? legacy.name : null;
            rest.categorySlug = legacy ? legacy.slug : null;
        }
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

        return rest;
    });
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
    },
) {
    const j = record.toJson() as Record<string, unknown>;
    const { privateNotes, ...baseRest } = j;
    const publishedTranslations = options?.languageConfig
        ? await PostTranslation.forPublicPosts([String(record.get('id'))], {
              status: 'published',
              appId: record.get('appId') as string | null,
              organizationId: record.get('organizationId') as string | null,
          })
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
                rest.categories = categoryModels
                    .filter(Boolean)
                    .map((c) => ({ id: c!.get('id'), name: c!.get('name'), slug: c!.get('slug') }));
            } else {
                rest.categories = [];
            }
            // Legacy: keep categoryName for backwards compatibility if single categoryId exists
            if (rest.categoryId) {
                const category = await PostCategory.find(rest.categoryId as string);
                rest.categoryName = category ? category.get('name') : null;
                rest.categorySlug = category ? category.get('slug') : null;
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

    function resolveMode(env: Env): 'platform' | 'org' {
        if (typeof config.mode === 'function') return config.mode(env);
        return config.mode ?? 'platform';
    }

    function resolveAppId(context: Ctx): string {
        // App scope is server configuration, never request-controlled input.
        return config.defaultAppId(context.env);
    }

    /**
     * Resolve the tenant dimension for this request.
     * Platform mode: undefined (queries carry no org filter — column is ignored).
     * Org mode: the app-resolved organizationId, or null for platform-owned content.
     */
    async function resolveTenant(context: Ctx): Promise<string | null | undefined> {
        if (resolveMode(context.env) !== 'org') return undefined;
        const resolved = await config.resolveOrganizationId?.(context);
        return resolved ?? null;
    }

    async function languageConfigFor(
        _context: Ctx,
        appId: string,
        organizationId: string | null | undefined,
    ): Promise<BlogLanguageConfig> {
        const settings = await OttablogSettings.forScope({ appId, organizationId });
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
        appId: string,
        organizationId: string | null | undefined,
        configForBlog: BlogLanguageConfig,
    ): Promise<PostTranslation | null> {
        if (!language) return null;
        if (!configForBlog.supportedLanguages.some((item) => item.code === language)) return null;
        return PostTranslation.findForPost(postId, language, { appId, organizationId, status: 'published' });
    }

    async function findLocalizedPostBySlug(
        context: Ctx,
        slug: string,
        appId: string,
        contentTypeParam: string | null,
        organizationId: string | null | undefined,
        languageConfig: BlogLanguageConfig,
    ): Promise<{ record: Post; translation: PostTranslation | null; language: string } | null> {
        const language = requestedLanguage(context, languageConfig);
        if (language && languageConfig.supportedLanguages.some((item) => item.code === language)) {
            const translation = await PostTranslation.findBySlug(slug, {
                appId,
                organizationId,
                language,
                status: 'published',
            });
            if (translation) {
                const baseWhere: Record<string, unknown> = {
                    id: translation.get('postId'),
                    status: 'published',
                    appId,
                };
                if (contentTypeParam) baseWhere.contentType = contentTypeParam;
                if (organizationId !== undefined) baseWhere.organizationId = organizationId;
                const record = await Post.first(baseWhere);
                if (record) return { record, translation, language };
            }
        }
        const record = await findPublishedPostBySlug(slug, appId, contentTypeParam, organizationId);
        if (!record) return null;
        const translation = await translationFor(
            record.get('id') as string,
            language,
            appId,
            organizationId,
            languageConfig,
        );
        if (translation) return { record, translation, language: language! };
        const canonicalLanguage = (record.get('language') as string) || languageConfig.defaultLanguage;
        if (
            language &&
            language !== canonicalLanguage &&
            languageConfig.supportedLanguages.some((item) => item.code === language) &&
            !languageConfig.fallbackToDefault
        )
            return null;
        return { record, translation: null, language: canonicalLanguage };
    }

    /**
     * Guard a Studio operation against its RESOLVED blog scope: null/undefined
     * target = the platform blog (platform admin), an org id = that org's blog
     * (its org admin, or a platform admin) via requireScopedStudioAdmin. Without
     * the seam, falls back to requireAdmin — the platform-only behavior.
     */
    async function requireStudioAdmin(
        context: Ctx,
        organizationId: string | null | undefined,
    ): Promise<import('./types').BlogAdminResult | Response> {
        if (config.requireScopedStudioAdmin) {
            return config.requireScopedStudioAdmin(context, { organizationId: organizationId ?? null });
        }
        return config.requireAdmin(context);
    }

    /**
     * Public rendering shape of the studio state: the active theme (the only
     * one visitors render) and enabled plugins with config, plus bare
     * {pluginId, enabled:false} skeletons for disabled rows so the client can
     * deactivate statically-registered defaults. Inactive themes' rows (and
     * their tokens/config) and disabled plugins' configs stay admin-only —
     * in org mode this endpoint is reachable for ANY org via request-supplied
     * scope, so the full payload must not be an anonymous enumeration surface.
     */
    function toPublicStudioState(state: Awaited<ReturnType<typeof StudioManager.getState>>) {
        return {
            activeThemeId: state.activeThemeId,
            languageConfig: state.languageConfig,
            themes: state.themes.filter((t) => t.isActive),
            plugins: state.plugins.map((p) =>
                p.enabled ? p : { ...p, config: null, description: null, name: p.pluginId },
            ),
        };
    }

    async function handleBlogStudioState(context: Ctx): Promise<Response> {
        // Public endpoint: the runtime needs active theme + enabled plugin config to render blog pages
        // for every visitor (BlogStudioProvider is mounted globally). Mutation endpoints below remain
        // admin-guarded. Default-row seeding is gated to admin callers to avoid public write side effects.
        const { env } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const orgScope = organizationId !== undefined ? { organizationId } : {};

        // The guard resolves the full session context — memoize so seeding
        // and the ?full=1 payload decision cost at most one resolution. Scoped:
        // an org admin administers THEIR org's studio; the platform blog
        // (null/undefined tenant) requires a platform admin.
        let adminMemo: boolean | null = null;
        const callerIsAdmin = async (): Promise<boolean> => {
            if (adminMemo === null) {
                const admin = await requireStudioAdmin(context, organizationId);
                adminMemo = !(admin instanceof Response);
            }
            return adminMemo;
        };

        let state = await StudioManager.getState(appId, organizationId);

        const needsSeeding = state.themes.length === 0 || state.plugins.length === 0;
        if (needsSeeding && (await callerIsAdmin())) {
            // Only seed default theme/plugin rows if the caller is an admin — avoids any unauthenticated
            // visitor triggering DB writes. Non-admins get the current (possibly empty) state; the client
            // falls back to in-memory defaults registered by registerBlogThemesAndPlugins().
            // Unique-violation tolerant: two concurrent admin loads may race the same
            // seed inserts; the loser's constraint error is benign (the row exists).
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
                        appId,
                        ...orgScope,
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
                        appId,
                        ...orgScope,
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
                        appId,
                        ...orgScope,
                        enabled: false,
                    }),
                );
            }
            state = await StudioManager.getState(appId, organizationId);
        }

        // Full state (inactive themes, disabled-plugin configs) is the admin
        // Studio's payload — explicit opt-in via ?full=1 plus the admin gate.
        // Everyone else gets the public rendering shape.
        if (context.url.searchParams.get('full') === '1' && (await callerIsAdmin())) {
            return jsonResponse(state);
        }
        return jsonResponse(toPublicStudioState(state));
    }

    async function handleBlogStudioLanguages(context: Ctx): Promise<Response> {
        const connectError = config.connect(context.env);
        if (connectError) return connectError;
        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        if (context.request.method === 'GET') {
            return jsonResponse(await languageConfigFor(context, appId, organizationId));
        }
        const admin = await requireStudioAdmin(context, organizationId);
        if (admin instanceof Response) return admin;
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
            const settings = await OttablogSettings.ensure({ appId, organizationId });
            await settings.updateLanguages({
                defaultLanguage: body.defaultLanguage,
                supportedLanguages: body.supportedLanguages as BlogLanguage[],
                fallbackToDefault: body.fallbackToDefault as boolean | undefined,
            });
            return jsonResponse(settings.config());
        } catch (error) {
            if (error instanceof ContentValidationError || error instanceof DomainValidationError) {
                return errorResponse(error.message, error instanceof DomainValidationError ? error.status : 400, {
                    code: 'VALIDATION_ERROR',
                });
            }
            throw error;
        }
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
            languageConfig: await languageConfigFor(
                context,
                (securityContext.appId ?? appIdForPost(post)) as string,
                securityContext.organizationId,
            ),
        };
    }

    function appIdForPost(post: Post): string {
        return (post.get('appId') as string) || '';
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
        const scopedAppId = (result.post.get('appId') as string | null) ?? result.securityContext.appId;
        const translations = await PostTranslation.forPost(postId, {
            appId: scopedAppId,
            organizationId: result.securityContext.organizationId,
        });
        return jsonResponse({
            baseLanguage: result.post.get('language') || result.languageConfig.defaultLanguage,
            languageConfig: result.languageConfig,
            translations: translations.map((translation) => translation.toJson()),
        });
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
        const scopedAppId = (result.post.get('appId') as string | null) ?? result.securityContext.appId;
        const translation = await PostTranslation.findForPost(postId, language, {
            appId: scopedAppId,
            organizationId: result.securityContext.organizationId,
        });
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
        const scopedAppId = (result.post.get('appId') as string | null) ?? result.securityContext.appId;
        const translation = await PostTranslation.findForPost(postId, language, {
            appId: scopedAppId,
            organizationId: result.securityContext.organizationId,
        });
        if (!translation) return errorResponse('Translation not found', 404, { code: 'NOT_FOUND' });
        await PostTranslation.delete(translation.get('id') as string);
        return jsonResponse({ success: true });
    }

    async function handleBlogStudioActivateTheme(context: Ctx): Promise<Response> {
        const { request, env } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const admin = await requireStudioAdmin(context, organizationId);
        if (admin instanceof Response) return admin;
        const orgScope = organizationId !== undefined ? { organizationId } : {};
        const body = await readJson<{ themeId: string }>(request);
        const themeId = body?.themeId;
        if (!themeId) {
            return errorResponse('themeId is required', 400, { code: 'VALIDATION_ERROR' });
        }

        let themeRow = await OttablogTheme.findByThemeId(themeId, { appId: appId ?? undefined, organizationId });
        if (!themeRow) {
            await OttablogTheme.create({
                themeId,
                name: themeId,
                appId,
                ...orgScope,
                isActive: false,
            });
            themeRow = await OttablogTheme.findByThemeId(themeId, { appId: appId ?? undefined, organizationId });
        }
        if (themeRow) {
            await themeRow.activate({ appId: appId ?? undefined, organizationId });
        }
        return jsonResponse({ success: true });
    }

    async function handleBlogStudioPluginEnable(context: Ctx): Promise<Response> {
        const { request, env } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const admin = await requireStudioAdmin(context, organizationId);
        if (admin instanceof Response) return admin;
        const orgScope = organizationId !== undefined ? { organizationId } : {};
        const body = await readJson<{ pluginId: string; enabled: boolean }>(request);
        const pluginId = body?.pluginId;
        const enabled = body?.enabled ?? true;

        if (!pluginId) {
            return errorResponse('pluginId is required', 400, { code: 'VALIDATION_ERROR' });
        }

        let pluginRow = await OttablogPlugin.findByPluginId(pluginId, { appId: appId ?? undefined, organizationId });
        if (!pluginRow) {
            await OttablogPlugin.create({
                pluginId,
                name: pluginId,
                appId,
                ...orgScope,
                enabled,
            });
        } else {
            pluginRow.set('enabled', enabled);
            await pluginRow.save();
        }
        return jsonResponse({ success: true });
    }

    /**
     * POST /studio/theme/tokens — set a theme row's sparse brand-token overrides
     * (the data-driven half of blog theming). Admin-gated like other Studio
     * mutations. Tokens are validated at render time (theme-tokens.ts); here we
     * only require a JSON object shape so bad values can be corrected in place.
     */
    async function handleBlogStudioThemeTokens(context: Ctx): Promise<Response> {
        const { request, env } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const admin = await requireStudioAdmin(context, organizationId);
        if (admin instanceof Response) return admin;
        const body = await readJson<{
            themeId: string;
            tokens: { light?: Record<string, string>; dark?: Record<string, string> } | null;
        }>(request);
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

        const themeRow = await OttablogTheme.findByThemeId(themeId, { appId: appId ?? undefined, organizationId });
        if (!themeRow) {
            return errorResponse('Theme not found', 404, { code: 'NOT_FOUND' });
        }

        themeRow.set('tokens', tokens);
        await themeRow.save();
        return jsonResponse({ success: true });
    }

    async function handleBlogStudioPluginConfig(context: Ctx): Promise<Response> {
        const { request, env } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const admin = await requireStudioAdmin(context, organizationId);
        if (admin instanceof Response) return admin;
        const body = await readJson<{ pluginId: string; config: Record<string, unknown> }>(request);
        const pluginId = body?.pluginId;
        const pluginConfig = body?.config;

        if (!pluginId) {
            return errorResponse('pluginId is required', 400, { code: 'VALIDATION_ERROR' });
        }

        const pluginRow = await OttablogPlugin.findByPluginId(pluginId, { appId: appId ?? undefined, organizationId });
        if (!pluginRow) {
            return errorResponse('Plugin not found', 404, { code: 'NOT_FOUND' });
        }

        await pluginRow.updateConfig(pluginConfig ?? {});
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

        const page = parseBoundedInteger(url.searchParams.get('page'), 1, 1, 1000);
        const perPage = parseBoundedInteger(url.searchParams.get('perPage'), 15, 1, 50);
        // Always app-scoped (param → x-app-id → config default): on a shared
        // multi-app database, one app's public list must never serve another's.
        const appId = resolveAppId(context);
        const contentType = url.searchParams.get('contentType') || null;
        const seriesId = url.searchParams.get('seriesId') || null;
        const categoryId = url.searchParams.get('categoryId') || null;
        const tagId = url.searchParams.get('tagId') || null;
        const search = url.searchParams.get('search') || null;
        const orderBy = url.searchParams.get('orderBy') || 'publishedAt';
        const orderDirection = (url.searchParams.get('orderDirection') || 'desc') as 'asc' | 'desc';
        // Date archive: filter posts by year (and optionally month) of publishedAt
        const yearParam = url.searchParams.get('year') || null;
        const monthParam = url.searchParams.get('month') || null;
        const organizationId = await resolveTenant(context);
        const languageConfig = await languageConfigFor(context, appId, organizationId);
        const language = requestedLanguage(context, languageConfig);

        const where: Record<string, unknown> = { status: 'published' };
        if (appId) where.appId = appId;
        if (organizationId !== undefined) where.organizationId = organizationId;
        if (contentType) {
            where.contentType = contentType;
        } else {
            // By default, exclude changelog posts from the blog list (changelog has its own UI at /changelog)
            where.contentType = { $ne: 'changelog' };
        }
        if (seriesId) where.seriesId = seriesId;

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

        // Tag-based filtering: find post IDs that have this tag, then filter
        let tagFilterPostIds: string[] | null = null;
        if (tagId) {
            const links = await PostTagLink.where({ tagId });
            tagFilterPostIds = links.map((l) => l.get('postId') as string);
            if (tagFilterPostIds.length === 0) {
                // No posts have this tag — return empty
                return jsonResponse({ data: [], pagination: { page, perPage, total: 0, totalPages: 0 } });
            }
        }

        // Category-based filtering: find post IDs that have this category via junction table
        let categoryFilterPostIds: string[] | null = null;
        if (categoryId) {
            const links = await PostCategoryLink.where({ categoryId });
            categoryFilterPostIds = links.map((l) => l.get('postId') as string);
            if (categoryFilterPostIds.length === 0) {
                return jsonResponse({ data: [], pagination: { page, perPage, total: 0, totalPages: 0 } });
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
                return jsonResponse({ data: [], pagination: { page, perPage, total: 0, totalPages: 0 } });
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
                PostTranslation.where(
                    { language, status: 'published', appId, organizationId: organizationId ?? null },
                    { select: ['postId'] },
                ),
                Post.where({ ...where, language }, { select: ['id'] }),
            ]);
            const visibleIds = [
                ...new Set([
                    ...translatedRows.map((row) => row.get('postId') as string),
                    ...canonicalRows.map((row) => row.get('id') as string),
                ]),
            ];
            if (visibleIds.length === 0)
                return jsonResponse({ data: [], pagination: { page, perPage, total: 0, totalPages: 0 } });
            if (junctionIds) {
                const visibleSet = new Set(visibleIds);
                junctionIds = junctionIds.filter((id) => visibleSet.has(id));
                if (junctionIds.length === 0)
                    return jsonResponse({ data: [], pagination: { page, perPage, total: 0, totalPages: 0 } });
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
                PostTranslation.searchPostIds(searchTerm, {
                    language,
                    status: 'published',
                    appId,
                    organizationId: organizationId ?? null,
                }),
                Post.searchPostIds(searchTerm, searchFields, where),
            ]);
            const matchingIds = [...new Set([...localizedIds, ...canonicalIds])];
            if (matchingIds.length > 0) {
                localizedSearchMatched = true;
                if (junctionIds) {
                    const matchingSet = new Set(matchingIds);
                    junctionIds = junctionIds.filter((id) => matchingSet.has(id));
                    if (junctionIds.length === 0)
                        return jsonResponse({ data: [], pagination: { page, perPage, total: 0, totalPages: 0 } });
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
        const data = await enrichPostsJsonBatch(result.data as Post[], {
            language,
            languageConfig,
            appId,
            organizationId: organizationId ?? null,
        });
        return jsonResponse({
            data,
            pagination: {
                page: result.page,
                perPage: result.perPage,
                total: result.total,
                totalPages: result.totalPages,
            },
        });
    }

    /**
     * Signed draft preview: when a valid, unexpired `?preview=` token matches this
     * slug + appId, load the post WITHOUT the published-status filter. The token's
     * own org scope drives the lookup (it was bound at mint time), so a token can
     * never reach across tenants. Returns null when preview does not apply.
     */
    async function findPostForPreview(context: Ctx, slug: string, appId: string): Promise<Post | null> {
        const token = context.url.searchParams.get('preview');
        if (!token) return null;
        const secret = config.previewTokenSecret?.(context.env);
        if (!secret) return null;

        const payload = await verifyPreviewToken(secret, token);
        if (!payload || payload.slug !== slug || payload.appId !== appId) return null;

        const where: Record<string, unknown> = { slug, appId };
        if (payload.organizationId !== undefined) where.organizationId = payload.organizationId;
        return Post.first(where);
    }

    async function handleBlogPostBySlug(context: Ctx, slug: string): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const preview = await findPostForPreview(context, slug, appId);
        const organizationId = preview ? undefined : await resolveTenant(context);
        const contentTypeParam = url.searchParams.get('contentType') || null;
        const languageConfig = await languageConfigFor(context, appId, organizationId);
        const localized = preview
            ? {
                  record: preview,
                  translation: null,
                  language: (preview.get('language') as string) || languageConfig.defaultLanguage,
              }
            : await findLocalizedPostBySlug(context, slug, appId, contentTypeParam, organizationId, languageConfig);
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

        const data = await publicPostJson(record, {
            // A preview link is the review artifact — the token grants content access
            // (password-protection stripping still applies to normal public reads).
            includeContent: !!preview,
            enrichTags: true,
            enrichCategory: true,
            enrichSeries: true,
            enrichAuthor: true,
            translation: localized?.translation ?? null,
            languageConfig,
        });
        return jsonResponse(preview ? { ...data, preview: true } : data);
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

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const contentTypeParam = url.searchParams.get('contentType') || null;
        const languageConfig = await languageConfigFor(context, appId, organizationId);
        const localized = await findLocalizedPostBySlug(
            context,
            slug,
            appId,
            contentTypeParam,
            organizationId,
            languageConfig,
        );
        const record = localized?.record;
        if (!record) {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        // Changelogs require explicit opt-in via contentType=changelog parameter.
        // Without it, changelog posts are hidden from the regular blog API.
        if (!contentTypeParam && record.get('contentType') === 'changelog') {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
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
            });
            return jsonResponse(data);
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
        });
        return jsonResponse(data);
    }

    // ============================================================
    // ARCHIVE PAGES: tag, category, series by slug
    // ============================================================

    async function handleBlogTagBySlug(context: Ctx, slug: string): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const type = url.searchParams.get('type') || 'post';
        const tag = await PostTag.findBySlug(slug, { appId, type, organizationId });
        if (!tag) {
            return errorResponse('Tag not found', 404, { code: 'NOT_FOUND' });
        }
        return jsonResponse(tag.toJson());
    }

    async function handleBlogCategoryBySlug(context: Ctx, slug: string): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const type = url.searchParams.get('type') || 'post';
        const category = await PostCategory.findBySlug(slug, { appId, type, organizationId });
        if (!category) {
            return errorResponse('Category not found', 404, { code: 'NOT_FOUND' });
        }
        return jsonResponse(category.toJson());
    }

    async function handleBlogSeriesBySlug(context: Ctx, slug: string): Promise<Response> {
        const { env } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const series = await PostSeries.findBySlug(slug, { appId, organizationId });
        if (!series) {
            return errorResponse('Series not found', 404, { code: 'NOT_FOUND' });
        }
        return jsonResponse(series.toJson());
    }

    // ============================================================
    // RELATED POSTS
    // ============================================================

    async function handleBlogRelatedPosts(context: Ctx, postId: string): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const limit = parseBoundedInteger(url.searchParams.get('limit'), 4, 1, 10);

        const postWhere: Record<string, unknown> = { id: postId, appId };
        if (organizationId !== undefined) postWhere.organizationId = organizationId;
        const post = await Post.first(postWhere);
        if (!post) {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        // Gather category IDs from junction table for junction-aware related lookup
        const categoryLinks = await PostCategoryLink.where({ postId });
        const categoryIds = categoryLinks.map((cl) => cl.get('categoryId') as string);

        const related = await Post.related(postId, {
            categoryIds,
            contentType: post.get('contentType') as string,
            appId,
            organizationId,
            limit,
        });

        // Batched enrichment (adds categories/seriesTitle alongside tags/author —
        // additive fields, same per-post shape as the list endpoint).
        const languageConfig = await languageConfigFor(context, appId, organizationId);
        const data = await enrichPostsJsonBatch(related, {
            language: requestedLanguage(context, languageConfig),
            languageConfig,
            appId,
            organizationId: organizationId ?? null,
        });
        return jsonResponse(data);
    }

    // ============================================================
    // RSS FEED
    // ============================================================

    async function handleBlogRssFeed(context: Ctx): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const languageConfig = await languageConfigFor(context, appId, organizationId);
        const language = requestedLanguage(context, languageConfig);
        const contentType = url.searchParams.get('contentType') || null;
        const limit = parseBoundedInteger(url.searchParams.get('limit'), 25, 1, 100);

        const where: Record<string, unknown> = { status: 'published' };
        if (appId) where.appId = appId;
        if (organizationId !== undefined) where.organizationId = organizationId;
        if (contentType) {
            where.contentType = contentType;
        } else {
            where.contentType = { $ne: 'changelog' };
        }

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
            const translationRows = await PostTranslation.forPublicFeed({
                language,
                appId,
                organizationId: organizationId ?? null,
                limit,
            });
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
        const feedTitle = url.searchParams.get('title') || 'Blog';
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

        const localizedRows = await enrichPostsJsonBatch(feedCandidates, {
            language,
            languageConfig,
            appId,
            organizationId: organizationId ?? null,
        });
        const localizedById = new Map(localizedRows.map((row) => [row.id as string, row]));
        const feedPosts =
            language && !languageConfig.fallbackToDefault
                ? feedCandidates.filter((post) => {
                      const localized = localizedById.get(post.get('id') as string);
                      return localized?.translationId
                          ? localized.language === language
                          : post.get('language') === language;
                  })
                : feedCandidates;
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
                const slug = localized.slug as string;
                const localizedLanguage = localized.language as string | undefined;
                const languageSuffix =
                    localized.translationId && localizedLanguage
                        ? '?lang=' + encodeURIComponent(localizedLanguage)
                        : '';
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
      <link>${escapeXml(siteUrl)}/blog/${escapeXml(slug)}${languageSuffix}</link>
      <guid isPermaLink="true">${escapeXml(siteUrl)}/blog/${escapeXml(slug)}${languageSuffix}</guid>
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
    <link>${escapeXml(siteUrl)}/blog</link>
    <description>${escapeXml(feedDescription)}</description>
    <language>${escapeXml(language || languageConfig.defaultLanguage)}</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(siteUrl)}/api/blog/rss" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

        return new Response(rss, {
            headers: {
                'Content-Type': 'application/rss+xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
                Vary: 'Accept-Language, X-Org-Id, X-App-Id',
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

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);
        const languageConfig = await languageConfigFor(context, appId, organizationId);
        // Bounded at the sitemap protocol's own 50k-URL-per-file ceiling, not a
        // lower default: crawlers never pass ?limit=, so a smaller default would
        // silently drop older posts from a real deployment's sitemap the moment
        // it passed that default (the old endpoint was unbounded). Sitemap-index
        // pagination is the follow-up once a single deployment nears 50k posts.
        const urlLimit = parseBoundedInteger(url.searchParams.get('limit'), 50000, 1, 50000);
        const page = parseBoundedInteger(url.searchParams.get('page'), 1, 1, 1000000);
        const where: Record<string, unknown> = { status: 'published', contentType: { $ne: 'changelog' } };
        if (appId) where.appId = appId;
        if (organizationId !== undefined) where.organizationId = organizationId;
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
            const queryAppId = url.searchParams.get('appId');
            const appQuery = queryAppId ? '&appId=' + encodeURIComponent(queryAppId) : '';
            const entries = Array.from({ length: totalPages }, (_, index) => {
                const pageNumber = index + 1;
                return (
                    '  <sitemap>\n    <loc>' +
                    escapeXml(
                        siteUrl + '/api/blog/sitemap.xml?page=' + pageNumber + '&pageSize=' + pageSize + appQuery,
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
                    Vary: 'Accept-Language, X-Org-Id, X-App-Id',
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
            { appId, organizationId: organizationId ?? null, status: 'published' },
        );
        const translationsByPost = new Map<string, PostTranslation[]>();
        for (const translation of publishedTranslations) {
            const postId = translation.get('postId') as string;
            const rows = translationsByPost.get(postId) ?? [];
            rows.push(translation);
            translationsByPost.set(postId, rows);
        }

        const absoluteUrl = (slug: string, language: string, canonical = false): string => {
            const suffix = canonical ? '' : '?lang=' + encodeURIComponent(language);
            return siteUrl + '/blog/' + encodeURIComponent(slug) + suffix;
        };
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
    <loc>${escapeXml(siteUrl)}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
${urls}
</urlset>`;

        return new Response(sitemap, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
                Vary: 'Accept-Language, X-Org-Id, X-App-Id',
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
     * Seed the app's public demo content — sample articles, release notes, and
     * the block kitchensink that exercises every renderer. This is the single
     * seeding entry point; `requireAdmin` is wired to a system-scoped platform
     * admin gate, so only the platform owner can run it.
     *
     * Create-only: an existing slug is reported under `existing` and left
     * untouched, so re-running is safe after an administrator has tailored the
     * seeded content.
     *
     * Rows are tagged with the CALLER's organization so the seeded posts are
     * immediately visible and editable in the admin surface, whose reads are
     * tenant-filtered. Known limitation: an admin browsing in platform scope
     * still seeds into their session org, since the platform-scope sentinel is
     * an app-level concept this package does not resolve.
     */
    async function handleBlogDemoSeed(context: Ctx): Promise<Response> {
        const auth = await config.requireAdmin(context);
        if (auth instanceof Response) return auth;

        const seeds = config.demoPosts;
        if (!seeds?.length) {
            return errorResponse('Demo content is not configured', 404, { code: 'NOT_FOUND' });
        }

        const connectError = config.connect(context.env);
        if (connectError) return connectError;

        const appId = resolveAppId(context);
        // Seed into the CALLER's own organization, not the public-read tenant.
        // resolveTenant() answers "which tenant does a visitor read?" — in platform
        // mode that is undefined, i.e. a NULL organizationId. Seeding NULL puts the
        // rows outside every admin's scope, so the editor's own lookup
        // (GET /api/ottaorm/posts/:id, tenant-filtered) 404s on content the seed
        // just created. Tagging the caller's org makes seeded posts behave exactly
        // like posts that admin creates by hand.
        const organizationId = resolveOrgId(context.request, auth.session?.user?.organizationId ?? null);
        const userId = auth.session?.user?.id ?? null;
        const publishedAt = new Date().toISOString();
        const created: Array<{ id: unknown; slug: string; contentType: string }> = [];
        const existing: string[] = [];

        for (const seed of seeds) {
            // Mirror the UNIQUE index that actually binds — (app_id, slug) — rather
            // than the org-aware one. An org-filtered probe would miss a same-slug
            // row owned by another tenant and turn the insert into a hard constraint
            // failure instead of a clean "already exists".
            const where: Record<string, unknown> = { slug: seed.slug, appId };

            if (await Post.first(where)) {
                existing.push(seed.slug);
                continue;
            }

            try {
                const post = await Post.create({
                    title: seed.title,
                    slug: seed.slug,
                    excerpt: seed.excerpt,
                    content: { ...seed.content, time: Date.now() },
                    contentType: seed.contentType,
                    status: 'published',
                    isFeatured: seed.isFeatured ?? false,
                    // Omitted rather than nulled when a seed has no hero, so the
                    // column keeps its own default instead of being force-cleared.
                    ...(seed.heroImage ? { heroImage: seed.heroImage } : {}),
                    publishedAt,
                    postedAt: publishedAt,
                    userId,
                    authorId: userId,
                    appId,
                    organizationId,
                });
                created.push({ id: post.get('id'), slug: seed.slug, contentType: seed.contentType });
            } catch (error) {
                // A concurrent seed request may win after our lookup. Re-check
                // only for a uniqueness conflict; all other failures must remain visible.
                const message = error instanceof Error ? error.message : String(error);
                if (!/unique|constraint|duplicate/i.test(message) || !(await Post.first(where))) {
                    throw error;
                }
                existing.push(seed.slug);
            }
        }

        return jsonResponse({ created, existing, total: seeds.length });
    }

    /**
     * POST /posts/preview-token — mint a signed draft-preview link.
     * Gated by the editorial guard (requireContentEditor, falling back to
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

        const body = await readJson<{ slug?: string; ttlMs?: number }>(context.request);
        const slug = body?.slug?.trim();
        if (!slug) {
            return errorResponse('slug is required', 400, { code: 'VALIDATION_ERROR' });
        }

        const appId = resolveAppId(context);
        const organizationId = await resolveTenant(context);

        // The post must exist in the caller's scope (any status — that is the point).
        const where: Record<string, unknown> = { slug, appId };
        if (organizationId !== undefined) where.organizationId = organizationId;
        const post = await Post.first(where);
        if (!post) {
            return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
        }

        // OBJECT-level authorization: the baseline guard proves "may edit posts
        // somewhere"; it must not mint previews for posts the caller cannot edit
        // (another author's draft, another tenant's post via a request-supplied
        // org hint, a password-protected post's content). Authors always pass
        // for their OWN posts; anything else requires the app's canManagePost
        // check against the POST ROW's org — never the request's org hint.
        // Denial answers 404, identical to a missing post, so minting cannot be
        // used as a cross-scope slug-existence oracle.
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

        // Bind the token to the POST ROW's org scope (not the request's org
        // hint): the row is what the preview will disclose.
        const tokenOrgScope =
            organizationId !== undefined ? ((post.get('organizationId') as string | null) ?? null) : undefined;

        // Clamp TTL to [1 minute, 7 days]; default 24h lives in signPreviewToken.
        const ttlMs =
            typeof body?.ttlMs === 'number' && Number.isFinite(body.ttlMs)
                ? Math.min(7 * 24 * 60 * 60 * 1000, Math.max(60 * 1000, body.ttlMs))
                : undefined;

        const { token, expiresAt } = await signPreviewToken(secret, {
            slug,
            appId,
            organizationId: tokenOrgScope,
            ttlMs,
        });
        return jsonResponse({
            token,
            expiresAt,
            path: `/blog/${encodeURIComponent(slug)}?preview=${encodeURIComponent(token)}`,
        });
    }

    return {
        handleBlogStudioState,
        handleBlogStudioLanguages,
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
        handleBlogSeriesBySlug,
        handleBlogRelatedPosts,
        handleBlogRssFeed,
        handleBlogSitemap,
        handleBlogPublishScheduled,
        handleBlogDemoSeed,
        handleBlogPreviewTokenMint,
        handleBlogStudioThemeTokens,
    };
}
