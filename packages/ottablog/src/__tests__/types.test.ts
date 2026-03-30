import { describe, expect, it } from 'vitest';
import {
    BLOG_FEED_CONTENT_TYPES,
    CONTENT_TYPES,
    calculateReadingTime,
    extractExcerpt,
    formatDate,
    formatShortDate,
    generateSlug,
} from '../types';
import type { ContentType } from '../types';

describe('ottablog helpers', () => {
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

    describe('CONTENT_TYPES', () => {
        it('includes all 6 content types', () => {
            const keys = Object.keys(CONTENT_TYPES);
            expect(keys).toEqual(['blog', 'changelog', 'docs', 'news', 'announcement', 'page']);
        });

        it('page content type has correct metadata', () => {
            expect(CONTENT_TYPES.page).toEqual({
                label: 'Page',
                description: 'Static/marketing page managed via CMS',
            });
        });

        it('every ContentType key has label and description', () => {
            for (const [, meta] of Object.entries(CONTENT_TYPES)) {
                expect(meta).toHaveProperty('label');
                expect(meta).toHaveProperty('description');
                expect(typeof meta.label).toBe('string');
                expect(typeof meta.description).toBe('string');
            }
        });
    });

    describe('BLOG_FEED_CONTENT_TYPES', () => {
        it('includes blog, docs, news, announcement', () => {
            expect(BLOG_FEED_CONTENT_TYPES).toEqual(['blog', 'docs', 'news', 'announcement']);
        });

        it('excludes changelog and page', () => {
            expect(BLOG_FEED_CONTENT_TYPES).not.toContain('changelog');
            expect(BLOG_FEED_CONTENT_TYPES).not.toContain('page');
        });

        it('is a subset of CONTENT_TYPES keys', () => {
            const allTypes = Object.keys(CONTENT_TYPES);
            for (const type of BLOG_FEED_CONTENT_TYPES) {
                expect(allTypes).toContain(type);
            }
        });
    });
});
