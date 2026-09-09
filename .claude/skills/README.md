# Ottabase agent skills

Opinionated, repo-specific skills that describe **the Ottabase way** to accomplish a task — the conventions and common
failure modes — so an AI agent working in this repo does not invent an alternate architecture (Ottabase design principle
#26).

Each skill is a directory with a `SKILL.md` (YAML frontmatter `name` + `description`, then the body). They are
intentionally short: when-to-use → the Ottabase-specific steps → gotchas → pointers to the authoritative docs
(`AGENTS.MD`, `docs/`, package READMEs, and the generated `/llms-full.txt`). They encode _conventions_, not a full API
dump — the API lives in the docs they link to.

## Available

| Skill                   | Covers                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `ottabase-create-model` | Add an OttaORM fat model + all the registration steps (schema, schemas-helper, db-utils, migrations)      |
| `ottabase-crud`         | Generic CRUD: OttaORM route + `createModelHooks` + `ModelCrud`/`createModelConfig`                        |
| `ottabase-rbac`         | Permission checks + RLS security-context provenance + fail-closed rules + making changes take effect live |
| `ottabase-package`      | New workspace package: persistence split, headless/rendered entrypoints, wiring into the four CI gates    |
| `ottabase-queue`        | Background jobs on Cloudflare Queues: dispatch + registry + handler                                       |
| `ottabase-upload`       | File uploads over R2: client hook + server handler + the ownership/tenant rule                            |

## Planned (principle #26, not yet authored)

`ottabase-form`, `ottabase-email`, `ottabase-theme` (Brand Engine / tokens), `ottabase-component`, `ottabase-migration`,
`ottabase-testing`, `ottabase-cron`, `ottabase-cloudflare`. Add them the same way: ground every step in `AGENTS.MD` or a
package README; keep them short; link rather than duplicate.

## Keeping them honest

These describe code that changes. A skill that names a file, flag, or API is a claim to verify against current code
before acting on it — especially anything in the "Gotchas" sections. When a convention changes, update the skill in the
same PR.
