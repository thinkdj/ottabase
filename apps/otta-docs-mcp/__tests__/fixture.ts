import { indexDocs } from '../scripts/indexer';
import type { Corpus, CorpusDoc } from '../worker/corpus';

/** A small corpus with one page of each kind, one of them long enough to be cut. */
const docs: CorpusDoc[] = [
    {
        id: 'QUICKSTART.md',
        kind: 'start',
        title: 'Quickstart',
        summary: 'Clone, install, run.',
        body: '# Quickstart\n\nClone the repo and run `pnpm dev`.\n\n## Requirements\n\nNode 24 and pnpm 10.',
    },
    {
        id: 'docs/TESTING.md',
        kind: 'guide',
        title: 'Testing',
        summary: 'How tests are written and run.',
        body: '# Testing\n\nEvery package has a `test` script.\n\n## Vitest\n\nTests run on Vitest.\n\n```bash\n# not a heading\npnpm test --filter @ottabase/ottaorm\n```\n\n## Coverage\n\nCoverage uses v8.',
    },
    {
        id: 'packages/ottaorm/README.md',
        kind: 'package',
        title: '@ottabase/ottaorm',
        summary: 'Fat model ORM over D1.',
        body: [
            '# @ottabase/ottaorm',
            '',
            'A fat model ORM over Cloudflare D1.',
            '',
            '## Row level security',
            '',
            'Row level security scopes every query to the tenant. Call `initRLS()` once at startup.',
            '',
            '## Relationships',
            '',
            'belongsTo, hasMany, hasOne and belongsToMany.',
            '',
            '### Eager loading',
            '',
            'Load a relationship with the record: `with("author")`.',
            '',
            '## Reference',
            '',
            'x'.repeat(20_000),
        ].join('\n'),
    },
    {
        id: 'packages/queue/README.md',
        kind: 'package',
        title: '@ottabase/queue',
        summary: 'Job queue for Cloudflare Queues.',
        body: '# @ottabase/queue\n\nDispatch jobs with retry and backoff.\n\n## Retry\n\nA failed job is retried with exponential backoff.',
    },
    {
        id: '.claude/skills/ottabase-crud/SKILL.md',
        kind: 'skill',
        title: 'CRUD the Ottabase way (skill: ottabase-crud)',
        summary: 'The Ottabase way to build CRUD for an entity.',
        body: '# CRUD the Ottabase way\n\nA fat model drives a generic route, generated hooks and a drop-in UI.',
    },
];

export const corpus: Corpus = {
    generatedAt: '2026-11-10T08:00:00.000Z',
    revision: 'abc1234',
    docs,
    ...indexDocs(docs),
};
