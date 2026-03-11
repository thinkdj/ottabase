# @ottabase/ottasearch

In-house app search package combining Cloudflare D1 FTS (keyword) with optional Vectorize semantic ranking.

## What it provides

- `searchableModelsTable` — admin-managed model indexing configuration
- `searchDocumentsTable` — denormalized search index rows
- `ensureFtsTable(...)` — creates D1 FTS5 virtual table used for full-text search
- `collectDocumentText(...)` and `mergeHybridResults(...)` — helpers for indexing + hybrid ranking

## App wiring (TanStack template)

1. Register tables in `ottabase/ottabase.config.ts` under `customPackages`.
2. Add package tables to `ottabase/db/schema.ts` exports.
3. Add custom API route handlers (example: `/api/ottasearch/*`) in worker router.
4. Use admin UI to select searchable models and run reindex.

## Pending setup expectations

The admin page should report pending setup when:

- FTS table has not yet been initialized (`/api/ottasearch/reindex` not run)
- no searchable models are enabled
- `OBCF_VECTORIZE` binding is not present (semantic search fallback remains keyword-only)

## License

MIT
