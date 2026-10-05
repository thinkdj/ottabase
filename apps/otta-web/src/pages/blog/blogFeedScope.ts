/**
 * What a feed page is about: every post, or the posts behind one tag, category, series, author or month.
 * The helpers are pure so the feed and its tests share them; the one hook resolves the scope's entity.
 */
import { CONTENT_TYPES, type ContentType } from '@ottabase/ottablog';
import { useApiQuery } from '@ottabase/ottaorm/client';
import type { BlogFeedSearch } from './blogLinks';

export type FeedScope =
    | { kind: 'all' }
    | { kind: 'tag' | 'category' | 'series'; slug: string }
    | { kind: 'author'; id: string }
    | { kind: 'date'; year: number; month?: number };

export type ScopeKind = FeedScope['kind'];

/** The tag, category, series or author a scoped feed is about, in one shape */
export interface ScopeEntity {
    id: string;
    name: string;
    description: string | null;
    status: string | null;
    image: string | null;
}

export const PER_PAGE = 12;
/** A series is read in order, so every part sits on one page */
const SERIES_PER_PAGE = 50;

export const SCOPE_LABELS: Record<Exclude<ScopeKind, 'all'>, string> = {
    tag: 'Tag',
    category: 'Category',
    series: 'Series',
    author: 'Author',
    date: 'Archive',
};

/** Query entity (for cache invalidation) and endpoint prefix of each scope that is a thing */
const ENTITY_ROUTES = {
    tag: ['post_tags', '/api/blog/tags/by-slug/'],
    category: ['categories', '/api/blog/categories/by-slug/'],
    series: ['post_series', '/api/blog/series/by-slug/'],
    author: ['blog_authors', '/api/blog/authors/'],
} as const;

const FILTER_PARAMS = { tag: 'tagId', category: 'categoryId', series: 'seriesId', author: 'authorId' } as const;

export const isContentType = (value: unknown): value is ContentType =>
    typeof value === 'string' && value in CONTENT_TYPES;

interface RawEntity {
    id: string;
    name?: string | null;
    title?: string | null;
    description?: string | null;
    status?: string | null;
    image?: string | null;
}

/** Resolves the tag, category, series or author behind a scope. The plain feed and dates have none. */
export function useScopeEntity(scope: FeedScope) {
    const route = scope.kind === 'all' || scope.kind === 'date' ? null : ENTITY_ROUTES[scope.kind];
    const key = 'slug' in scope ? scope.slug : scope.kind === 'author' ? scope.id : '';
    const endpoint = route ? `${route[1]}${encodeURIComponent(key)}` : '';
    const query = useApiQuery<RawEntity, ScopeEntity>({
        entity: route?.[0],
        queryKey: ['feed-scope', endpoint],
        endpoint,
        select: (raw) => ({
            id: raw.id,
            name: raw.title || raw.name || 'Anonymous',
            description: raw.description ?? null,
            status: raw.status ?? null,
            image: raw.image ?? null,
        }),
        queryOptions: { enabled: !!endpoint, staleTime: 60_000, meta: { errorPresentation: 'silent' } },
    });
    if (!route) return { entity: undefined, loading: false, missing: false };
    return { entity: query.data, loading: query.isPending, missing: !query.isPending && !query.data?.id };
}

/** The list request for a scope and URL state. Null until a scoped feed knows its entity. */
export function feedEndpoint(scope: FeedScope, search: BlogFeedSearch, entityId?: string): string | null {
    const params = new URLSearchParams({
        page: String(search.page ?? 1),
        perPage: String(scope.kind === 'series' ? SERIES_PER_PAGE : PER_PAGE),
    });
    switch (scope.kind) {
        case 'all':
            break;
        case 'date':
            params.set('year', String(scope.year));
            if (scope.month) params.set('month', String(scope.month));
            break;
        default:
            if (!entityId) return null;
            params.set(FILTER_PARAMS[scope.kind], entityId);
            if (scope.kind === 'series') {
                params.set('orderBy', 'seriesOrder');
                params.set('orderDirection', 'asc');
            }
    }
    if (isContentType(search.type)) params.set('contentType', search.type);
    if (search.q) params.set('search', search.q);
    if (search.lang) params.set('lang', search.lang);
    return `/api/blog/posts?${params}`;
}

const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

/** `/blog/archive/$year/$month` params as a scope; null when they are not a date */
export function parseDateScope(params: { year?: string; month?: string }): FeedScope | null {
    const year = Number(params.year);
    if (!Number.isInteger(year) || year < 1970 || year > 2100) return null;
    if (params.month === undefined) return { kind: 'date', year };
    const month = Number(params.month);
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;
    return { kind: 'date', year, month };
}

export const dateTitle = (year: number, month?: number) => (month ? `${MONTHS[month - 1]} ${year}` : String(year));

/** Route params of the months either side, as far back as the archive goes and never into the future */
export function adjacentMonths(year: number, month: number, now = new Date()) {
    const params = (y: number, m: number) => ({ year: String(y), month: String(m) });
    const prev = month === 1 ? params(year - 1, 12) : params(year, month - 1);
    const [nextYear, nextMonth] = month === 12 ? [year + 1, 1] : [year, month + 1];
    const future =
        nextYear > now.getUTCFullYear() || (nextYear === now.getUTCFullYear() && nextMonth > now.getUTCMonth() + 1);
    return {
        prev: year === 1970 && month === 1 ? null : prev,
        next: future ? null : params(nextYear, nextMonth),
    };
}
