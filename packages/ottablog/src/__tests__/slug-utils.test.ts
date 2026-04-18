import { describe, expect, it } from 'vitest';
import { normalizeSlugInput } from '../slug-utils';

describe('slug-utils', () => {
    describe('normalizeSlugInput', () => {
        it('should generate slug from a valid string', () => {
            expect(normalizeSlugInput('Hello World', 'fallback', 'tag')).toBe('hello-world');
        });

        it('should use fallback when value is empty', () => {
            expect(normalizeSlugInput('', 'My Fallback', 'tag')).toBe('my-fallback');
        });

        it('should use fallback when value is null/undefined', () => {
            expect(normalizeSlugInput(null, 'fallback-name', 'cat')).toBe('fallback-name');
            expect(normalizeSlugInput(undefined, 'fallback-name', 'cat')).toBe('fallback-name');
        });

        it('should use prefix + UUID when both value and fallback are empty', () => {
            const result = normalizeSlugInput('', '', 'series');
            expect(result).toMatch(/^series-[a-f0-9]{8}$/);
        });

        it('should handle special characters', () => {
            expect(normalizeSlugInput('Hello!@#$World', 'fb', 'tag')).toBe('helloworld');
        });

        it('should coerce non-string values', () => {
            expect(normalizeSlugInput(42, 'fb', 'tag')).toBe('42');
        });

        it('should trim and normalize whitespace', () => {
            expect(normalizeSlugInput('  multiple   spaces  ', 'fb', 'tag')).toBe('multiple-spaces');
        });
    });
});
