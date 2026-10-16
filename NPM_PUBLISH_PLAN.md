# NPM Publishing Strategy for Ottabase Monorepo

> A comprehensive plan for publishing `@ottabase/*` packages to the npm registry, with analysis of
> trade-offs, industry best practices, and a single-developer workflow.

---

## Table of Contents

1. [Current State](#current-state)
2. [Devil's Advocate: Monorepo vs npm Registry](#devils-advocate-monorepo-vs-npm-registry)
3. [Recommendation](#recommendation)
4. [Package Classification](#package-classification)
5. [Publishing Tiers (Rollout Plan)](#publishing-tiers-rollout-plan)
6. [Changes Required](#changes-required)
7. [Single-Developer Workflow](#single-developer-workflow)
8. [Appendix: Package Dependency Graph](#appendix-package-dependency-graph)

---

## Current State

| Metric | Value |
| --- | --- |
| Total packages | 46 |
| Private packages | 5 (`referrals`, `ui-code-highlight`, 2 apps, root) |
| Publishable packages | 41 |
| Packages with `publishConfig` | 1 (`@ottabase/logger`) |
| Existing publish workflows | 0 |
| Changeset/versioning tool | None |
| Internal dep protocol | `workspace:*` |
| External dep protocol | `catalog:` (pnpm) |
| Build tool | tsup (CJS + ESM + DTS) |
| Orchestrator | Turborepo |
| Package manager | pnpm 10.27.0 |
| Node version | 24+ |
| LICENSE | None (needs adding) |

---

## Devil's Advocate: Monorepo vs npm Registry

### Option A: Keep Everything in the Monorepo (Status Quo)

#### ✅ Pros

| Benefit | Detail |
| --- | --- |
| **Zero publish overhead** | No versions to manage, no changelogs to write, no publish pipelines to maintain. For a single developer, this is substantial. |
| **Atomic cross-package changes** | Rename a type in `@ottabase/ottaorm` and fix all 12 downstream packages in one commit, one PR. On npm, this becomes 12 coordinated releases. |
| **Instant integration testing** | `workspace:*` means the app always uses the latest code. No "upgrade to latest" step, no stale lockfile surprises. |
| **Shared tooling** | One `tsconfig.json` base, one `vitest` config, one `eslint` config, one Turbo pipeline. Adding a new package takes minutes, not hours. |
| **Single lockfile** | One `pnpm-lock.yaml` with hoisted shared deps. Avoids duplication and version drift across 40+ packages. |
| **Lower cognitive load** | `git log` shows the full picture. Bisecting across package boundaries is trivial. IDE "Go to Definition" works across packages. |
| **Co-evolution** | Packages evolve together. No semver compatibility matrix to track between `@ottabase/cf@2.3.1` and `@ottabase/queue@1.7.0`. |

#### ❌ Cons

| Drawback | Detail |
| --- | --- |
| **Not reusable externally** | Another project can't `npm install @ottabase/utils`. Must copy files or git-submodule the entire repo. |
| **No independent versioning** | Can't pin a package version in production while iterating on another. Everything moves at HEAD. |
| **Monorepo bloat** | All 46 packages are cloned, installed, and built even if you only need one. CI gets slower over time. |
| **No ecosystem visibility** | Packages don't appear on npm search. No download counts, no "used by" badges, no discoverability. |
| **Tight coupling risk** | `workspace:*` makes it too easy to add cross-package imports. Boundaries stay soft rather than enforced by semver contracts. |

---

### Option B: Publish All Packages to npm (Full Split)

#### ✅ Pros

| Benefit | Detail |
| --- | --- |
| **Reusable across projects** | Any Cloudflare Workers project can `npm install @ottabase/cf` without touching the monorepo. |
| **Clean API contracts** | Publishing forces you to think about what's public. Semver enforces backward compatibility. |
| **Community adoption** | Discoverable on npm. Open-source contributors can file issues/PRs on individual packages. |
| **Smaller install footprint** | External consumers install only what they need plus transitive deps. |
| **Independent release cadence** | Stable packages (e.g., `utils`) can stay at v2.0.0 for months while `ottaorm` iterates rapidly. |

#### ❌ Cons

| Drawback | Detail |
| --- | --- |
| **Version management nightmare** | 41 packages × semver = dozens of releases per feature. Even with Changesets, a single-dev spends more time releasing than coding. |
| **Dependency hell** | `@ottabase/notifications` depends on `cf`, `email`, `cf-realtime`, `queue`, `ottaorm`. Updating one means testing compatibility with all dependents. |
| **Cross-package changes become multi-step** | Rename a field → release `ottaorm` → wait for npm propagation → update `ottablog`, `shortlinks`, `notifications`, `audit`, etc. → release each. |
| **Publish infrastructure cost** | Need: Changesets config, GitHub Actions publish workflow, npm org/tokens, provenance signing, per-package `publishConfig`, possibly a bot for automated PRs. |
| **CI complexity** | Integration tests must pull from npm instead of workspace. Local dev still uses `workspace:*`, so "works locally, breaks on npm" becomes a new failure mode. |
| **Premature abstraction** | Some packages (e.g., `brand-engine`, `rbac`, `notifications`) are tightly coupled to the Ottabase stack. Publishing them suggests they're general-purpose when they aren't. |

---

### Option C: Hybrid — Publish from Monorepo (Recommended)

**Keep the monorepo. Publish a curated subset to npm. Don't split repos.**

This is the industry standard:

| Project | Approach |
| --- | --- |
| **Vercel (Next.js, Turbo, SWC)** | Monorepo + selective npm publish |
| **shadcn/ui** | Monorepo → npm packages |
| **tRPC** | Monorepo + Changesets → npm |
| **Drizzle ORM** | Monorepo → npm packages |
| **Mantine** | Monorepo + Changesets → npm |
| **Radix UI** | Monorepo → npm packages |
| **TanStack** | Monorepo per project → npm |
| **Cloudflare (wrangler, miniflare)** | Monorepo + Changesets → npm |

#### Why Hybrid Wins

- **Dev experience stays identical.** `workspace:*` in the monorepo, `pnpm dev` just works.
- **External consumers get npm packages.** `npm install @ottabase/utils` works.
- **Single-dev friendly.** Changesets batches releases. One `pnpm changeset publish` does all 41 packages.
- **Publish what matters.** Internal/experimental packages stay private. Stable ones get published.
- **No repo split needed.** One repo, one CI, one lockfile.

---

## Recommendation

> **Use Option C: Hybrid approach — publish from the monorepo.**

### What to Publish (and What Not To)

Not all 41 packages should be on npm. Apply this decision filter:

```
Is it useful OUTSIDE the Ottabase ecosystem?
├── Yes → PUBLISH (e.g., utils, ui-cropper, cf, queue)
├── Maybe (needs Ottabase but has clean API) → PUBLISH (e.g., ottaorm, auth)
└── No (tightly coupled to Ottabase internals) → KEEP PRIVATE (e.g., brand-engine, scripts)
```

---

## Package Classification

### 🟢 Publish to npm — General Purpose (21 packages)

These packages are useful independently, with clean APIs and minimal Ottabase coupling.

| Package | Rationale | Tier |
| --- | --- | --- |
| `@ottabase/utils` | Generic utilities (string, date, currency, URL). Zero framework deps. | 1 |
| `@ottabase/config` | Simple config helper. No internal deps. | 1 |
| `@ottabase/logger` | Already has `publishConfig`. Extensible logger. | 1 |
| `@ottabase/api` | Type-safe fetch client. Framework-agnostic. | 1 |
| `@ottabase/i18n` | Thin i18next wrapper. Useful anywhere. | 1 |
| `@ottabase/ui-cropper` | Vanilla JS image cropper. Zero React deps. | 1 |
| `@ottabase/ui-split-pane` | Standalone resizable pane component. | 1 |
| `@ottabase/ui-code-highlight` | highlight.js wrapper. Generic. | 1 |
| `@ottabase/cron` | CF Workers cron handler. Minimal. | 1 |
| `@ottabase/analytics` | CF Workers Analytics Engine wrapper. | 1 |
| `@ottabase/db` | Drizzle D1 driver. Useful for any CF D1 project. | 2 |
| `@ottabase/cf` | Comprehensive CF bindings. High standalone value. | 2 |
| `@ottabase/cf-ai` | CF AI Gateway wrapper. | 2 |
| `@ottabase/cf-realtime` | CF Durable Objects pub/sub. | 2 |
| `@ottabase/queue` | CF Workers job queue. Depends on `cf`. | 2 |
| `@ottabase/email` | Multi-provider email (Resend, SES, CF). Generic. | 2 |
| `@ottabase/ottaorm` | Core ORM. Key to ecosystem. Depends on `db`. | 3 |
| `@ottabase/auth` | Auth.js with D1 adapter. Reusable in CF projects. | 3 |
| `@ottabase/state` | Jotai atoms. Generic state management. | 1 |
| `@ottabase/ui-base` | Base UI styles. | 1 |
| `@ottabase/ui-tailwind` | Tailwind config preset. | 1 |

### 🟡 Publish to npm — Ottabase Ecosystem (11 packages)

Useful mainly within Ottabase projects but clean enough to publish. External users would need to adopt the Ottabase stack.

| Package | Rationale | Tier |
| --- | --- | --- |
| `@ottabase/ui-shadcn` | 63+ shadcn components. Useful but opinionated. | 2 |
| `@ottabase/ui-mantine` | Mantine theme provider. | 2 |
| `@ottabase/ui-datatable` | TanStack Table wrapper. Peers on `ui-shadcn`. | 2 |
| `@ottabase/ui-components` | Shared UI components (blog pagination, etc). | 2 |
| `@ottabase/spotlight` | Command palette. Depends on `config`, `ui-shadcn`. | 2 |
| `@ottabase/ottadate` | Date picker component. | 2 |
| `@ottabase/ottaselect` | Select component with search. | 2 |
| `@ottabase/ottamenu` | Menu system (sidebar, flyout, mega). | 2 |
| `@ottabase/ottarenderer` | EditorJS/HTML renderer. | 2 |
| `@ottabase/docs` | MDX documentation viewer. | 2 |
| `@ottabase/ottaupload` | File upload with R2. | 3 |

### 🔴 Keep Private — Internal Only (10 packages)

Tightly coupled to Ottabase internals, experimental, or too niche to publish independently.

| Package | Reason |
| --- | --- |
| `@ottabase/brand-engine` | Deeply coupled to `audit`, `cf`, `ottaorm`, `ottalayout`, `ottamenu`, `utils`. Internal theming system. |
| `@ottabase/brand-engine-react` | React binding for above. Only useful with full Ottabase stack. |
| `@ottabase/ottalayout` | Layout system tied to brand engine patterns. |
| `@ottabase/rbac` | Tightly coupled to `ottaorm`, `auth`, `cf`. Internal security layer. |
| `@ottabase/notifications` | Depends on 5 internal packages. Ottabase-specific channels. |
| `@ottabase/audit` | Depends on `ottaorm`, `logger`. Internal audit trail. |
| `@ottabase/ottablog` | Blog engine tied to `ottaorm`. Niche. |
| `@ottabase/ottaeditor` | EditorJS wrapper tied to `ottaupload`. |
| `@ottabase/referrals` | Already private. Internal referral tracking. |
| `@ottabase/scripts` | CLI scripts for internal Cloudflare setup. |
| `@ottabase/backups` | Internal backup system for Ottabase apps. |
| `@ottabase/shortlinks` | Depends on `ottaorm`. Internal URL shortener. |
| `@ottabase/ottaport` | Import/export for OttaORM. Internal tooling. |
| `@ottabase/hello-world` | Example package. No external value. |
| `@ottabase/forms` | Internal form builder. |

> **Note:** "Keep Private" doesn't mean "never publish." It means "don't publish in the first wave."
> As packages mature and decouple, promote them to 🟡 or 🟢.

---

## Publishing Tiers (Rollout Plan)

### Tier 1 — Foundation (Week 1-2)

Publish packages with **zero internal `@ottabase/*` dependencies**. These are the safest to publish first — no transitive dependency concerns.

```
@ottabase/utils          (0 internal deps)
@ottabase/config         (0 internal deps)
@ottabase/logger         (0 internal deps, already has publishConfig)
@ottabase/api            (0 internal deps)
@ottabase/i18n           (0 internal deps)
@ottabase/state          (0 internal deps)
@ottabase/ui-base        (0 internal deps)
@ottabase/ui-tailwind    (0 internal deps)
@ottabase/ui-cropper     (0 internal deps)
@ottabase/cron           (0 internal deps)
@ottabase/analytics      (0 internal deps)
@ottabase/cf-ai          (0 internal deps)
@ottabase/cf-realtime    (0 internal deps)
@ottabase/ottadate       (0 internal deps)
@ottabase/ui-split-pane  (0 internal deps)
@ottabase/ui-code-highlight (0 internal deps)
@ottabase/ottamenu       (0 internal deps)
```

**17 packages, all independent. Can be published in any order.**

### Tier 2 — Core Platform (Week 3-4)

Packages that depend on Tier 1 packages. These require Tier 1 to be published first.

```
@ottabase/db            → (no internal deps, but foundational for Tier 3)
@ottabase/cf            → config
@ottabase/email         → (no internal deps)
@ottabase/queue         → cf
@ottabase/ui-shadcn     → (no internal deps)
@ottabase/ui-mantine    → (no internal deps)
@ottabase/ui-datatable  → ui-shadcn (peer)
@ottabase/ui-components → config
@ottabase/spotlight     → config, ui-shadcn
@ottabase/ottaselect    → config
@ottabase/ottarenderer  → ui-code-highlight
@ottabase/docs          → ui-code-highlight (peer)
```

**12 packages. Publish after Tier 1 is live and tested.**

### Tier 3 — ORM & Auth (Week 5-6)

The heavyweight packages that form the Ottabase data layer.

```
@ottabase/ottaorm       → db
@ottabase/auth          → cf, email, utils, ui-shadcn
@ottabase/ottaupload    → cf, db
```

**3 packages. These are the most impactful for external adoption.**

### Tier 4 — Evaluate Later

Packages classified as 🔴 (private). Revisit after Tiers 1-3 are stable and community feedback arrives.

---

## Changes Required

### Phase 1: Infrastructure Setup

#### 1.1 Add a LICENSE file

```bash
# At repo root
touch LICENSE
# Choose MIT (most common for npm packages) or Apache-2.0
```

Every npm package needs a license. Without it, the package is legally "all rights reserved" and technically unusable.

#### 1.2 Create npm Organization

```bash
# On npmjs.com
# 1. Create org: @ottabase
# 2. Create automation token (not publish, not granular — "Automation" type)
# 3. Store token as GitHub secret: NPM_TOKEN
```

#### 1.3 Add root `.npmrc`

Create `.npmrc` at repo root:

```ini
# .npmrc
//registry.npmjs.org/:_authToken=${NPM_TOKEN}
access=public
```

#### 1.4 Install and Configure Changesets

```bash
pnpm add -w -D @changesets/cli @changesets/changelog-github
pnpm changeset init
```

Edit `.changeset/config.json`:

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": [
    "@changesets/changelog-github",
    { "repo": "thinkdj/ottabase" }
  ],
  "commit": false,
  "fixed": [],
  "linked": [
    ["@ottabase/cf", "@ottabase/cf-ai", "@ottabase/cf-realtime"],
    ["@ottabase/ui-shadcn", "@ottabase/ui-datatable", "@ottabase/ui-components"]
  ],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [
    "@ottabase/brand-engine",
    "@ottabase/brand-engine-react",
    "@ottabase/ottalayout",
    "@ottabase/rbac",
    "@ottabase/notifications",
    "@ottabase/audit",
    "@ottabase/ottablog",
    "@ottabase/ottaeditor",
    "@ottabase/referrals",
    "@ottabase/scripts",
    "@ottabase/backups",
    "@ottabase/shortlinks",
    "@ottabase/ottaport",
    "@ottabase/hello-world",
    "@ottabase/forms",
    "@ottabase/ottabase-template-app-tanstack",
    "@ottabase/ottabase-template-app-nextjs-homepage"
  ]
}
```

**Key config decisions:**
- `linked`: Groups of packages that always version together (e.g., all CF packages bump together).
- `ignore`: Private/internal packages that Changesets should skip entirely.
- `updateInternalDependencies: "patch"`: When a dependency is released, dependents get a patch bump automatically.

#### 1.5 Update Package `package.json` Files

For every package being published, ensure these fields exist:

```jsonc
{
  "name": "@ottabase/example",
  "version": "0.1.0",         // Start at 0.x for initial development
  "description": "One-line description of what this package does",
  "license": "MIT",
  "author": "thinkdj",
  "repository": {
    "type": "git",
    "url": "https://github.com/thinkdj/ottabase.git",
    "directory": "packages/example"
  },
  "homepage": "https://github.com/thinkdj/ottabase/tree/main/packages/example",
  "bugs": "https://github.com/thinkdj/ottabase/issues",
  "keywords": ["ottabase", "cloudflare", "workers"],
  "publishConfig": {
    "access": "public"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "sideEffects": false
}
```

For packages that should NOT be published, add:

```json
{
  "private": true
}
```

#### 1.6 Add `files` Field to Published Packages

The `files` field controls what gets included in the npm tarball. Without it, everything (including src, tests, configs) gets published.

```json
{
  "files": ["dist", "README.md", "LICENSE"]
}
```

Verify with: `pnpm pack --dry-run` in any package directory.

---

### Phase 2: Build & Publish Pipeline

#### 2.1 Add GitHub Actions Publish Workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write       # For creating releases
      pull-requests: write  # For changeset PR
      id-token: write       # For npm provenance
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install --frozen-lockfile
      - run: pnpm build:pkg

      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
          title: 'chore: version packages'
          commit: 'chore: version packages'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

**How this works:**
1. On every push to `main`, the action checks for pending changesets.
2. If changesets exist → creates/updates a "Version Packages" PR that bumps versions and updates changelogs.
3. When that PR is merged → publishes updated packages to npm.

#### 2.2 Add Release Script to Root `package.json`

```json
{
  "scripts": {
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build:pkg && changeset publish"
  }
}
```

#### 2.3 Add Provenance Support (Optional but Recommended)

npm provenance links published packages to their source commit. Add to `.npmrc`:

```ini
provenance=true
```

---

### Phase 3: Package Readiness

#### 3.1 Audit Each Package README

Every published package needs a README with:

```markdown
# @ottabase/package-name

One-line description.

## Installation

\`\`\`bash
npm install @ottabase/package-name
# or
pnpm add @ottabase/package-name
\`\`\`

## Usage

\`\`\`typescript
import { something } from '@ottabase/package-name';
\`\`\`

## API Reference

Brief docs or link to full docs.

## License

MIT
```

#### 3.2 Convert `workspace:*` to Version Ranges for Published Packages

Changesets handles this automatically during publish. When you run `changeset publish`:
- `"@ottabase/db": "workspace:*"` becomes `"@ottabase/db": "^0.1.0"` in the published tarball.
- Locally, `workspace:*` continues to work as before.

**No manual changes needed.** pnpm + Changesets handles the workspace → version conversion.

#### 3.3 Ensure `sideEffects: false` on Utility Packages

For tree-shaking to work properly in consumers' bundlers:

```json
{
  "sideEffects": false
}
```

Already present on some packages. Add to all published utility packages.

#### 3.4 Validate Package Exports

Run for each published package:

```bash
cd packages/utils
pnpm pack --dry-run
# Review output — should only include dist/, README.md, package.json
```

Also test that exports resolve:

```bash
# After build
node -e "require('@ottabase/utils')"
node -e "import('@ottabase/utils').then(m => console.log(Object.keys(m)))"
```

---

### Phase 4: Private Package Lockdown

For packages that should NOT be published, ensure they have `"private": true`:

```bash
# Already private:
# packages/referrals
# packages/ui-code-highlight

# Need to add "private": true:
packages/brand-engine/package.json
packages/brand-engine-react/package.json
packages/ottalayout/package.json
packages/rbac/package.json
packages/notifications/package.json
packages/audit/package.json
packages/ottablog/package.json
packages/ottaeditor/package.json
packages/scripts/package.json
packages/backups/package.json
packages/shortlinks/package.json
packages/ottaport/package.json
packages/hello-world/package.json
packages/forms/package.json
```

---

## Single-Developer Workflow

### Day-to-Day Development (No Change)

```bash
# Normal development — nothing changes
pnpm dev
# Edit code across any packages
# workspace:* resolves locally as always
```

### When You Make a Publishable Change

```bash
# 1. After making changes, create a changeset
pnpm changeset
# Interactive prompt:
#   - Which packages changed? (select with space)
#   - Is it a major/minor/patch bump?
#   - Write a summary of the change

# This creates a markdown file in .changeset/ — commit it with your code
git add .changeset/fuzzy-cats-dance.md
git commit -m "feat(cf): add R2 multipart upload support"
git push
```

### Release Cycle

```
                    ┌─────────────────────────────────┐
                    │     Normal Development           │
                    │  (feature branches / main)       │
                    └────────────┬────────────────────┘
                                 │
                          push to main
                                 │
                    ┌────────────▼────────────────────┐
                    │   GitHub Actions detects         │
                    │   pending .changeset/ files      │
                    └────────────┬────────────────────┘
                                 │
                    ┌────────────▼────────────────────┐
                    │   Creates/updates PR:            │
                    │   "chore: version packages"      │
                    │                                  │
                    │   - Bumps package.json versions   │
                    │   - Generates CHANGELOG.md        │
                    │   - Updates internal dep versions │
                    └────────────┬────────────────────┘
                                 │
                        you review & merge
                                 │
                    ┌────────────▼────────────────────┐
                    │   GitHub Actions publishes       │
                    │   updated packages to npm        │
                    └─────────────────────────────────┘
```

### Quick Reference Commands

```bash
# Create a changeset (after making changes)
pnpm changeset

# Preview what versions will be bumped
pnpm changeset status

# Manual local publish (for testing)
pnpm changeset version    # Apply version bumps locally
pnpm release              # Build + publish

# Check what will be published
cd packages/utils && pnpm pack --dry-run

# Validate exports before publish
node -e "require('./dist/index.cjs')"
```

### When NOT to Create a Changeset

- Internal-only changes (refactoring that doesn't affect public API)
- Changes to private packages (brand-engine, rbac, etc.)
- CI/CD or tooling changes
- Documentation-only changes that don't affect the published README

### Handling Breaking Changes

```bash
pnpm changeset
# Select "major" when prompted
# Write a clear migration guide in the changeset summary:
#
# @ottabase/cf: Renamed `createD1` to `createD1Client` for consistency.
#
# Migration:
# - import { createD1 } from '@ottabase/cf/d1'
# + import { createD1Client } from '@ottabase/cf/d1'
```

---

## Appendix: Package Dependency Graph

```
Tier 0 (no internal deps — publish first)
├── @ottabase/utils
├── @ottabase/config
├── @ottabase/logger
├── @ottabase/api
├── @ottabase/i18n
├── @ottabase/state
├── @ottabase/ui-base
├── @ottabase/ui-tailwind
├── @ottabase/ui-cropper
├── @ottabase/cron
├── @ottabase/analytics
├── @ottabase/cf-ai
├── @ottabase/cf-realtime
├── @ottabase/ottadate
├── @ottabase/ui-split-pane
├── @ottabase/ui-code-highlight
└── @ottabase/ottamenu

Tier 1 (depends on Tier 0)
├── @ottabase/db
├── @ottabase/cf → config
├── @ottabase/email
├── @ottabase/queue → cf
├── @ottabase/ui-shadcn
├── @ottabase/ui-mantine
├── @ottabase/ui-datatable → ui-shadcn (peer)
├── @ottabase/ui-components → config
├── @ottabase/spotlight → config, ui-shadcn
├── @ottabase/ottaselect → config
├── @ottabase/ottarenderer → ui-code-highlight
└── @ottabase/docs → ui-code-highlight (peer)

Tier 2 (depends on Tier 0-1)
├── @ottabase/ottaorm → db
├── @ottabase/auth → cf, email, utils, ui-shadcn
└── @ottabase/ottaupload → cf, db

Tier 3 (internal only — don't publish yet)
├── @ottabase/brand-engine → audit, cf, ottalayout, ottamenu, ottaorm, utils
├── @ottabase/brand-engine-react → brand-engine, ottalayout
├── @ottabase/ottalayout
├── @ottabase/rbac → ottaorm, auth, logger, cf
├── @ottabase/notifications → cf, email, cf-realtime, queue, ottaorm
├── @ottabase/audit → ottaorm, logger
├── @ottabase/ottablog → ottaorm, ottarenderer
├── @ottabase/ottaeditor → ottaupload
├── @ottabase/referrals → db, ottaorm (private)
├── @ottabase/scripts → db
├── @ottabase/backups
├── @ottabase/shortlinks → ottaorm
├── @ottabase/ottaport
├── @ottabase/hello-world
└── @ottabase/forms → ottaselect, ui-datatable
```

### Dependency Flow (Published Packages Only)

```
config ──► cf ──► queue
                   │
utils              ├──► auth
                   │
email ─────────────┘

db ──► ottaorm

ui-code-highlight ──► ottarenderer
                  └──► docs (peer)

config ──► ui-components
       └──► ottaselect
       └──► spotlight ◄── ui-shadcn
                          │
ui-shadcn ──► ui-datatable (peer)
```

---

## Summary Checklist

- [ ] **Choose a license** (MIT recommended) and add `LICENSE` to repo root
- [ ] **Create `@ottabase` npm organization** at npmjs.com
- [ ] **Create npm automation token** and add as `NPM_TOKEN` GitHub secret
- [ ] **Add `.npmrc`** with registry auth and public access
- [ ] **Install Changesets** (`@changesets/cli`, `@changesets/changelog-github`)
- [ ] **Configure `.changeset/config.json`** with linked groups and ignored packages
- [ ] **Add `publishConfig`, `files`, `repository`, `license`** to each publishable package.json
- [ ] **Add `"private": true`** to internal-only packages
- [ ] **Create `.github/workflows/publish.yml`** for automated npm publishing
- [ ] **Add release scripts** to root package.json
- [ ] **Audit README.md** for each publishable package (install + usage + API)
- [ ] **Tier 1 publish** — 17 zero-dep packages
- [ ] **Tier 2 publish** — 12 packages with Tier 1 deps
- [ ] **Tier 3 publish** — 3 core ORM/auth packages
- [ ] **Validate** — `pnpm pack --dry-run` for each, test imports
