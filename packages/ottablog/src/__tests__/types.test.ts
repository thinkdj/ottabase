import { describe, expect, it } from 'vitest';
import { calculateReadingTime, extractExcerpt, generateSlug } from '../types';

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
});
