# Port Candidates — features not in `main`

These are the branches whose work is **genuinely absent from `main`** (verified — not a rename). Everything else in the
repo is already represented in `main` and is safe to delete.

Ordered by priority. "PR" = open pull request tracking it (if any).

| # | Feature | Branch | PR | Priority | In main? |
|---|---------|--------|----|----------|----------|
| 1 | `@ottabase/payport` — payments/subscriptions | `pc-payport` | — | **HIGH** | NO |
| 2 | `@ottabase/backups` — D1→R2 backups + admin UI | `copilot/add-admin-ui-for-db-backups` | #132 | **HIGH** | NO |
| 3 | `@ottabase/ottaport` — data import/export | `copilot/add-data-import-export-package` | #135 | **HIGH** | NO |
| 4 | GDPR data export + account deletion | `copilot/add-gdpr-data-export-delete-workflow` | #143 | MEDIUM | NO |
| 5 | `@ottabase/error-page` — edge error pages | `copilot/replicate-youch-error-handling` | #119 | MEDIUM | NO |
| 6 | `@ottabase/ottasearch` — D1 search | `copilot/implement-ottabase-search` / `claude/ottasearch-package-*` | #133 | MEDIUM | PARTIAL |
| 7 | `@ottabase/motion` — animation | `copilot/add-animation-framework` | #114 | LOW-MED | NO |
| 8 | Tail Workers log console | `copilot/add-admin-area-for-workers` | #97 | LOW-MED | NO |
| 9 | OSS distribution tooling (create-app CLI) | `copilot/add-open-source-framework-support` | #101 | LOW-MED | NO |
| 10 | `@ottabase/ui-icons` — unified icons | `claude/add-ui-icons-package-*` | — | LOW | NO |
| 11 | `@ottabase/ui-fonts` — font config | `claude/create-ui-fonts-package-*` | — | LOW | NO |
| 12 | `@ottabase/recraft` — AI image clone (experimental) | `claude/recraft-ai-clone-BL5FL` | — | LOW / skip | NO |
| — | `packages/flags` (feature flags) — orphaned side-artifact | `claude/add-auth-feature-PyL7N` | — | note only | NO |

---

## 1. `@ottabase/payport` — payments & subscriptions · **HIGH**

- **Branch:** `pc-payport` (63 days old) · **no open PR** — this is the only high-value feature with *nothing* tracking it.
- **What:** Provider-agnostic payments/subscriptions/entitlements. Ships a **Polar.sh** adapter; designed to also host
  Stripe / Paddle / LemonSqueezy. One API for checkout, subscriptions, billing portal, entitlements, and webhooks, with
  a universal event taxonomy (`payment.subscription.activated`, `payment.checkout.completed`, …). Explicitly an
  **optional** package wired via `customPackages` in `ottabase.config.ts`.
- **Why port:** Billing is the single biggest gap in an otherwise batteries-included SaaS framework — the project's own
  README comparison table calls out "Next.js + Supabase + **Stripe**". No payment/billing code exists anywhere in `main`.
- **Effort:** Self-contained package (`README`, `src`, tests, `tsconfig`, `vitest.config`). Low blast radius; opt-in.
- **Recommendation:** **Port.** Open a fresh PR against current `main` (the branch predates the rewrite, so cherry-pick
  the `packages/payport` tree rather than merging the branch).

## 2. `@ottabase/backups` — D1→R2 backup service · **HIGH**

- **Branch:** `copilot/add-admin-ui-for-db-backups` (156 days) · **PR #132 (draft)**.
- **What:** Automated D1→R2 SQL dumps. Timestamped filenames (`yyyy-mm-dd-hhmmss_appName.sql`), SHA-256 integrity
  hashing, day-based **and** count-based retention, setup-detection, and a built-in **`/admin/backups`** management page
  with schedule + retention settings.
- **Why port:** Disaster-recovery/ops capability with no equivalent in `main` (grep for `backup` in main → 0 hits).
- **Recommendation:** **Port.** Rebase PR #132 onto current `main` (align `cron`/`cf`/admin routing to renamed
  packages), or cherry-pick `packages/backups` fresh.

## 3. `@ottabase/ottaport` — data import/export · **HIGH**

- **Branch:** `copilot/add-data-import-export-package` (156 days) · **PR #135 (draft)**.
- **What:** Import CSV/JSON/TSV → field-map to an OttaORM model → validate → batched bulk upserts. Export any model with
  filters (date range, search, field filters) to CSV/JSON/TSV. Job **history** with row counts/status/user/filename;
  optional R2 storage of uploaded files for audit.
- **Why port:** Bulk data in/out is a near-universal admin need; integrates directly with the fat-model layer. Absent
  from `main`.
- **Recommendation:** **Port.** Rebase PR #135 onto `main`; verify against current OttaORM APIs.

## 4. GDPR data export + account deletion · MEDIUM

- **Branch:** `copilot/add-gdpr-data-export-delete-workflow` (134 days) · **PR #143 (draft)**.
- **What:** User-facing data export and account-deletion workflow (GDPR/CCPA-style).
- **Why port:** Compliance feature for any real SaaS; complements `ottaport` (export) and `rbac`. Not in `main`.
- **Recommendation:** **Consider.** Medium value; depends on how the maintainer wants deletion cascades to interact with
  `audit`/`rbac`. Review PR #143 against current schema.

## 5. `@ottabase/error-page` — edge error pages · MEDIUM

- **Branch:** `copilot/replicate-youch-error-handling` (157 days) · **PR #119 (draft)**.
- **What:** Youch-style pretty HTML error pages that work on edge runtimes (no Node `fs`): expandable stack frames,
  "open in editor" links, dark/light, request-metadata display with sensitive-header masking, recursive error-cause
  chains, Stack/Raw-JSON tabs, dev/prod modes.
- **Why port:** Strong DX for a Workers-first framework; self-contained and edge-safe. Not in `main`.
- **Recommendation:** **Consider.** Nice-to-have; low risk. Port as an opt-in dev/prod error boundary.

## 6. `@ottabase/ottasearch` — D1 search · MEDIUM (overlaps `spotlight`)

- **Branches:** `copilot/implement-ottabase-search` (PR #133, draft) and the original
  `claude/ottasearch-package-01TzYBAGq6SvcRYqEX515w5Z` (259 days, no PR).
- **What:** Universal **D1-backed** search component — Notion-like UI, `Cmd/Ctrl+K`, keyboard nav, flexible display
  modes, query parsing, reindexing.
- **Why "PARTIAL":** `main` already ships **`@ottabase/spotlight`** (a command palette). These overlap in UI but differ
  in intent — `spotlight` drives navigation/commands; `ottasearch` is data/full-text search over models. They may
  **complement** rather than duplicate.
- **Recommendation:** **Evaluate, don't blind-port.** Decide whether `spotlight` should gain data-search, or whether
  `ottasearch` lands as a sibling. If `spotlight` is the intended answer, both ottasearch branches become safe to delete.

## 7. `@ottabase/motion` — animation · LOW-MED

- **Branch:** `copilot/add-animation-framework` (164 days) · **PR #114 (draft)**.
- **What:** Brand-kit-aware animation utilities (Motion.dev) — transition presets, React hooks/components driven by the
  active brand kit's motion tokens.
- **Recommendation:** **Optional.** Fits the brand-engine story; no animation package in `main`. Port if motion is a
  priority, else defer.

## 8. Tail Workers log console · LOW-MED

- **Branch:** `copilot/add-admin-area-for-workers` (108 days) · **PR #97 (draft)**.
- **What:** Admin console for live Cloudflare **Tail Workers** log debugging.
- **Recommendation:** **Optional.** Useful ops/dev tool; not core. Port only if you want in-app log tailing.

## 9. OSS distribution tooling · LOW-MED

- **Branch:** `copilot/add-open-source-framework-support` (157 days) · **PR #101 (draft)**.
- **What:** Open-source distribution tooling — package manifest, `create-app` CLI, tier-sync CLI.
- **Recommendation:** **Optional.** Relevant only if Ottabase is distributed as a public template/starter. Overlaps the
  existing `otta` CLI in `packages/cli`; reconcile before porting.

## 10–12. Low-value / convenience packages

| Feature | Branch | Verdict |
|---------|--------|---------|
| `@ottabase/ui-icons` (unified Lucide+Tabler) | `claude/add-ui-icons-package-*` | **Optional/low** — `main` consumes icon libs directly; convenience wrapper only. Deletable. |
| `@ottabase/ui-fonts` (font config) | `claude/create-ui-fonts-package-*` | **Optional/low** — `main` keeps fonts in `ui-base`; convenience only. Deletable. |
| `@ottabase/recraft` (AI image clone) | `claude/recraft-ai-clone-BL5FL` | **Skip** — experimental Recraft.ai clone; niche, no PR. Safe to delete. |

## Note — orphaned `packages/flags`

`claude/add-auth-feature-PyL7N` is an old auth branch (auth **is** in `main`, so the branch is superseded and
safe to delete), but it also created a small **`packages/flags`** (feature-flags) that never made it into `main`. There
is no feature-flag system in `main`. If lightweight feature flags are wanted, salvage that one directory before deleting
the branch; otherwise it goes with it.
