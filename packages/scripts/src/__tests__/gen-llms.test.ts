import { describe, expect, it } from 'vitest';
import {
    buildLlmsFull,
    buildLlmsTxt,
    extractSummary,
    extractTitle,
    stripNonProse,
    type DocSection,
} from '../cli/gen-llms';

describe('stripNonProse', () => {
    it('removes YAML frontmatter and HTML comments', () => {
        const md = '---\ntitle: x\n---\n<!-- hidden -->\n# Real';
        const out = stripNonProse(md);
        expect(out).not.toContain('title: x');
        expect(out).not.toContain('hidden');
        expect(out).toContain('# Real');
    });
});

describe('extractTitle', () => {
    it('uses the first H1', () => {
        expect(extractTitle('# @ottabase/queue\n\nbody', 'fallback')).toBe('@ottabase/queue');
    });
    it('falls back when there is no heading', () => {
        expect(extractTitle('just text, no heading', 'my-pkg')).toBe('my-pkg');
    });
});

describe('extractSummary', () => {
    it('skips badges/headings and returns the first real paragraph', () => {
        const md = '# Title\n\n![badge](x.svg)\n\nA fat-model ORM for Cloudflare D1.';
        expect(extractSummary(md)).toBe('A fat-model ORM for Cloudflare D1.');
    });
    it('reads a blockquote summary and strips the marker', () => {
        expect(extractSummary('# Title\n\n> One-line docs viewer.')).toBe('One-line docs viewer.');
    });
    it('ignores fenced code blocks', () => {
        const md = '# Title\n\n```ts\nconst x = 1;\n```\n\nThe actual summary.';
        expect(extractSummary(md)).toBe('The actual summary.');
    });
    it('clamps very long lines at a word boundary with an ellipsis', () => {
        const long = `# T\n\n${'word '.repeat(80).trim()}`;
        const out = extractSummary(long);
        expect(out.length).toBeLessThanOrEqual(201);
        expect(out.endsWith('…')).toBe(true);
    });
});

const SECTIONS: DocSection[] = [
    {
        heading: 'Start here',
        entries: [{ rel: 'README.md', title: 'Ottabase', summary: 'The readme.', body: '# Ottabase\n\nThe readme.' }],
    },
    {
        heading: 'Packages',
        entries: [
            {
                rel: 'packages/queue/README.md',
                title: '@ottabase/queue',
                summary: 'Job queue.',
                body: '# @ottabase/queue\n\nJob queue.',
            },
        ],
    },
    { heading: 'Empty', entries: [] },
];

describe('buildLlmsTxt', () => {
    const out = buildLlmsTxt({ title: 'Ottabase', summary: 'Summary line.', sections: SECTIONS });
    it('starts with the H1 and summary blockquote', () => {
        expect(out.startsWith('# Ottabase\n\n> Summary line.')).toBe(true);
    });
    it('renders linked entries with descriptions', () => {
        expect(out).toContain('## Start here');
        expect(out).toContain('- [@ottabase/queue](packages/queue/README.md): Job queue.');
    });
    it('omits empty sections', () => {
        expect(out).not.toContain('## Empty');
    });
});

describe('buildLlmsFull', () => {
    it('inlines each doc body under a path header with separators', () => {
        const out = buildLlmsFull({ title: 'Ottabase', summary: 'Summary line.', sections: SECTIONS });
        expect(out).toContain('# packages/queue/README.md');
        expect(out).toContain('Job queue.');
        expect(out).toContain('---');
    });
});
