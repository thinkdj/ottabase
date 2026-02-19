import { describe, expect, it } from 'vitest';
import { calculateReadingTime, extractExcerpt, generateSlug, formatDate, formatShortDate } from '../types';

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
});
