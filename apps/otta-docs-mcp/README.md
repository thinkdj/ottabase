# otta-docs-mcp

The Ottabase documentation as a remote [Model Context Protocol](https://modelcontextprotocol.io) server. An assistant
connected to it (Claude, Claude Code, Cursor, anything that speaks MCP) can search and read the framework's docs while
it helps someone build.

It is Ottabase's own server, at `https://mcp.ottabase.com/mcp`. An app built on Ottabase does not need this Worker; it
is in the repository because the docs are, and as a small worked example of a stateless MCP server on Workers.

- **Read-only, no auth.** Three tools, each annotated `readOnlyHint`. No account, no key, no state.
- **Same docs as `llms.txt`.** The corpus is built from the pages `pnpm docs:llms` indexes (the start-here pages,
  `docs/`, every package README) plus the agent skills in `.claude/skills`, so the two never list different docs.
- **Cheap.** The word index is built at build time and bundled, so a request reads postings and never scans text: about
  a millisecond of CPU a search (measured in Node), against the 10 ms the Workers Free plan allows.

## Connect

| Client           | How                                                                              |
| ---------------- | -------------------------------------------------------------------------------- |
| Claude           | Customize → Connectors → add a custom connector → `https://mcp.ottabase.com/mcp` |
| Claude Code      | `claude mcp add --transport http ottabase-docs https://mcp.ottabase.com/mcp`     |
| Any other client | A remote server at that URL, HTTP transport                                      |

Then ask something the docs answer: "How do I add row level security to a model in Ottabase?"

## Tools

| Tool          | Arguments                  | Returns                                                                               |
| ------------- | -------------------------- | ------------------------------------------------------------------------------------- |
| `search_docs` | `query`, `kind?`, `limit?` | The best-matching sections: document id, heading, an excerpt, a source link           |
| `get_doc`     | `id`, `section?`           | One page as Markdown. A long page returns an outline; ask for one section by heading  |
| `list_docs`   | `kind?`                    | Every page by group, with ids and titles; one group with summaries when `kind` is set |

A document id is the page's path in the repository (`packages/ottaorm/README.md`). `get_doc` also takes a package name
(`ottaorm`), a skill name or a file name. `kind` is `start`, `guide`, `package` or `skill`.

A wrong argument is answered with what to try next: the sections a page has, the pages closest to a mistyped id. Those
are ordinary results, not `isError`: the assistant reads them and carries on, and the connector directory counts an
`isError` result as a failed call in a listing's health.

## Routes

| Path      | What                                                                                |
| --------- | ----------------------------------------------------------------------------------- |
| `/mcp`    | The server. Streamable HTTP, the 2026-07-28 revision and stateless 2025-era clients |
| `/`       | A page for people: what this is, how to connect, the tools, privacy                 |
| `/health` | `{ ok, docs, generatedAt, revision }`                                               |

## How it is built

```text
scripts/build-corpus.mjs   reads the docs, cuts them into sections, indexes the words
        ↓ worker/corpus.generated.json (git-ignored, about 2 MB)
worker/index.ts            bundles it; worker/app.ts routes; worker/server.ts registers the tools
worker/search.ts           scores sections from the postings
```

`build-corpus.mjs` reads only the paths it names (the ones above). Nothing is globbed from elsewhere, so a private or
git-ignored file in a checkout cannot reach the public server; a test asserts the id of every page.

Search is keyword matching: rarer words count more, a word in the heading or the page title counts extra, sections that
hold every word win, and the exact phrase is a bonus. A word of up to three letters must stand alone (`pro` is not
`provider`); a longer one also matches inside others (`upload` in `ottaupload`, `queue` in `queues`).

The protocol is the official SDK's (`@modelcontextprotocol/server`, `createMcpHandler`): a fresh server per request, no
session, no Durable Object.

## Develop

```bash
pnpm --filter @ottabase/otta-docs-mcp dev        # builds the corpus, then wrangler dev on http://127.0.0.1:8790
pnpm --filter @ottabase/otta-docs-mcp run smoke  # the official client against the running server, every tool once
pnpm --filter @ottabase/otta-docs-mcp test       # the client against the Worker's fetch handler, in process
```

`@ottabase/scripts` must be built (`pnpm build:pkg`): the corpus reuses its `gen-llms` collectors.

The tests cover the tool list the connector directory reviews (titles, annotations, name length), every tool's answers
and refusals, a 2025-era client, the real corpus (what goes in, what must not, search time) and the other routes.

## Deploy

```bash
pnpm --filter @ottabase/otta-docs-mcp run deploy                             # corpus, then wrangler deploy --env production
pnpm --filter @ottabase/otta-docs-mcp run smoke https://mcp.ottabase.com/mcp
```

`wrangler.jsonc` routes `env.production` to the custom domain `mcp.ottabase.com`. `cloudflare-config.json` has
`deployable: false`, so CI never deploys it and a fork never tries to claim that domain. Redeploy after the docs change:
the corpus is a snapshot taken at build time, and `/health` says which commit it was read at.

## Decisions

- **No rate limit.** A call is an in-memory lookup, and all of Claude's traffic arrives from one address range, so a
  per-address limit would throttle every Claude user together. Add a Cloudflare WAF rate rule on the zone if needed.
- **No Origin or Host check, open CORS.** The docs are public and nothing can be written. A strict Origin check rejects
  Claude's own requests.
- **Nothing is logged from a request body.** A tool argument is the user's words. Cloudflare's request logs hold the
  time, path and status.
