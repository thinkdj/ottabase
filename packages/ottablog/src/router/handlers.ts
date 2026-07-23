/**
 * Blog route handlers — the package-owned HTTP surface.
 *
 * Bodies were moved verbatim from apps/otta-web/worker/routes/blog.ts; the only
 * changes are the injected seams in {@link BlogRouterConfig} (DB connect, admin
 * guard, cron auth, password verify, kitchensink content, default appId).
 */
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import {
    OttablogPlugin,
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
import type { BlogHandlers, BlogRequestContext, BlogRouterConfig } from './types';

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
const D1_IN_CHUNK = 100;

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
 * Batch enrichment for a page of posts — flat queries instead of ~5 per post.
 * Output per post is shape-identical to publicPostJson's enriched object
 * (privateNotes stripped, protected content stripped, tags[], categories[],
 * legacy categoryName/categorySlug, seriesTitle, author{}). Query count is
 * bounded: 6 flat queries per page (each id list chunked at 100 for D1's
 * bound-parameter limit), matching the RSS handler's whereIn batching pattern.
 */
async function enrichPostsJsonBatch(records: Post[]): Promise<Record<string, unknown>[]> {
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
    const authorById = new Map<string, { id: unknown; name: unknown; email: unknown; image: unknown }>();
    if (uniqueAuthorIds.length > 0) {
        try {
            const { User } = await import('@ottabase/ottaorm');
            const authors = await chunkedFetch(uniqueAuthorIds, (ids) =>
                User.whereIn('id', ids, { select: ['id', 'name', 'email', 'image'] }),
            );
            for (const author of authors) {
                authorById.set(author.get('id') as string, {
                    id: author.get('id'),
                    name: author.get('name'),
                    email: author.get('email'),
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

    return records.map((record) => {
        const j = record.toJson() as Record<string, unknown>;
        const { privateNotes, ...rest } = j;

        if (rest.isProtected) {
            rest.content = null;
            rest.footnotes = null;
        }

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

        return rest;
    });
}

/**
 * Convert a Post model to a public-safe JSON object.
 * Strips privateNotes. Strips content from protected posts unless explicitly included.
 * Optionally enriches with tags, category name, and author info.
 */
async function publicPostJson(
    record: Post,
    options?: {
        includeContent?: boolean;
        enrichTags?: boolean;
        enrichCategory?: boolean;
        enrichSeries?: boolean;
        enrichAuthor?: boolean;
    },
) {
    const j = record.toJson() as Record<string, unknown>;
    const { privateNotes, ...rest } = j;

    // Strip content from protected posts
    if (rest.isProtected && !options?.includeContent) {
        const { content, footnotes, ...restNoContent } = rest;
        Object.assign(rest, restNoContent);
        rest.content = null;
        rest.footnotes = null;
    }

    // Enrich with author info from User relationship
    if (options?.enrichAuthor && rest.authorId) {
        try {
            const author = await record.author(['id', 'name', 'email', 'image']);
            if (author) {
                rest.author = {
                    id: author.get('id'),
                    name: author.get('name'),
                    email: author.get('email'),
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
        return (
            context.url.searchParams.get('appId') ||
            context.request.headers.get('x-app-id') ||
            config.defaultAppId(context.env)
        );
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

    async function handleBlogPostsList(context: Ctx): Promise<Response> {
        const { env, url } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
        const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get('perPage') || '15', 10)));
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
        const organizationId = await resolveTenant(context);

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

        const searchTerm = search?.trim() || null;
        const searchFields = ['title', 'slug', 'excerpt'];

        let result;
        if (junctionIds !== null && junctionIds.length <= D1_FILTERED_ID_CHUNK) {
            // Junction filter pushed into SQL (array-where → inArray): paginate
            // and COUNT in the database instead of fetching the whole corpus.
            // The id list rides in the SAME statement as `where` (status,
            // contentType, appId, ...) plus pagination/search params, so the
            // smaller filtered-chunk threshold (not D1_IN_CHUNK) applies here.
            const idWhere = { ...where, id: junctionIds };
            result = searchTerm
                ? await Post.searchPaginate(searchTerm, searchFields, page, perPage, idWhere, {
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
            const needle = searchTerm?.toLowerCase() ?? null;
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
        } else if (searchTerm) {
            // Single data+COUNT round-trip instead of the previous double scan
            // (the second of which fetched every matching row just for .length).
            result = await Post.searchPaginate(searchTerm, searchFields, page, perPage, where, {
                orderBy,
                orderDirection,
            });
        } else {
            result = await Post.paginate(page, perPage, where, { orderBy, orderDirection });
        }

        // Enrich the page with tags, categories, series, and author — batched
        // flat queries (see enrichPostsJsonBatch) instead of ~5 queries per post.
        const data = await enrichPostsJsonBatch(result.data as Post[]);
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
        const record = preview ?? (await findPublishedPostBySlug(slug, appId, contentTypeParam, organizationId));

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
        const record = await findPublishedPostBySlug(slug, appId, contentTypeParam, organizationId);
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
        const limit = Math.min(10, Math.max(1, parseInt(url.searchParams.get('limit') || '4', 10)));

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
        const data = await enrichPostsJsonBatch(related);
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
        const contentType = url.searchParams.get('contentType') || null;
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '25', 10)));

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

        // Load author names from User model via authorId relationship
        // Collect unique authorIds and fetch users in one batch
        const authorIds = [
            ...new Set(posts.map((p) => p.get('authorId') as string | null).filter(Boolean)),
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

        const items = posts
            .map((post) => {
                const title = escapeXml((post.get('title') as string) || '');
                const slug = post.get('slug') as string;
                const excerpt = escapeXml((post.get('excerpt') as string) || '');
                // Get author name from User relationship (via authorId)
                const authorId = post.get('authorId') as string | null;
                const authorName = authorId ? escapeXml(authorMap.get(authorId) || '') : '';
                const publishedAt = post.get('publishedAt') as number | null;
                const pubDate = publishedAt ? new Date(publishedAt).toUTCString() : '';
                const heroImage = post.get('heroImage') as { url?: string } | null;

                return `    <item>
      <title>${title}</title>
      <link>${escapeXml(siteUrl)}/blog/${escapeXml(slug)}</link>
      <guid isPermaLink="true">${escapeXml(siteUrl)}/blog/${escapeXml(slug)}</guid>
      <description>${excerpt}</description>
      ${authorName ? `<dc:creator>${authorName}</dc:creator>` : ''}
      ${pubDate ? `<pubDate>${pubDate}</pubDate>` : ''}
      ${heroImage?.url ? `<enclosure url="${escapeXml(heroImage.url)}" type="image/jpeg" />` : ''}
    </item>`;
            })
            .join('\n');

        const lastBuildDate =
            posts.length > 0
                ? new Date((posts[0].get('publishedAt') as number) || Date.now()).toUTCString()
                : new Date().toUTCString();

        const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(siteUrl)}/blog</link>
    <description>${escapeXml(feedDescription)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(siteUrl)}/api/blog/rss" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

        return new Response(rss, {
            headers: {
                'Content-Type': 'application/rss+xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600',
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
        // Bounded at the sitemap protocol's own 50k-URL-per-file ceiling, not a
        // lower default: crawlers never pass ?limit=, so a smaller default would
        // silently drop older posts from a real deployment's sitemap the moment
        // it passed that default (the old endpoint was unbounded). Sitemap-index
        // pagination is the follow-up once a single deployment nears 50k posts.
        const limit = Math.min(50000, Math.max(1, parseInt(url.searchParams.get('limit') || '50000', 10)));
        const where: Record<string, unknown> = { status: 'published', contentType: { $ne: 'changelog' } };
        if (appId) where.appId = appId;
        if (organizationId !== undefined) where.organizationId = organizationId;

        const posts = await Post.where(where, {
            orderBy: 'publishedAt',
            orderDirection: 'desc',
            limit,
        });

        const siteUrl = `${url.protocol}//${url.host}`;

        const escapeXml = (str: string): string =>
            str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const urls = posts
            .map((post) => {
                const slug = post.get('slug') as string;
                const updatedAt = post.get('updatedAt') as number;
                const lastmod = updatedAt ? new Date(updatedAt).toISOString().split('T')[0] : '';
                return `  <url>
    <loc>${escapeXml(siteUrl)}/blog/${escapeXml(slug)}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
            })
            .join('\n');

        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
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
        const published = await Post.publishScheduled({ appId: appId ?? undefined });

        return jsonResponse({
            published: published.length,
            posts: published.map((p) => ({
                id: p.get('id'),
                title: p.get('title'),
                slug: p.get('slug'),
            })),
        });
    }

    async function handleBlogKitchensink(context: Ctx): Promise<Response> {
        const auth = await config.requireAdmin(context);
        if (auth instanceof Response) return auth;

        if (!config.kitchensinkContent) {
            return errorResponse('Kitchensink content not configured', 404, { code: 'NOT_FOUND' });
        }

        const { env } = context;
        const connectError = config.connect(env);
        if (connectError) return connectError;

        const KITCHENSINK_CONTENT = {
            ...config.kitchensinkContent,
            time: Date.now(),
        };

        const kitchensinkPublishedAt = new Date().toISOString();

        const currentUserId = auth.session?.user?.id ?? null;
        const currentOrganizationId = resolveOrgId(context.request, auth.session?.user?.organizationId ?? null);
        const currentAppId = resolveAppId(context);

        const existing = await Post.findBySlug('kitchensink-ottablog', { appId: currentAppId });
        if (existing) {
            existing.set('title', 'The Kitchensink of Ottablog');
            existing.set(
                'excerpt',
                'A demo post showcasing every block type available in OttaEditor — use this to test rendering, styling, and export.',
            );
            existing.set('content', KITCHENSINK_CONTENT);
            existing.set('contentType', 'blog');
            existing.set('status', 'published');
            existing.set('wordCount', 200);
            // Always reassign to the requesting user so they can edit/delete it and appear as author
            if (currentUserId) {
                existing.set('userId', currentUserId);
                existing.set('authorId', currentUserId);
            }
            existing.set('organizationId', currentOrganizationId);
            existing.set('appId', currentAppId);
            if (!existing.get('publishedAt')) {
                existing.set('publishedAt', kitchensinkPublishedAt);
            }

            await existing.save();

            return jsonResponse({ status: 'upserted', id: existing.get('id'), slug: existing.get('slug') });
        }

        let post;
        try {
            post = await Post.create({
                title: 'The Kitchensink of Ottablog',
                slug: 'kitchensink-ottablog',
                excerpt:
                    'A demo post showcasing every block type available in OttaEditor — use this to test rendering, styling, and export.',
                content: KITCHENSINK_CONTENT,
                contentType: 'blog',
                status: 'published',
                publishedAt: kitchensinkPublishedAt,
                wordCount: 200,
                userId: currentUserId,
                authorId: currentUserId,
                organizationId: currentOrganizationId,
                appId: currentAppId,
            });
        } catch (error) {
            // If a concurrent request created the same slug, upsert onto that row.
            const message = error instanceof Error ? error.message : String(error);
            const isUniqueViolation = /unique|constraint|duplicate/i.test(message);
            if (isUniqueViolation) {
                const concurrent = await Post.findBySlug('kitchensink-ottablog', { appId: currentAppId });
                if (concurrent) {
                    concurrent.set('title', 'The Kitchensink of Ottablog');
                    concurrent.set(
                        'excerpt',
                        'A demo post showcasing every block type available in OttaEditor — use this to test rendering, styling, and export.',
                    );
                    concurrent.set('content', KITCHENSINK_CONTENT);
                    concurrent.set('contentType', 'blog');
                    concurrent.set('status', 'published');
                    concurrent.set('wordCount', 200);
                    if (currentUserId) {
                        concurrent.set('userId', currentUserId);
                        concurrent.set('authorId', currentUserId);
                    }
                    concurrent.set('organizationId', currentOrganizationId);
                    concurrent.set('appId', currentAppId);
                    if (!concurrent.get('publishedAt')) {
                        concurrent.set('publishedAt', kitchensinkPublishedAt);
                    }

                    await concurrent.save();

                    return jsonResponse({
                        status: 'upserted',
                        id: concurrent.get('id'),
                        slug: concurrent.get('slug'),
                    });
                }
            }
            throw error;
        }

        return jsonResponse({ status: 'created', id: post.get('id'), slug: post.get('slug') });
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
        handleBlogStudioActivateTheme,
        handleBlogStudioPluginEnable,
        handleBlogStudioPluginConfig,
        handleBlogPostsList,
        handleBlogPostBySlug,
        handleBlogPostUnlock,
        handleBlogTagBySlug,
        handleBlogCategoryBySlug,
        handleBlogSeriesBySlug,
        handleBlogRelatedPosts,
        handleBlogRssFeed,
        handleBlogSitemap,
        handleBlogPublishScheduled,
        handleBlogKitchensink,
        handleBlogPreviewTokenMint,
        handleBlogStudioThemeTokens,
    };
}
