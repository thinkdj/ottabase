import { describe, expect, it } from 'vitest';
import { canonicalCard, cardFromParams, cardId, cardParams, httpUrl } from '../card';

const params = (query: Record<string, string>) => new URLSearchParams(query);
const error = (input: URLSearchParams) => {
    const parsed = cardFromParams(input);
    return 'error' in parsed ? parsed.error : null;
};

describe('cardFromParams', () => {
    it('reads the known fields, trims them, and ignores the rest', () => {
        const parsed = cardFromParams(params({ title: ' Hello ', eyebrow: 'Blog', sig: 'x', extra: 'y' }));
        expect('card' in parsed && parsed.card).toEqual({ title: 'Hello', eyebrow: 'Blog' });
    });

    it('refuses a missing title, an overlong field, a bad color, a bad URL and a bad theme', () => {
        expect(error(params({ subtitle: 'x' }))).toBe('title is required');
        expect(error(params({ title: 'x'.repeat(201) }))).toMatch(/longer than 200/);
        expect(error(params({ title: 'x', accent: 'red' }))).toBe('accent must be #rrggbb');
        expect(error(params({ title: 'x', logoUrl: 'javascript:alert(1)' }))).toMatch(/http\(s\) URL/);
        expect(error(params({ title: 'x', imageUrl: 'data:image/png;base64,AAAA' }))).toMatch(/URL/);
        expect(error(params({ title: 'x', theme: 'blue' }))).toBe('theme must be light or dark');
    });
});

describe('the canonical form', () => {
    it('orders fields the same way whatever the input order, and leaves empty ones out', () => {
        const a = canonicalCard({ subtitle: 'b', title: 'a', eyebrow: '' });
        const b = canonicalCard({ title: 'a', subtitle: 'b' });
        expect(a).toBe(b);
        expect(cardParams({ title: 'a&b', domain: 'x.test' }).toString()).toBe('title=a%26b&domain=x.test');
    });

    it('gives a card one id per template version', async () => {
        const one = await cardId({ title: 'a' }, 'v1');
        expect(one).toMatch(/^[0-9a-f]{64}$/);
        expect(await cardId({ title: 'a' }, 'v1')).toBe(one);
        expect(await cardId({ title: 'a' }, 'v2')).not.toBe(one);
        expect(await cardId({ title: 'b' }, 'v1')).not.toBe(one);
    });
});

describe('httpUrl', () => {
    it('keeps http(s) and encodes what would break markup', () => {
        expect(httpUrl('https://x.test/a b"<c>')).toBe('https://x.test/a%20b%22%3Cc%3E');
        expect(httpUrl('ftp://x.test/a')).toBeNull();
        expect(httpUrl('not a url')).toBeNull();
        expect(httpUrl(undefined)).toBeNull();
    });
});
