import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { ChangelogEntry } from '../../ottabase/models/ChangelogEntry';
import type { CloudflareEnv } from '../../cloudflare-env';

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
 * Public-safe JSON. Listing omits full body unless ?includeContent=1 (for previews).
 */
function publicChangelogJson(
    record: ChangelogEntry,
    options?: { includeContent?: boolean },
): Record<string, unknown> {
    const j = record.toJson() as Record<string, unknown>;
    if (!options?.includeContent && j.content) {
        const { content, ...rest } = j;
        return { ...rest, content: null };
    }
    return j;
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
