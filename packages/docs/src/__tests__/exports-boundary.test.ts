import { describe, expect, it } from 'vitest';
import * as barrel from '../index';
import * as reactEntry from '../react';

// Guardrails for the UI-decoupling boundary: the `.` barrel must stay UI-free,
// and every rendered component must be reachable only via the `./react` subpath.
const RENDERED = ['DocsLayout', 'DocsSidebar', 'MarkdownRenderer', 'TableOfContents'] as const;
const PURE = [
    'buildPageSlug',
    'extractTitle',
    'extractToc',
    'fileNameToSlug',
    'findPageBySlug',
    'organizePages',
    'slugToTitle',
    'useDocs',
] as const;

describe('exports boundary', () => {
    it('root barrel does not re-export any rendered React component', () => {
        for (const name of RENDERED) {
            expect(barrel).not.toHaveProperty(name);
        }
    });

    it('root barrel keeps the pure helpers and the useDocs hook', () => {
        for (const name of PURE) {
            expect(typeof (barrel as Record<string, unknown>)[name]).toBe('function');
        }
    });

    it('react entry exposes the rendered components', () => {
        for (const name of RENDERED) {
            const component = (reactEntry as Record<string, unknown>)[name];
            // A React component may be a plain function or an object (React.memo/forwardRef wrapper).
            expect(component).toBeDefined();
            expect(['function', 'object']).toContain(typeof component);
        }
    });
});
