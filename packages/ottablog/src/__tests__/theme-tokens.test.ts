import { describe, expect, it } from 'vitest';
import { blogThemeTokensToCss } from '../theme-tokens';

describe('blogThemeTokensToCss', () => {
    it('serializes light and dark blocks under the blog room selector', () => {
        const css = blogThemeTokensToCss({
            light: { '--primary': '265 89% 66%', '--radius': '0.25rem' },
            dark: { '--primary': '265 89% 76%' },
        });

        expect(css).toContain('[data-brand-scope="blog"] {');
        expect(css).toContain('--primary: 265 89% 66%;');
        expect(css).toContain('--radius: 0.25rem;');
        expect(css).toContain('.dark [data-brand-scope="blog"] {');
        expect(css).toContain('--primary: 265 89% 76%;');
    });

    it('returns empty string for null, undefined, or empty tokens (fallback-chain law)', () => {
        expect(blogThemeTokensToCss(null)).toBe('');
        expect(blogThemeTokensToCss(undefined)).toBe('');
        expect(blogThemeTokensToCss({})).toBe('');
        expect(blogThemeTokensToCss({ light: {} })).toBe('');
    });

    it('skips invalid custom-property names', () => {
        const css = blogThemeTokensToCss({
            light: {
                primary: 'red', // no -- prefix
                '--ok': 'blue',
                '--bad name': 'green', // space
                '--inject}': 'x', // brace in name
            },
        });
        expect(css).toContain('--ok: blue;');
        expect(css).not.toContain('primary: red');
        expect(css).not.toContain('green');
    });

    it('rejects values that could break out of the declaration or style tag', () => {
        const css = blogThemeTokensToCss({
            light: {
                '--evil-close': 'red } body { background: hotpink',
                '--evil-tag': 'x</style><script>alert(1)</script>',
                '--evil-comment': 'red /* sneak */',
                '--evil-semicolon': 'red; --injected: 1',
                '--fine': 'color-mix(in oklch, red 40%, blue)',
            },
        });
        expect(css).not.toContain('hotpink');
        expect(css).not.toContain('script');
        expect(css).not.toContain('sneak');
        expect(css).not.toContain('--injected');
        expect(css).toContain('--fine: color-mix(in oklch, red 40%, blue);');
    });

    it('honors custom scope and dark selector, rejecting unsafe scope names', () => {
        const css = blogThemeTokensToCss(
            { light: { '--x': '1' }, dark: { '--x': '2' } },
            { scope: 'docs', darkSelector: '[data-theme="dark"]' },
        );
        expect(css).toContain('[data-brand-scope="docs"] {');
        expect(css).toContain('[data-theme="dark"] [data-brand-scope="docs"] {');

        expect(blogThemeTokensToCss({ light: { '--x': '1' } }, { scope: 'a"b]' })).toBe('');
    });
});
