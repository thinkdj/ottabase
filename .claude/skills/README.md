# Ottabase agent skills

Opinionated, repo-specific skills that describe **the Ottabase way** to accomplish a task — the conventions and common
failure modes — so an AI agent working in this repo does not invent an alternate architecture (Ottabase design principle
#26).

Each skill is a directory with a `SKILL.md` (YAML frontmatter `name` + `description`, then the body). They are
intentionally short: when-to-use → the Ottabase-specific steps → gotchas → pointers to the authoritative docs
(`AGENTS.MD`, `docs/`, package READMEs, and the generated `/llms-full.txt`). They encode _conventions_, not a full API
dump — the API lives in the docs they link to.

## Available

All 14 skills from design principle #26 are authored.

| Skill                   | Covers                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `ottabase-create-model` | Add an OttaORM fat model + all the registration steps (schema, schemas-helper, db-utils, migrations)      |
| `ottabase-crud`         | Generic CRUD: OttaORM route + `createModelHooks` + `ModelCrud`/`createModelConfig`                        |
| `ottabase-form`         | Model-driven forms (`createModelConfig` → `ModelForm`) + custom forms via ui-shadcn primitives            |
| `ottabase-rbac`         | Permission checks + RLS security-context provenance + fail-closed rules + making changes take effect live |
| `ottabase-upload`       | File uploads over R2: client hook + server handler + the ownership/tenant rule                            |
| `ottabase-email`        | Provider-agnostic mailer (`resolveAppMailer` + `sendTemplatedEmail`) + template registry                  |
| `ottabase-queue`        | Background jobs on Cloudflare Queues: dispatch + registry + handler                                       |
| `ottabase-cron`         | Scheduled tasks: one-tick-per-minute Cron Trigger + DB-driven scheduler                                   |
| `ottabase-theme`        | Brand Engine: design tokens → CSS vars, brand kits, per-route/subtree overrides, dark mode                |
| `ottabase-component`    | First-class UI component: CVA variants + `data-slot` parts + tokens + brand override registry             |
| `ottabase-package`      | New workspace package: persistence split, headless/rendered entrypoints, wiring into the four CI gates    |
| `ottabase-migration`    | Auto-migrations from Models + custom migrations (seed/index/view); what auto can't do                     |
| `ottabase-testing`      | Vitest conventions, per-package `--filter`, rebuild-before-test, CF-binding mocks                         |
| `ottabase-cloudflare`   | Edge-runtime rules, bindings + parity, `getOttabaseConfig`, multi-tenant cache keys                       |

## Keeping them honest

These describe code that changes. A skill that names a file, flag, or API is a claim to verify against current code
before acting on it — especially anything in the "Gotchas" sections. When a convention changes, update the skill in the
same PR.
