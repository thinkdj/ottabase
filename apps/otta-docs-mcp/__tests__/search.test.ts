import { describe, expect, it } from 'vitest';
import { splitSections, wordsOf } from '../scripts/indexer';
import { openIndex, queryTerms, resolveDoc, search, textOf } from '../worker/search';
import { corpus } from './fixture';

const index = openIndex(corpus);

describe('sections', () => {
    it('cut a page at its headings, never inside a code fence', () => {
        const testing = corpus.docs.find((doc) => doc.id === 'docs/TESTING.md')!;
        const rows = splitSections(testing.body, testing.title);
        expect(rows.map(([, , heading, level]) => [heading, level])).toEqual([
            ['Testing', 1],
            ['Vitest', 2],
            ['Coverage', 2],
        ]);
        // Offsets are trimmed: a section starts at its heading and ends at its last character.
        expect(testing.body.slice(rows[1]![0], rows[1]![1])).toMatch(/^## Vitest[\s\S]*```$/);
        expect(textOf(index.sectionsOf.get(testing.id)![2]!)).toBe('## Coverage\n\nCoverage uses v8.');
        expect(wordsOf('Fat-Model ORM, v2: a_b x')).toEqual(['fat', 'model', 'orm', 'v2', 'a_b']);
    });
});

describe('search', () => {
    it('drops filler words and keeps what names the page', () => {
        expect(queryTerms('How do I use row level security in Ottabase?')).toEqual(['row', 'level', 'security']);
        // A query of nothing but filler still searches.
        expect(queryTerms('how to use it')).toEqual(['how', 'to', 'use', 'it']);
        expect(queryTerms('   ')).toEqual([]);
    });

    it('finds the section that holds every word, with its page, heading and an excerpt', () => {
        const [first] = search(index, 'row level security');
        expect(first).toMatchObject({
            id: 'packages/ottaorm/README.md',
            kind: 'package',
            heading: 'Row level security',
        });
        expect(first!.excerpt).toContain('scopes every query to the tenant');
    });

    it('ranks a word in the title above the same word in passing, filters by kind, and bounds the list', () => {
        expect(search(index, 'queue retry')[0]!.id).toBe('packages/queue/README.md');
        expect(search(index, 'crud', { kind: 'skill' }).map((hit) => hit.id)).toEqual([
            '.claude/skills/ottabase-crud/SKILL.md',
        ]);
        expect(search(index, 'crud', { kind: 'guide' })).toEqual([]);
        expect(search(index, 'the', { limit: 99 }).length).toBeLessThanOrEqual(10);
        // At most two sections of one page.
        const ids = search(index, 'ottaorm', { limit: 10 }).map((hit) => hit.id);
        expect(ids.filter((id) => id === 'packages/ottaorm/README.md').length).toBeLessThanOrEqual(2);
    });

    it('returns nothing for words no page has', () => {
        expect(search(index, 'kubernetes helm chart')).toEqual([]);
    });
});

describe('resolveDoc', () => {
    it('takes the id, and the forms an agent tends to try instead', () => {
        const orm = 'packages/ottaorm/README.md';
        for (const id of [
            orm,
            'ottaorm',
            '@ottabase/ottaorm',
            'PACKAGES/OTTAORM/readme.md',
            './packages/ottaorm/README.md',
        ]) {
            expect(resolveDoc(index, id)?.id).toBe(orm);
        }
        expect(resolveDoc(index, 'ottabase-crud')?.id).toBe('.claude/skills/ottabase-crud/SKILL.md');
        expect(resolveDoc(index, 'testing')?.id).toBe('docs/TESTING.md');
        expect(resolveDoc(index, 'quickstart')?.id).toBe('QUICKSTART.md');
        expect(resolveDoc(index, 'nope')).toBeNull();
    });
});
