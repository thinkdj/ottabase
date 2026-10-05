import { describe, expect, it } from 'vitest';
import { adjacentMonths, dateTitle, feedEndpoint, parseDateScope } from '../blogFeedScope';

describe('feedEndpoint', () => {
    it('asks for the first page of everything by default', () => {
        expect(feedEndpoint({ kind: 'all' }, {})).toBe('/api/blog/posts?page=1&perPage=12');
    });

    it('carries the search, a known type, the page and the language', () => {
        expect(feedEndpoint({ kind: 'all' }, { q: 'edge', type: 'photo', page: 3, lang: 'fr' })).toBe(
            '/api/blog/posts?page=3&perPage=12&contentType=photo&search=edge&lang=fr',
        );
        expect(feedEndpoint({ kind: 'all' }, { type: 'junk' })).toBe('/api/blog/posts?page=1&perPage=12');
    });

    it('waits for the entity behind a tag, category, series or author', () => {
        expect(feedEndpoint({ kind: 'tag', slug: 'travel' }, {})).toBeNull();
        expect(feedEndpoint({ kind: 'tag', slug: 'travel' }, {}, 't1')).toBe(
            '/api/blog/posts?page=1&perPage=12&tagId=t1',
        );
        expect(feedEndpoint({ kind: 'category', slug: 'notes' }, {}, 'c1')).toContain('categoryId=c1');
        expect(feedEndpoint({ kind: 'author', id: 'u1' }, {}, 'u1')).toContain('authorId=u1');
    });

    it('lists a series in order on one page', () => {
        expect(feedEndpoint({ kind: 'series', slug: 'edge' }, {}, 's1')).toBe(
            '/api/blog/posts?page=1&perPage=50&seriesId=s1&orderBy=seriesOrder&orderDirection=asc',
        );
    });

    it('filters a year or a month', () => {
        expect(feedEndpoint({ kind: 'date', year: 2026 }, {})).toBe('/api/blog/posts?page=1&perPage=12&year=2026');
        expect(feedEndpoint({ kind: 'date', year: 2026, month: 8 }, { page: 2 })).toBe(
            '/api/blog/posts?page=2&perPage=12&year=2026&month=8',
        );
    });
});

describe('parseDateScope', () => {
    it('reads a year and an optional month', () => {
        expect(parseDateScope({ year: '2026' })).toEqual({ kind: 'date', year: 2026 });
        expect(parseDateScope({ year: '2026', month: '8' })).toEqual({ kind: 'date', year: 2026, month: 8 });
    });

    it('rejects what is not a date', () => {
        expect(parseDateScope({ year: 'abc' })).toBeNull();
        expect(parseDateScope({ year: '1800' })).toBeNull();
        expect(parseDateScope({ year: '2026', month: '13' })).toBeNull();
        expect(parseDateScope({ year: '2026', month: '' })).toBeNull();
    });
});

describe('dateTitle and adjacentMonths', () => {
    const now = new Date(Date.UTC(2026, 9, 5));

    it('names the month or the year', () => {
        expect(dateTitle(2026, 8)).toBe('August 2026');
        expect(dateTitle(2026)).toBe('2026');
    });

    it('crosses year ends and stops at the present', () => {
        expect(adjacentMonths(2026, 1, now)).toEqual({
            prev: { year: '2025', month: '12' },
            next: { year: '2026', month: '2' },
        });
        expect(adjacentMonths(2025, 12, now).next).toEqual({ year: '2026', month: '1' });
        expect(adjacentMonths(2026, 10, now).next).toBeNull();
        expect(adjacentMonths(2026, 9, now).next).toEqual({ year: '2026', month: '10' });
        expect(adjacentMonths(1970, 1, now).prev).toBeNull();
    });
});
