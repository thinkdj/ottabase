// Field focus is one shared rule that must out-rank the fields' own utilities and read the theme's focus colour.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../..');
const css = readFileSync(resolve(root, 'styles/ui.css'), 'utf8');

describe('field focus', () => {
    it('lives in the utilities layer, where border-input / shadow-xs cannot override it', () => {
        const rule = css.slice(css.indexOf('@layer utilities'));
        expect(rule).toContain("[data-slot='input']");
        expect(rule).toContain("[data-slot='input-group']:has(");
        expect(rule).toContain('var(--focus-ring-color, hsl(var(--ring)))');
    });

    it('leaves no per-component ring recipe on the fields', () => {
        const dir = resolve(root, 'components/ui');
        for (const file of ['input', 'textarea', 'native-select', 'select', 'input-group', 'input-otp', 'calendar']) {
            const src = readFileSync(resolve(dir, `${file}.tsx`), 'utf8');
            expect(src, file).not.toMatch(/ring-ring\/|ring-\[3px\]/);
        }
    });

    it('falls back to brand colours for native controls and selection, not the browser blue', () => {
        expect(css).toContain('accent-color: var(--accent-color, hsl(var(--primary)))');
        expect(css).not.toMatch(/Highlight\)|HighlightText/);
    });
});
