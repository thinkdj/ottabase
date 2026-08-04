# Branch Audit — August 2026

**Date:** 2026-08-04
**Base of comparison:** `origin/main` (50 commits · history spans 2026-07-17 → 2026-08-01 · 50 packages · 2 apps)
**Scope:** all 205 remote branches (every `origin/*` except `main`), compared one-by-one against `main`.

> No code was changed by this audit. This branch (`claude-audit-of-branches-aug26`) adds **only** these Markdown
> findings under `branch-audit-2026-08/`.

---

## TL;DR

| Bucket | Count | Action |
|--------|------:|--------|
| **Safe to delete** (feature already in main, or superseded) | **174** | Bulk-delete — see [`04-safe-to-delete.md`](./04-safe-to-delete.md) |
| **Dependabot** (ignored per request) | **2** | Mark safe / let Dependabot manage — [`04-safe-to-delete.md`](./04-safe-to-delete.md) |
| **Preserve / review** (open PRs + net-new features) | **29** | See [`01-port-candidates.md`](./01-port-candidates.md) + [`02-open-prs.md`](./02-open-prs.md) |
| **Total** | **205** | Full list: [`03-full-inventory.md`](./03-full-inventory.md) |

**Bottom line:** ~85% of branches are already represented in `main` and safe to delete. The whole repo history was
**squash-rewritten around 2026-07-17**, so 200 of 205 branches share *no common ancestor* with today's `main` — yet
`main` already contains the features they added (under consolidated/renamed packages). Only a **handful of genuinely
net-new features** are worth porting.

### The 3 things actually worth porting

| Feature | Branch | PR | Why |
|---------|--------|----|-----|
| **`@ottabase/payport`** — payments/subscriptions | `pc-payport` | *(none)* | Billing is the one headline SaaS gap; the README's own comparison table flags Stripe. **No PR tracks this.** |
| **`@ottabase/backups`** — D1→R2 backups + `/admin/backups` | `copilot/add-admin-ui-for-db-backups` | #132 (draft) | Self-contained ops capability absent from main. |
| **`@ottabase/ottaport`** — CSV/JSON/TSV import/export | `copilot/add-data-import-export-package` | #135 (draft) | Common SaaS need; clean OttaORM integration. |

Full prioritized list (13 candidates) in [`01-port-candidates.md`](./01-port-candidates.md).

---

## The 7 requested fields — where to find each

Every branch is scored on the six requested dimensions (plus Open-PR context) in
[`03-full-inventory.md`](./03-full-inventory.md):

1. **Already implemented in main (YES/NO)** — `In main?` column
2. **Age of branch (days)** — `Age` column (days since last commit, relative to 2026-08-04)
3. **Implementation on main vs branch (NA / MAIN BETTER / MAIN WORSE)** — `Main vs branch` column
4. **Recommendation of porting to main** — `Recommendation` column
5. **Summary of the branch's changes** — `Summary` column
6. **Safe to delete (YES/NO)** — `Safe delete` column
7. *(bonus)* **Open PR** — so you never delete a branch out from under a live PR

---

## Why "already in main" is almost always YES

The repository's `main` was **rebuilt from scratch** (squash/history-rewrite) in mid-July 2026. Evidence:

- `main` has **only 50 commits**, rooted at a single commit dated **2026-07-17**.
- **200 of 205 branches have no merge-base with `main`** (`git merge-base` returns empty) — they descend from the
  pre-rewrite history.
- The rewrite **renamed and consolidated** everything. The same feature that a branch "adds" already lives in `main`
  under a new name. Confirmed rename/rehoming map:

  | On branches (old) | In `main` (now) |
  |-------------------|-----------------|
  | `packages/cf-ai` | `packages/ottaai` |
  | `packages/cropper` | `packages/ui-cropper` |
  | `packages/env` | `packages/config` |
  | `packages/cf-scheduler` | `packages/cron` |
  | `packages/cf-ratelimiter` | rate-limiting inside `packages/cf` |
  | `packages/models` / `cf-data` | `packages/ottaorm` + `packages/db` |
  | `packages/framework` | `packages/ottarouter` |
  | `packages/referral` | `packages/referrals` |
  | `packages/ottalanding` / `ui-marketing` | `apps/otta-landing` |
  | `apps/ottabase-template-app*`, `apps/tanstack` | `apps/otta-web` / `apps/otta-landing` |

  Because of this, a naive "which packages does the branch have that main doesn't?" throws **false positives** (e.g.
  `cf-ai` looked "missing" from main on 51 branches — it's just `ottaai` now). This audit resolves those renames before
  judging, so "already in main = YES" reflects the **feature**, not the file path.

This is exactly the "main might have incorporated the same feature in some other form" case flagged in the request —
and it's the norm here, not the exception.

---

## Methodology

For each of the 205 branches:

1. **Age** — `git log -1 --format=%ct` → days before 2026-08-04.
2. **Divergence** — `git rev-list --left-right --count origin/main...<branch>` (ahead/behind) and
   `git merge-base` presence (shared history or not).
3. **Content vs main** — tree-level comparison (`git ls-tree` + `git diff --name-only origin/main <branch>`), split into
   *files new-in-branch*, *modified-in-both*, and the **new packages/apps** the branch introduces.
4. **Rename resolution** — new packages/apps cross-checked against the rename map above and against `main`'s README
   package inventory, so a renamed feature is recognized as present.
5. **Net-new verification** — every package that looked genuinely absent from main was confirmed by reading its
   `README`/tree and grepping `main` for an equivalent (e.g. rate-limiting *is* in `packages/cf`; backups/payments/
   import-export/GDPR/error-page are *not*).
6. **PR cross-reference** — the 29 open PRs were pulled from GitHub so branches with a live PR are never marked
   "safe to delete."
7. **Recent branches** (post-rewrite) were inspected commit-by-commit (`git log origin/main..<branch>`) to confirm
   whether their unique work is already in main.

### Confidence notes

- **High confidence** on *safe-to-delete* for the 174: their feature is demonstrably in `main`, they have no open PR,
  and `main` is strictly newer.
- **High confidence** on the net-new *port candidates*: their package/README exists on the branch and has **zero**
  counterpart in `main`.
- The `Main vs branch` verdict is **MAIN BETTER** for superseded branches because `main` is the newer, consolidated,
  reviewed lineage; it's **NA (absent)** where main simply has no counterpart. Where a branch *might* hold a small
  un-merged delta on top of an in-main feature, it is called out individually in [`02-open-prs.md`](./02-open-prs.md)
  rather than blanket-approved for deletion.

---

## Recent branches (post-rewrite) — verified one-by-one

Only 5 branches share history with today's `main`; the 4 non-Dependabot ones are the newest real work and were checked
commit-by-commit:

| Branch | Age | Unique commits vs main | Finding | Safe delete |
|--------|----:|------------------------|---------|:-----------:|
| `claude/marketing-md-docs-h94a9j` | 12d | 17 (Jul 22–23: Ottablog platform-scope, session hardening) | Signature work (`platform-blog`, signed draft previews, `studio-state`) **confirmed present in `main`**; `main` is further ahead (completed the `cf-ai`→`ottaai` rename this branch still lacks). | **YES** |
| `claude/platform-owner-permissions-46ohva` | 16d | **0** | Literally an ancestor of `main` — every commit already merged. | **YES** |
| `claude/docs-audit-updates-xs095m` | 16d | doc corrections (also drags in ~870 pre-rewrite commits) | Doc-only tweaks on top of platform-owner; `main`'s docs are newer (Aug 1). | **YES** |
| `claude/ottabase-startup-ideas-gm4y1j` | 17d | docs only (2026 ideation catalog, per-package `AGENTS.md`, startup research log) | **Non-code planning notes.** `main` has its own `AGENTS.MD`. The ideation/research logs are personal — **salvage them elsewhere if you want to keep them** before deleting. | YES* |

\* Code-wise superseded; the only thing unique is personal planning docs.

## Files in this audit

| File | Contents |
|------|----------|
| [`01-port-candidates.md`](./01-port-candidates.md) | The 13 features not in main, prioritized, with what/why/how-to-port. |
| [`02-open-prs.md`](./02-open-prs.md) | All 29 open PRs, each with a verdict (port / review / close). |
| [`03-full-inventory.md`](./03-full-inventory.md) | Every branch (205 rows) with all requested fields. |
| [`04-safe-to-delete.md`](./04-safe-to-delete.md) | The 174 + 2 dependabot branches with ready-to-run delete commands. |
