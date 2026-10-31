import { afterEach, describe, expect, it } from 'vitest';
import {
    configureMedia,
    fileIdFromKey,
    fileUrl,
    imageSources,
    isStoredFile,
    mediaBase,
    storedFileOf,
    variantKey,
} from '../media';

const ID = '0123456789abcdef0123456789abcdef';
const KEY = `otta-web/media/${ID}.jpg`;

afterEach(() => configureMedia({}));

describe('media', () => {
    it('defaults to the fallback route and trims a configured base', () => {
        expect(mediaBase()).toBe('/api/files/public');
        configureMedia({ publicUrl: 'https://files.example.com//' });
        expect(mediaBase()).toBe('https://files.example.com');
    });

    it('derives rendition keys and ids from the original key', () => {
        expect(variantKey(KEY, 'card')).toBe(`otta-web/media/${ID}/card.webp`);
        expect(fileIdFromKey(KEY)).toBe(ID);
        expect(fileIdFromKey(variantKey(KEY, 'thumb'))).toBe(ID);
        expect(fileIdFromKey('otta-web/media/not-an-id.jpg')).toBeNull();
    });

    it('accepts only well-formed stored files', () => {
        expect(isStoredFile({ key: KEY, width: 2000, height: 1000, variants: ['thumb', 'card', 'full'] })).toBe(true);
        expect(isStoredFile({ key: KEY })).toBe(true);
        expect(isStoredFile({ key: `https://evil.example/${ID}.jpg` })).toBe(false);
        expect(isStoredFile({ key: `../media/${ID}.jpg` })).toBe(false);
        expect(isStoredFile({ key: KEY, width: '2000' })).toBe(false);
        expect(isStoredFile({ key: KEY, variants: ['huge'] })).toBe(false);
        expect(isStoredFile('https://example.com/a.jpg')).toBe(false);
    });

    it('turns a public record into a stored file and refuses a private one', () => {
        const record = {
            storageKey: KEY,
            audience: 'public',
            width: 2000,
            height: 1000,
            variants: { full: {}, thumb: {} },
        };
        expect(storedFileOf(record)).toEqual({ key: KEY, width: 2000, height: 1000, variants: ['thumb', 'full'] });
        expect(storedFileOf({ ...record, audience: 'members' })).toBeNull();
        expect(storedFileOf({ storageKey: KEY, width: null, height: null, variants: null })).toEqual({ key: KEY });
    });

    it('builds URLs at render time from the configured base', () => {
        const file = { key: KEY, variants: ['thumb' as const] };
        expect(fileUrl(file)).toBe(`/api/files/public/${KEY}`);
        configureMedia({ publicUrl: 'https://files.example.com' });
        expect(fileUrl(file, 'thumb')).toBe(`https://files.example.com/otta-web/media/${ID}/thumb.webp`);
        // A rendition that was not made falls back to the original.
        expect(fileUrl(file, 'card')).toBe(`https://files.example.com/${KEY}`);
        expect(fileUrl('https://cdn.example.com/a.png', 'thumb')).toBe('https://cdn.example.com/a.png');
        expect(fileUrl(null)).toBe('');
    });

    it('offers renditions up to full, and the original only when no full was made', () => {
        const base = `/api/files/public/otta-web/media/${ID}`;
        expect(imageSources({ key: KEY, width: 2000, height: 1000, variants: ['thumb', 'card', 'full'] })).toEqual({
            src: `${base}/full.webp`,
            srcSet: `${base}/thumb.webp 160w, ${base}/card.webp 640w, ${base}/full.webp 1600w`,
            width: 2000,
            height: 1000,
        });
        expect(imageSources({ key: KEY, width: 1000, height: 500, variants: ['thumb', 'card'] })).toEqual({
            src: `/api/files/public/${KEY}`,
            srcSet: `${base}/thumb.webp 160w, ${base}/card.webp 640w, /api/files/public/${KEY} 1000w`,
            width: 1000,
            height: 500,
        });
        expect(imageSources({ key: KEY, width: 120 })).toEqual({ src: `/api/files/public/${KEY}`, width: 120 });
        expect(imageSources('https://cdn.example.com/a.png')).toEqual({ src: 'https://cdn.example.com/a.png' });
        expect(imageSources(undefined)).toEqual({ src: '' });
    });
});

describe('safeImageProps', () => {
    it('validates and sanitizes before it builds attributes', async () => {
        const { safeImageProps } = await import('../sanitize');
        const stored = { key: KEY, width: 2000, height: 1000, variants: ['thumb' as const, 'full' as const] };
        expect(safeImageProps(stored, '24rem')).toMatchObject({ sizes: '24rem', width: 2000, height: 1000 });
        expect(safeImageProps(stored, '24rem')?.srcSet).toContain('160w');
        expect(safeImageProps({ key: KEY }, '24rem')).toEqual({ src: `/api/files/public/${KEY}`, sizes: undefined });
        expect(safeImageProps(' https://cdn.example.com/a.png', '24rem')).toEqual({
            src: 'https://cdn.example.com/a.png',
        });
        expect(safeImageProps('javascript:alert(1)', '24rem')).toBeNull();
        expect(safeImageProps({ key: 'https://evil.example/a.png' }, '24rem')).toBeNull();
        expect(safeImageProps('', '24rem')).toBeNull();
    });
});
