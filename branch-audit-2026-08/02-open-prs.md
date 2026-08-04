# Open Pull Requests — verdicts

There are **29 open PRs**. None of their branches should be deleted while the PR is open. Each is classed as:

- **PORT** — net-new feature to bring into `main` (details in [`01-port-candidates.md`](./01-port-candidates.md)).
- **REVIEW/CLOSE** — the base feature already exists in `main` (the PR predates the July rewrite); verify no small
  un-merged delta, then close the PR and delete the branch.
- **DEP** — Dependabot bump.

Most PRs are **draft** and predate the mid-July `main` rewrite, so even where they carry real work, they must be
**re-based / re-opened against current `main`** rather than merged as-is (unrelated histories).

---

## A. Dependabot (2) — DEP

| PR | Branch | Verdict |
|----|--------|---------|
| #221 | `dependabot/npm_and_yarn/testing-library/jest-dom-7.0.0` | Merge if desired or let Dependabot re-roll. Safe to close/delete. |
| #220 | `dependabot/npm_and_yarn/hookform/resolvers-5.5.7` | Same. |

## B. Net-new feature PRs (8) — PORT / EVALUATE

See [`01-port-candidates.md`](./01-port-candidates.md) for full write-ups.

| PR | Branch | Feature | Verdict |
|----|--------|---------|---------|
| #132 | `copilot/add-admin-ui-for-db-backups` | `@ottabase/backups` | **PORT (HIGH)** — rebase onto main. |
| #135 | `copilot/add-data-import-export-package` | `@ottabase/ottaport` | **PORT (HIGH)** — rebase onto main. |
| #143 | `copilot/add-gdpr-data-export-delete-workflow` | GDPR export/delete | **CONSIDER (MED)**. |
| #119 | `copilot/replicate-youch-error-handling` | `@ottabase/error-page` | **CONSIDER (MED)**. |
| #133 | `copilot/implement-ottabase-search` | `@ottabase/ottasearch` | **EVALUATE** vs `spotlight`. |
| #114 | `copilot/add-animation-framework` | `@ottabase/motion` | **OPTIONAL**. |
| #97 | `copilot/add-admin-area-for-workers` | Tail Workers console | **OPTIONAL**. |
| #101 | `copilot/add-open-source-framework-support` | create-app CLI / distribution | **OPTIONAL** — reconcile with `packages/cli`. |

## C. Enhancement / superseded PRs (19) — REVIEW then CLOSE

The base feature is already in `main`; these PRs are pre-rewrite drafts. Confirm any specific tweak you still want, then
close the PR and delete the branch.

| PR | Branch | Area (already in main as…) | Verdict |
|----|--------|----------------------------|---------|
| #156 | `codex/build-dynamic-marketing-page-creator-6i5n6w` | marketing pages → `otta-landing` / `ottablog` `page` type | Close after checking builder deltas. |
| #155 | `copilot/analyze-homepages-marketing-architecture` | page-builder refactor → `otta-landing` | Close. |
| #154 | `codex/build-dynamic-marketing-page-creator` | marketing pages + admin builder → `otta-landing` | Close (superseded by #156 too). |
| #153 | `copilot/ottablog-page-marketing-homepage` | Ottablog `page` + DB homepage → `ottablog` | Close — `page` type shipped in main. |
| #149 | `copilot/add-extensible-homepage-framework` | homepage slot framework → `otta-landing` | Close. |
| #150 | `copilot/add-ai-chat-ui` | AI chat streaming/attachments → `ottaai` | Review chat UI deltas, then close. |
| #112 | `claude/add-theme-system-IVo71` | ottalanding homepage themes → `brand-engine` / `otta-landing` | Close. |
| #116 | `copilot/sub-pr-112-again` | merge helper for #112 | Close with #112. |
| #115 | `copilot/enhance-referral-username-setup` | referral usernames/dedup/CSV/vanity → `referrals` | **Review** — CSV export & vanity URLs may hold real deltas; then close. |
| #96 | `copilot/implement-routing-system` | `framework` router → `ottarouter` | Close — router shipped as `ottarouter`. |
| #108 | `copilot/create-cli-with-animation` | CLI reconcile → `cli` / `scripts` | Close. |
| #144 | `copilot/implement-security-audit-recommendations` | auth roadmap/hardening → `auth` | Close — auth hardened in main. |
| #110 | `copilot/update-agents-documentation` | AGENTS.MD docs | Close — main has its own `AGENTS.MD`. |
| #138 | `copilot/plan-npm-package-splitting` | docs: npm publishing strategy | Close (planning doc). |
| #130 | `copilot/create-feature-roadmap` | docs: 2-year roadmap | Close (planning doc) or salvage into `docs/`. |
| #121 | `copilot/make-monorepo-flexible` | monorepo flexibility | Close — PR itself notes it aborted on unrelated histories. |
| #34 | `copilot/optimize-fouc-and-chunking` | build: FOUC + chunking | Close — superseded build config. |
| #146 | `agentcursor/recent-pr-bugs-8afe` | bugfixes on old codebase | Close — targets pre-rewrite code. |
| #145 | `agentcursor/dependency-updates-plan-b040` | dependency vuln patches | Close — superseded by current lockfile. |

---

### Suggested sequencing

1. **Port the HIGH items** (#132, #135, and open a new PR for `pc-payport`) against current `main`.
2. **Decide** on the MED/optional items (#143, #119, #133, #114, #97, #101).
3. **Close** the 19 Section-C PRs (salvage the 2–3 flagged deltas first: #115 CSV/vanity, #150 chat UI, #130 roadmap doc).
4. **Delete** all Section-C branches + the 174 no-PR superseded branches ([`04-safe-to-delete.md`](./04-safe-to-delete.md)).
