// ============================================================
// The real corpus, built from this repository: what goes in, what must never, and that a
// search over all of it stays quick.
// ============================================================

import { beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error a build script, plain JavaScript on purpose (it runs before anything is compiled)
import { buildCorpus } from '../scripts/build-corpus.mjs';
import { DOC_KINDS, type Corpus } from '../worker/corpus';
import { openIndex, search } from '../worker/search';

let corpus: Corpus;

beforeAll(async () => {
    corpus = (await buildCorpus()) as Corpus;
});

describe('the built corpus', () => {
    it('holds the start pages, the guides, every package README and the skills', () => {
        const ids = corpus.docs.map((doc) => doc.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const id of [
            'README.md',
            'QUICKSTART.md',
            'docs/TESTING.md',
            'packages/ottaorm/README.md',
            '.claude/skills/ottabase-crud/SKILL.md',
        ]) {
            expect(ids).toContain(id);
        }
        for (const kind of DOC_KINDS) expect(corpus.docs.some((doc) => doc.kind === kind)).toBe(true);
        expect(corpus.docs.filter((doc) => doc.kind === 'package').length).toBeGreaterThan(40);
        for (const doc of corpus.docs) {
            expect(doc.title).toBeTruthy();
            expect(doc.body).not.toContain('\r');
        }
    });

    it('reads only the public doc paths', () => {
        for (const { id } of corpus.docs) {
            expect(id).toMatch(
                /^(README\.md|QUICKSTART\.md|ARCHITECTURE\.md|AGENTS\.MD|docs\/[^/]+|packages\/[^/]+\/README\.md|\.claude\/skills\/[^/]+\/SKILL\.md)$/,
            );
        }
    });

    it('fits a Worker bundle and is searched in a few milliseconds', () => {
        const bytes = JSON.stringify(corpus).length;
        expect(bytes).toBeLessThan(4 * 1024 * 1024);

        const started0 = performance.now();
        const index = openIndex(corpus);
        const opening = performance.now() - started0;
        const ids = (query: string) => search(index, query).map((hit) => hit.id);
        expect(ids('fat model BaseModel relationships')).toContain('packages/ottaorm/README.md');
        expect(ids('how do I add row level security to a model')[0]).toBe('packages/ottaorm/README.md');
        expect(ids('upload files to R2')).toContain('.claude/skills/ottabase-upload/SKILL.md');
        // A short word stands alone: "pro" is not "provider".
        expect(['README.md', 'packages/cli/README.md', 'docs/PREMIUM_PACKAGES.md']).toContain(
            ids('what is Ottabase Pro')[0],
        );

        const started = performance.now();
        for (let i = 0; i < 20; i++) search(index, 'how do I add row level security to a model');
        const each = (performance.now() - started) / 20;
        // Generous: CI machines vary. A Worker's CPU limit is what this guards (10 ms on Workers Free).
        expect(each).toBeLessThan(10);
        expect(opening).toBeLessThan(50);
    });
});
