import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = (name: string) => readFileSync(join(__dirname, '..', name), 'utf8');

describe('reader stylesheet', () => {
    it('loads with the theme and reaches every core block', () => {
        expect(css('editorjs-brandkit-theme.css')).toContain("@import './editorjs-reader.css';");
        const reader = css('editorjs-reader.css');
        for (const selector of [
            '.ce-paragraph',
            'h2.ce-header',
            '.cdx-nested-list__item',
            '.cdx-checklist',
            '.cdx-quote__text',
            '.cdx-warning',
            '.ce-delimiter::before',
            '.cdx-marker',
            '.inline-code',
            '.ce-block__content',
        ]) {
            expect(reader, selector).toContain(selector);
        }
        // Colours come from the tokens the renderer uses, never from fixed values
        expect(reader).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    });
});
