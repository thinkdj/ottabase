import {
    collectDocumentText,
    ensureFtsTable,
    mergeHybridResults,
    OTTASEARCH_FTS_TABLE,
    parseJsonStringArray,
} from '../search';

describe('ottasearch helpers', () => {
    it('collects text from primitive and structured fields', () => {
        const text = collectDocumentText(
            {
                title: 'Hello',
                tags: ['one', 'two'],
                meta: { status: 'published' },
            },
            ['title', 'tags', 'meta'],
        );

        expect(text).toContain('Hello');
        expect(text).toContain('one');
        expect(text).toContain('published');
    });

    it('parses JSON string arrays safely', () => {
        expect(parseJsonStringArray('["a","b"]')).toEqual(['a', 'b']);
        expect(parseJsonStringArray('not-json')).toEqual([]);
    });

    it('merges fts and semantic scores by document id', () => {
        const merged = mergeHybridResults(
            [{ id: 'a', entityName: 'posts', recordId: '1', title: 'A', content: 'A', keywords: [], score: 0.5 }],
            [{ id: 'a', entityName: 'posts', recordId: '1', title: 'A', content: 'A', keywords: [], score: 0.4 }],
        );

        expect(merged).toHaveLength(1);
        expect(merged[0].score).toBeGreaterThan(1);
    });

    it('creates fts table using expected SQL', async () => {
        const run = vi.fn(async () => ({}));
        const prepare = vi.fn(() => ({ run }));

        await ensureFtsTable({ prepare } as any);

        expect(prepare).toHaveBeenCalledWith(
            expect.stringContaining(`CREATE VIRTUAL TABLE IF NOT EXISTS ${OTTASEARCH_FTS_TABLE}`),
        );
    });
});
