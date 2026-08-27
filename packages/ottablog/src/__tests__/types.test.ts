import { describe, expect, it } from 'vitest';
import {
    BLURB_MAX_LENGTH,
    calculateReadingTime,
    contentTypeLabel,
    createBlurbExcerpt,
    createBlurbTitle,
    createPhotoJournalExcerpt,
    createPhotoJournalTitle,
    crosspostLabel,
    extractExcerpt,
    formatDate,
    formatShortDate,
    generateSlug,
    MAX_JAVASCRIPT_DATE_TIMESTAMP,
    normalizeBlurbText,
    MAX_CROSSPOSTS,
    PHOTO_JOURNAL_MAX_ITEMS,
    validateCrossposts,
    validatePhotoJournalItems,
    validatePhotoJournalNote,
    validateBlurbText,
    validatePostWrite,
} from '../types';

describe('ottablog helpers', () => {
    describe('contentTypeLabel', () => {
        it('labels the known content types', () => {
            expect(contentTypeLabel('blurb')).toBe('Blurb');
            expect(contentTypeLabel('photo')).toBe('Photo Journal');
        });

        it('falls back to the raw value for a type this build does not know', () => {
            // content_type is a free-text column reachable through generic CRUD, so an unknown
            // value must degrade to a label rather than crash the list that renders it.
            expect(contentTypeLabel('recipe')).toBe('recipe');
            expect(contentTypeLabel('')).toBe('');
        });
    });

    describe('blurb helpers', () => {
        it('normalizes line endings while preserving intentional line breaks', () => {
            expect(normalizeBlurbText('  first\r\nsecond  ')).toBe('first\nsecond');
        });

        it('derives internal titles and plain-text excerpts', () => {
            expect(createBlurbTitle('A quick thought\nwith another line')).toBe('A quick thought');
            expect(createBlurbExcerpt('A quick\nthought')).toBe('A quick thought');
        });

        it('rejects empty and over-limit blurbs', () => {
            expect(() => validateBlurbText('   ')).toThrow('required');
            expect(() => validateBlurbText('x'.repeat(BLURB_MAX_LENGTH + 1))).toThrow('characters or fewer');
            expect(validateBlurbText('hello')).toBe('hello');
        });
    });

    describe('crossposts', () => {
        it('accepts bare strings, keeps order, and labels by host', () => {
            const items = validateCrossposts(['https://www.instagram.com/p/abc', { url: 'https://x.com/me/status/1' }]);
            expect(items).toEqual([{ url: 'https://www.instagram.com/p/abc' }, { url: 'https://x.com/me/status/1' }]);
            expect(crosspostLabel(items![0].url)).toBe('instagram.com');
            expect(crosspostLabel(items![1].url)).toBe('x.com');
        });

        it('drops blank rows and duplicates, and treats an empty result as no links', () => {
            expect(validateCrossposts([{ url: '  ' }, { url: 'https://x.com/a' }, { url: 'https://x.com/a' }])).toEqual(
                [{ url: 'https://x.com/a' }],
            );
            expect(validateCrossposts([{ url: '' }])).toBeNull();
            expect(validateCrossposts([])).toBeNull();
            expect(validateCrossposts(null)).toBeNull();
        });

        it('keeps at most one origin, so the post can never claim two first homes', () => {
            expect(validateCrossposts([{ url: 'https://x.com/a', origin: true }, { url: 'https://fb.com/b' }])).toEqual(
                [{ url: 'https://x.com/a', origin: true }, { url: 'https://fb.com/b' }],
            );
            expect(() =>
                validateCrossposts([
                    { url: 'https://x.com/a', origin: true },
                    { url: 'https://fb.com/b', origin: true },
                ]),
            ).toThrow('Only one link');
        });

        it('rejects anything that is not an absolute http(s) link', () => {
            expect(() => validateCrossposts([{ url: 'javascript:alert(1)' }])).toThrow('not a full http(s) link');
            expect(() => validateCrossposts([{ url: 'instagram.com/p/abc' }])).toThrow('not a full http(s) link');
            expect(() => validateCrossposts([{ url: '/blog/local' }])).toThrow('not a full http(s) link');
            expect(() => validateCrossposts('https://x.com/a')).toThrow('must be a list');
            expect(() =>
                validateCrossposts(Array.from({ length: MAX_CROSSPOSTS + 1 }, (_, i) => `https://x.com/${i}`)),
            ).toThrow(`Up to ${MAX_CROSSPOSTS}`);
        });

        it('returns an empty label rather than throwing for an unparseable URL', () => {
            expect(crosspostLabel('not a url')).toBe('');
        });
    });

    describe('photo journal helpers', () => {
        const photo = {
            id: 'p1',
            url: 'https://images.test/kyoto.jpg',
            caption: 'After the last train',
        };

        it('normalizes ordered photographs and preserves media metadata', () => {
            expect(
                validatePhotoJournalItems([
                    { ...photo, mediaId: 'm1', width: 1800, height: 1200, takenAt: 1_700_000_000_000 },
                ]),
            ).toEqual([
                expect.objectContaining({
                    id: 'p1',
                    mediaId: 'm1',
                    url: photo.url,
                    width: 1800,
                    height: 1200,
                    takenAt: 1_700_000_000_000,
                }),
            ]);
        });

        it('rejects the same photograph however it repeats', () => {
            // Any of the three is enough to break rendering: `id` keys the tile AND the lightbox
            // registration, so a repeat shows one frame that cannot be opened.
            expect(() =>
                validatePhotoJournalItems([
                    { id: 'p1', mediaId: 'm1', url: 'https://images.test/a.jpg', caption: 'first' },
                    { id: 'p1', url: 'https://images.test/b.jpg', caption: 'same id' },
                ]),
            ).toThrow('duplicates');
            expect(() =>
                validatePhotoJournalItems([
                    { id: 'p1', mediaId: 'm1', url: 'https://images.test/a.jpg' },
                    { id: 'p3', mediaId: 'm1', url: 'https://images.test/c.jpg' },
                ]),
            ).toThrow('duplicates');
            expect(() =>
                validatePhotoJournalItems([
                    { id: 'p1', url: 'https://images.test/a.jpg' },
                    { id: 'p4', url: 'https://images.test/a.jpg' },
                ]),
            ).toThrow('duplicates');
        });

        it('keeps photograph identity namespaces separate', () => {
            const album = validatePhotoJournalItems([
                { id: 'asset-b', mediaId: 'asset-a', url: 'https://images.test/a.jpg' },
                { id: 'local-b', mediaId: 'asset-b', url: 'https://images.test/b.jpg' },
                { id: 'https://images.test/b.jpg', mediaId: 'asset-c', url: 'https://images.test/c.jpg' },
            ]);

            expect(album).toHaveLength(3);
        });

        it('rejects dates that JavaScript cannot render', () => {
            expect(() =>
                validatePhotoJournalItems([
                    { id: 'p1', url: 'https://images.test/a.jpg', takenAt: MAX_JAVASCRIPT_DATE_TIMESTAMP + 1 },
                ]),
            ).toThrow('invalid date');
            expect(() => validatePostWrite({ publishAt: 1e20 })).toThrow('valid positive date');
        });

        it('counts the payload against the album cap before validating identities', () => {
            // The cap bounds what a caller may SEND, even when the payload is malformed or
            // contains repeated identities.
            const url = 'https://images.test/one.jpg';
            expect(() =>
                validatePhotoJournalItems(Array.from({ length: PHOTO_JOURNAL_MAX_ITEMS + 1 }, () => ({ url }))),
            ).toThrow(`up to ${PHOTO_JOURNAL_MAX_ITEMS}`);
        });

        it('derives a graceful title and excerpt when prose is sparse', () => {
            expect(createPhotoJournalTitle('', photo, Date.UTC(2026, 0, 2))).toBe('After the last train');
            expect(createPhotoJournalExcerpt(null, [photo])).toBe('After the last train');
            expect(validatePhotoJournalNote('  Rain and blue hour.  ')).toBe('Rain and blue hour.');
        });

        it('rejects empty, oversized, unsafe, and protocol-relative albums', () => {
            expect(() => validatePhotoJournalItems([])).toThrow('at least one');
            expect(() =>
                validatePhotoJournalItems(
                    Array.from({ length: PHOTO_JOURNAL_MAX_ITEMS + 1 }, (_, index) => ({
                        id: `p${index}`,
                        url: `https://images.test/${index}.jpg`,
                    })),
                ),
            ).toThrow('up to');
            expect(() => validatePhotoJournalItems([{ id: 'p1', url: 'javascript:alert(1)' }])).toThrow('HTTP(S)');
            expect(() => validatePhotoJournalItems([{ id: 'p1', url: '//cdn.example.test/image.jpg' }])).toThrow(
                'HTTP(S)',
            );
            expect(() =>
                validatePhotoJournalItems([{ id: 'p1', url: `https://images.test/${'x'.repeat(4096)}.jpg` }]),
            ).toThrow('4096');
            expect(() =>
                validatePhotoJournalItems(
                    Array.from({ length: PHOTO_JOURNAL_MAX_ITEMS }, (_, index) => ({
                        id: `p${index}`,
                        url: `https://images.test/${'u'.repeat(4050)}${index}`,
                        thumbnailUrl: `https://images.test/${'t'.repeat(4050)}${index}`,
                        previewUrl: `https://images.test/${'p'.repeat(4050)}${index}`,
                    })),
                ),
            ).toThrow('metadata');
        });
    });

    describe('generateSlug', () => {
        it('creates a lowercase, hyphenated slug', () => {
            expect(generateSlug(' Hello, World! ')).toBe('hello-world');
        });

        it('collapses whitespace and strips punctuation', () => {
            expect(generateSlug('Multiple   spaces -- and symbols!!!')).toBe('multiple-spaces-and-symbols');
        });
    });

    describe('calculateReadingTime', () => {
        it('counts words across supported blocks', () => {
            const content = {
                blocks: [
                    { type: 'header', data: { text: 'Hello world' } },
                    { type: 'paragraph', data: { text: 'This is a short paragraph.' } },
                    { type: 'list', data: { items: ['First item', 'Second item'] } },
                    { type: 'quote', data: { text: 'Quoted text here' } },
                ],
            };

            const result = calculateReadingTime(content);
            expect(result.words).toBeGreaterThan(0);
            expect(result.minutes).toBe(1);
        });

        it('rounds up minutes for long content', () => {
            const words = Array.from({ length: 400 }, () => 'word').join(' ');
            const content = {
                blocks: [{ type: 'paragraph', data: { text: words } }],
            };

            const result = calculateReadingTime(content);
            expect(result.words).toBe(400);
            expect(result.minutes).toBe(2);
        });
    });

    describe('extractExcerpt', () => {
        it('strips HTML and truncates at word boundary', () => {
            const content = {
                blocks: [
                    {
                        type: 'paragraph',
                        data: { text: 'Hello <b>world</b> this is a test' },
                    },
                ],
            };

            expect(extractExcerpt(content, 10)).toBe('Hello...');
        });

        it('returns full text when under max length', () => {
            const content = {
                blocks: [{ type: 'paragraph', data: { text: 'Short excerpt' } }],
            };

            expect(extractExcerpt(content, 160)).toBe('Short excerpt');
        });
    });

    describe('formatDate', () => {
        it('formats a Date object with default options', () => {
            const date = new Date('2024-01-15T10:30:00Z');
            const formatted = formatDate(date);
            expect(formatted).toMatch(/January 15, 2024/);
        });

        it('formats a date string', () => {
            const dateString = '2024-01-15T10:30:00Z';
            const formatted = formatDate(dateString);
            expect(formatted).toMatch(/January 15, 2024/);
        });

        it('returns em dash for null date', () => {
            expect(formatDate(null)).toBe('—');
        });

        it('accepts custom format options', () => {
            const date = new Date('2024-01-15T10:30:00Z');
            const formatted = formatDate(date, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
            expect(formatted).toMatch(/Jan 15, 2024/);
        });
    });

    describe('validatePostWrite', () => {
        const album = [{ id: 'p1', url: 'https://images.test/kyoto.jpg' }];

        it('touches only the columns present in the write', () => {
            // A PATCH of one column must not be read as "clear everything else". This is the rule
            // that lets the model run the validator on EVERY write without inventing values.
            const write = validatePostWrite({ viewCount: 5 });
            expect(write).toEqual({ viewCount: 5 });
            expect('photoAlbum' in write).toBe(false);
            expect('content' in write).toBe(false);
        });

        it('normalizes what it accepts', () => {
            const write = validatePostWrite({
                contentType: 'photo',
                photoAlbum: [{ id: 'p1', url: '  https://images.test/kyoto.jpg  ' }],
                photoNote: '  Rain and blue hour.  ',
                crossposts: ['https://www.instagram.com/p/abc'],
            });

            expect(write.photoAlbum[0].url).toBe('https://images.test/kyoto.jpg');
            expect(write.photoNote).toBe('Rain and blue hour.');
            expect(write.crossposts).toEqual([{ url: 'https://www.instagram.com/p/abc' }]);
        });

        it('rejects an unsafe photograph URL wherever the write came from', () => {
            expect(() =>
                validatePostWrite({ contentType: 'photo', photoAlbum: [{ url: 'javascript:alert(1)' }] }),
            ).toThrow('HTTP(S)');
        });

        it('rejects unknown content types and publication statuses', () => {
            expect(() => validatePostWrite({ contentType: 'recipe' })).toThrow('supported content type');
            expect(() => validatePostWrite({ status: 'live' })).toThrow('supported publication status');
        });

        it('stores an empty album as null and refuses to call it a photo journal', () => {
            expect(validatePostWrite({ photoAlbum: [] }).photoAlbum).toBeNull();
            expect(() => validatePostWrite({ contentType: 'photo', photoAlbum: [] })).toThrow(
                'needs at least one photograph',
            );
            // The renderer dispatches on contentType alone, so this would be a journal with no frames.
            expect(() => validatePostWrite({ contentType: 'photo' })).toThrow('needs at least one photograph');
        });

        it('refuses payloads that contradict their own content type', () => {
            expect(() => validatePostWrite({ contentType: 'blog', photoAlbum: album })).toThrow('cannot carry');
            expect(() => validatePostWrite({ contentType: 'blog', photoNote: 'stray note' })).toThrow('cannot carry');
            expect(() => validatePostWrite({ contentType: 'photo', photoAlbum: album, blurbText: 'stray' })).toThrow(
                'cannot carry blurb text',
            );
            expect(() => validatePostWrite({ contentType: 'blurb' })).toThrow('Blurb text is required');
        });

        it('passes a coherent write of each content type through unchanged in shape', () => {
            expect(validatePostWrite({ contentType: 'blurb', blurbText: 'A thought' }).blurbText).toBe('A thought');
            expect(validatePostWrite({ contentType: 'photo', photoAlbum: album }).photoAlbum).toHaveLength(1);
            expect(
                validatePostWrite({ contentType: 'blog', content: { blocks: [] }, photoAlbum: null }).content,
            ).toEqual({ blocks: [] });
        });
    });

    describe('formatShortDate', () => {
        it('formats a date with short month', () => {
            const date = new Date('2024-01-15T10:30:00Z');
            const formatted = formatShortDate(date);
            expect(formatted).toMatch(/Jan 15, 2024/);
        });

        it('returns em dash for null date', () => {
            expect(formatShortDate(null)).toBe('—');
        });

        it('formats a date string with short month', () => {
            const dateString = '2024-12-25T00:00:00Z';
            const formatted = formatShortDate(dateString);
            expect(formatted).toMatch(/Dec 25, 2024/);
        });
    });
});
