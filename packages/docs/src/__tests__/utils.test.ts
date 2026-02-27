import { describe, expect, it } from 'vitest';
import {
    extractTitle,
    extractToc,
    fileNameToSlug,
    slugToTitle,
    organizePages,
    findPageBySlug,
    buildPageSlug,
} from '../utils';
import type { DocsSource } from '../types';

describe('extractTitle', () => {
    it('extracts h1 from markdown', () => {
        expect(extractTitle('# Hello World\nSome content')).toBe('Hello World');
    });

    it('returns Untitled for content without h1', () => {
        expect(extractTitle('Some content without heading')).toBe('Untitled');
    });

    it('handles BOM at start of file', () => {
        expect(extractTitle('\uFEFF# My Title\nContent')).toBe('My Title');
    });

    it('extracts first h1 only', () => {
        expect(extractTitle('# First\n## Second\n# Third')).toBe('First');
    });
});

describe('fileNameToSlug', () => {
    it('converts filename to slug', () => {
        expect(fileNameToSlug('API_PAGINATION.md')).toBe('api-pagination');
    });

    it('converts README to index', () => {
        expect(fileNameToSlug('README.md')).toBe('index');
    });

    it('handles mdx extension', () => {
        expect(fileNameToSlug('getting-started.mdx')).toBe('getting-started');
    });
});

describe('slugToTitle', () => {
    it('converts slug to title case', () => {
        expect(slugToTitle('api-pagination')).toBe('Api Pagination');
    });

    it('converts index to Overview', () => {
        expect(slugToTitle('index')).toBe('Overview');
    });
});

describe('extractToc', () => {
    it('extracts h2-h4 headings', () => {
        const content = '# Title\n## Section 1\n### Sub 1\n## Section 2';
        const toc = extractToc(content);
        expect(toc).toHaveLength(3);
        expect(toc[0]).toEqual({ id: 'section-1', text: 'Section 1', level: 2 });
        expect(toc[1]).toEqual({ id: 'sub-1', text: 'Sub 1', level: 3 });
        expect(toc[2]).toEqual({ id: 'section-2', text: 'Section 2', level: 2 });
    });

    it('skips headings inside code blocks', () => {
        const content = '## Real Heading\n```\n## Code Heading\n```\n## Another Real';
        const toc = extractToc(content);
        expect(toc).toHaveLength(2);
    });

    it('deduplicates heading IDs', () => {
        const content = '## Setup\n## Usage\n## Setup';
        const toc = extractToc(content);
        expect(toc[0].id).toBe('setup');
        expect(toc[2].id).toBe('setup-1');
    });
});

describe('organizePages', () => {
    it('groups and sorts pages', () => {
        const sources: DocsSource[] = [
            { label: 'Guides', order: 0, pages: [{ slug: 'intro', title: 'Intro', content: '' }] },
            { label: 'API', order: 1, pages: [{ slug: 'endpoints', title: 'Endpoints', content: '' }] },
        ];
        const groups = organizePages(sources);
        expect(groups).toHaveLength(2);
        expect(groups[0].label).toBe('Guides');
        expect(groups[1].label).toBe('API');
    });
});

describe('findPageBySlug', () => {
    const sources: DocsSource[] = [
        { label: 'Guides', basePath: 'guides', pages: [{ slug: 'intro', title: 'Intro', content: 'test' }] },
        { label: 'Packages', basePath: 'packages', pages: [{ slug: 'utils', title: 'Utils', content: 'test' }] },
    ];

    it('finds page with basePath', () => {
        const page = findPageBySlug(sources, 'guides/intro');
        expect(page?.title).toBe('Intro');
    });

    it('finds page by slug only', () => {
        const page = findPageBySlug(sources, 'utils');
        expect(page?.title).toBe('Utils');
    });

    it('returns undefined for unknown slug', () => {
        expect(findPageBySlug(sources, 'nonexistent')).toBeUndefined();
    });
});

describe('buildPageSlug', () => {
    it('prepends basePath', () => {
        const source: DocsSource = { label: 'Guides', basePath: 'guides', pages: [] };
        expect(buildPageSlug(source, { slug: 'intro', title: 'Intro', content: '' })).toBe('guides/intro');
    });

    it('returns slug without basePath', () => {
        const source: DocsSource = { label: 'Guides', pages: [] };
        expect(buildPageSlug(source, { slug: 'intro', title: 'Intro', content: '' })).toBe('intro');
    });
});
