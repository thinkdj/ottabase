import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { ChangelogEntry } from '../../ottabase/models/ChangelogEntry';

export interface ChangelogRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

function ensureD1(env: CloudflareEnv): Response | null {
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }
    return null;
}

/**
 * Public-safe JSON — whitelist only fields needed by the public UI.
 * Listing omits full body unless ?includeContent=1.
 */
function publicChangelogJson(record: ChangelogEntry, options?: { includeContent?: boolean }): Record<string, unknown> {
    const j = record.toJson() as Record<string, unknown>;

    const safe: Record<string, unknown> = {
        id: j.id,
        slug: j.slug,
        title: j.title,
        summary: j.summary,
        heroMedia: j.heroMedia,
        status: j.status,
        highlight: j.highlight,
        autoplayMedia: j.autoplayMedia,
        showAuthor: j.showAuthor,
        authorId: j.authorId,
        authorName: j.authorName,
        authorAvatar: j.authorAvatar,
        readingTimeMinutes: j.readingTimeMinutes,
        wordCount: j.wordCount,
        // Convert epoch-ms timestamps to ISO 8601 strings for SEO / HTML <time> compatibility
        publishedAt: typeof j.publishedAt === 'number' ? new Date(j.publishedAt).toISOString() : j.publishedAt,
        createdAt: typeof j.createdAt === 'number' ? new Date(j.createdAt).toISOString() : j.createdAt,
        updatedAt: typeof j.updatedAt === 'number' ? new Date(j.updatedAt).toISOString() : j.updatedAt,
        content: options?.includeContent ? (j.content ?? null) : null,
    };

    return safe;
}

/**
 * GET /api/changelog/entries
 */
export async function handleChangelogEntriesList(context: ChangelogRouteContext): Promise<Response> {
    const { env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const perPage = Math.min(50, Math.max(1, parseInt(url.searchParams.get('perPage') || '15', 10)));
    const appId = url.searchParams.get('appId');
    const includeContent = url.searchParams.get('includeContent') === '1';

    const where: Record<string, unknown> = { status: 'published' };
    if (appId !== null && appId !== '') {
        where.appId = appId;
    }
    // Filter by highlighted entries only
    const highlightOnly = url.searchParams.get('highlight') === '1';
    if (highlightOnly) {
        where.highlight = true;
    }

    const result = await ChangelogEntry.paginate(page, perPage, where, {
        orderBy: 'publishedAt',
        orderDirection: 'desc',
    });

    const data = await Promise.all(
        result.data.map((r) => publicChangelogJson(r as ChangelogEntry, { includeContent })),
    );

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
 * GET /api/changelog/entries/by-slug/:slug
 */
export async function handleChangelogEntryBySlug(context: ChangelogRouteContext, slug: string): Promise<Response> {
    const { env, url } = context;
    const d1Error = ensureD1(env);
    if (d1Error) return d1Error;
    registerConnection('default', createD1Driver(env.OBCF_D1));

    const appIdParam = url.searchParams.get('appId');
    const appId = appIdParam === null || appIdParam === '' ? null : appIdParam;

    const record = await ChangelogEntry.findPublishedBySlug(slug, appId);
    if (!record) {
        return errorResponse('Changelog entry not found', 404, { code: 'NOT_FOUND' });
    }

    return jsonResponse(publicChangelogJson(record, { includeContent: true }));
}
