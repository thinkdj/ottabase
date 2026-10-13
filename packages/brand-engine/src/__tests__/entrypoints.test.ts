import { describe, expect, it } from 'vitest';
import * as root from '..';
import * as dom from '../dom';

// Workers import the root to build critical CSS server-side, so it must carry no DOM writers.
describe('entrypoint boundary', () => {
    const domWriters = ['applyBrandTheme', 'injectFont', 'upsertStyleElement'];

    it('keeps DOM writers off the root', () => {
        for (const name of domWriters) expect(root).not.toHaveProperty(name);
        // The pure builders the edge relies on stay on the root.
        expect(root).toHaveProperty('buildBrandStylesheet');
        expect(root).toHaveProperty('buildCSSVarMap');
    });

    it('exposes them from /dom', () => {
        for (const name of domWriters) expect(dom).toHaveProperty(name);
    });
});
