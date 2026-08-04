# Full Branch Inventory (all 205 branches)

Every remote branch compared against `origin/main`, **sorted most-recent first** (by last-commit age).

**Legend**
- **In main?** — is the branch's feature already present in `main` (after resolving renames)? `YES` / `NO` / `PARTIAL`.
- **Age** — days since the branch's last commit (relative to 2026-08-04).
- **Main vs branch** — `MAIN BETTER` (main is the newer/consolidated implementation) · `NA (absent)` (main has no
  counterpart) · `MAIN DIFFERENT` (related but not equivalent) · `NA (dep bump)`.
- **Open PR** — live pull request number (`—` = none). Never delete a branch with an open PR.
- **Safe delete** — `YES` = feature is in main (or low-value) and no open PR · `NO` = preserve/port/review.
- **Recommendation** — porting recommendation.
- **Summary** — high-level description (branch tip subject or verified feature summary).

> Detail on the `NO`/port rows: [`01-port-candidates.md`](./01-port-candidates.md) and [`02-open-prs.md`](./02-open-prs.md).

| # | Branch | Age (d) | In main? | Main vs branch | Open PR | Safe delete | Recommendation | Summary |
|---|--------|--------:|:--------:|:--------------:|:-------:|:-----------:|----------------|---------|
| 1 | `dependabot/npm_and_yarn/testing-library/jest-dom-7.0.0` | 2 | YES | NA (dep bump) | #221 | YES (dependabot) | Ignore — dependency bump; let Dependabot manage. | Dependency version bump (jest-dom-7.0.0). |
| 2 | `dependabot/npm_and_yarn/hookform/resolvers-5.5.7` | 2 | YES | NA (dep bump) | #220 | YES (dependabot) | Ignore — dependency bump; let Dependabot manage. | Dependency version bump (resolvers-5.5.7). |
| 3 | `claude/marketing-md-docs-h94a9j` | 12 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | refactor(platform): harden session lifecycle, authorization, and Studio state |
| 4 | `claude/platform-owner-permissions-46ohva` | 16 | YES | MAIN BETTER | — | YES | No — already an ancestor of main (0 unique commits). | Fix RBAC authorization gaps; drop Prisma from the install graph |
| 5 | `claude/docs-audit-updates-xs095m` | 16 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Remove doc coverage of MongoDB/Prisma/seed-CLI code deleted upstream |
| 6 | `claude/ottabase-startup-ideas-gm4y1j` | 17 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | docs: add 2026 ideation master catalog |
| 7 | `pc-platform-owner` | 19 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Owner to Platform_Owner for no confusion |
| 8 | `pc-upp-theme` | 20 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Theme: Upp |
| 9 | `fable-opus-auth-route-hardening` | 24 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Make the referral URL param key configurable (default ?ref=) |
| 10 | `pc-fable-opus-fixes` | 29 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | bring changes to main |
| 11 | `claude/editorjs-plugins-theme-vars-qt0v05` | 30 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Theme: make ottaeditor + ottarenderer honor brand theme tokens |
| 12 | `claude/modernize-package-ui-uugwot` | 31 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Refine demo shell to a clean, minimalist surface |
| 13 | `claude/saas-framework-audit-rct5hc` | 31 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Docs: Mark per-org custom roles as resolved in the audit |
| 14 | `claude/cf-workers-routing-package-tvqop7` | 32 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Address valid findings from peer review of ottarouter |
| 15 | `claude/custom-auth-review-rksrw1` | 33 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Testing-lens review follow-ups: CORS allowlist, ms revoke-survival, tests, docs, demo |
| 16 | `claude/ottabase-custom-auth-je4gzb` | 34 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Harden auth: fail-closed sessions, atomic bootstrap, email normalization |
| 17 | `claude/code-review-analysis-ox54hr` | 43 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | fix: revert over-broad editable: false on UserGroup/UserGroupMember |
| 18 | `pc-payport` | 63 | NO | NA (absent) | — | NO | PORT (no PR exists) — @ottabase/payport fills the billing gap the README's own comparison highlights (Stripe/subscriptions). | Provider-agnostic payments/subscriptions/entitlements. Polar.sh adapter out of the box; built for Stripe/Paddle/LemonSqueezy. Optional package. |
| 19 | `claude/sharp-galileo-wHDI6` | 74 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Scripts: Generalize active-app resolution with named roles + drop dead scripts |
| 20 | `copilot/fix-usergroups-ottaworm` | 79 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Address review: use Drizzle inArray, improve error logging context |
| 21 | `pc-usergroups` | 79 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add user groups and group membership features |
| 22 | `copilot/update-cloudflare-scripts-generic` | 86 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | feat: add Workers AI (OBCF_AI) binding support to cf:setup and cf:validate |
| 23 | `copilot/analyze-homepages-marketing-architecture` | 93 | YES | MAIN BETTER | #155 draft | NO (open PR #155 draft) | Review PR #155 draft — base feature in main; verify no un-merged delta, then close/delete. | Homepage/page-builder refactor (→ otta-landing in main). |
| 24 | `copilot/fix-stale-organization-id` | 103 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | fix: stale org token, invite revoke ordering, resend dialog text, and tests |
| 25 | `neopc-organization-flow-plus-plus` | 103 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Solidify Org Flows  (#198) |
| 26 | `claude/solidify-org-flow-TL3c2` | 103 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Use auth SYSTEM_ORGANIZATION_ID and harden deletes |
| 27 | `copilot/add-admin-area-for-workers` | 108 | NO | NA (absent) | #97 draft | NO | Optional — CF Tail Workers log-debugging admin console. Dev/ops tooling. | Tail Workers admin console for live Cloudflare Workers log debugging. |
| 28 | `copilot/analyze-test-coverage` | 108 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | test(referrals): improve typed model test fixtures |
| 29 | `copilot/check-repo-history-for-secrets` | 113 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | chore: pre-OSS security hardening — redact demo creds, harden AUTH_SECRET, untrack .clau |
| 30 | `copilot/modify-admin-listing-changelogs` | 117 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Address code review feedback: improve comments, use proper redirects, add aria-labels |
| 31 | `copilot/rename-template-apps` | 117 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Update pnpm-lock.yaml |
| 32 | `copilot/create-launch-plan-new-detailed-46` | 120 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Re-audit OSS launch readiness after main merge (B+ grade) |
| 33 | `copilot/create-roadmap-and-plugins` | 123 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Ottablog: Add image position picker and cover mode |
| 34 | `codex/build-dynamic-marketing-page-creator-6i5n6w` | 126 | YES | MAIN BETTER | #156 draft | NO (open PR #156 draft) | Review PR #156 draft — base feature in main; verify no un-merged delta, then close/delete. | Marketing-page builder (→ otta-landing / ottablog `page` type in main). |
| 35 | `codex/build-dynamic-marketing-page-creator` | 126 | YES | MAIN BETTER | #154 draft | NO (open PR #154 draft) | Review PR #154 draft — base feature in main; verify no un-merged delta, then close/delete. | Marketing-pages + admin builder (→ otta-landing / ottablog in main). |
| 36 | `copilot/ottablog-page-marketing-homepage` | 126 | YES | MAIN BETTER | #153 draft | NO (open PR #153 draft) | Review PR #153 draft — base feature in main; verify no un-merged delta, then close/delete. | Ottablog `page` type + DB-driven homepage (→ ottablog/otta-landing in main). |
| 37 | `neopc-nextjs-homepage-integrated` | 126 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add DB-backed homepage integration |
| 38 | `copilot/add-extensible-homepage-framework` | 127 | YES | MAIN BETTER | #149 draft | NO (open PR #149 draft) | Review PR #149 draft — base feature in main; verify no un-merged delta, then close/delete. | Homepage slot framework config panel (→ otta-landing in main). |
| 39 | `copilot/add-ai-chat-ui` | 127 | YES | MAIN BETTER | #150 draft | NO (open PR #150 draft) | Review PR #150 draft — base feature in main; verify no un-merged delta, then close/delete. | AI chat streaming/attachments/model switcher (→ ottaai in main). |
| 40 | `copilot/fix-chunk-load-error-homepage` | 127 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | fix(nextjs-homepage): use webpack build for opennext cloudflare chunk compatibility |
| 41 | `copilot/implement-security-audit-recommendations` | 129 | YES | MAIN BETTER | #144 draft | NO (open PR #144 draft) | Review PR #144 draft — base feature in main; verify no un-merged delta, then close/delete. | Auth roadmap + main merge (auth hardened in main). |
| 42 | `agentcursor/recent-pr-bugs-8afe` | 129 | YES | MAIN BETTER | #146 | NO (open PR #146) | Review PR #146 — base feature in main; verify no un-merged delta, then close/delete. | Bugfixes for StepsTool + dev email trap (old codebase). |
| 43 | `copilot/create-cli-with-animation` | 129 | YES | MAIN BETTER | #108 draft | NO (open PR #108 draft) | Review PR #108 draft — base feature in main; verify no un-merged delta, then close/delete. | CLI reconcile + main merge (→ cli/scripts in main). |
| 44 | `agentcursor/dependency-updates-plan-b040` | 133 | YES | MAIN BETTER | #145 | NO (open PR #145) | Review PR #145 — base feature in main; verify no un-merged delta, then close/delete. | Dependency vuln patches (superseded by current lockfile). |
| 45 | `copilot/add-gdpr-data-export-delete-workflow` | 134 | NO | NA (absent) | #143 draft | NO | Consider — GDPR data export + account deletion workflow. Compliance value for SaaS. | GDPR-style user data export and account-deletion workflow. |
| 46 | `neopc-TOTP-composer2` | 134 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | TOTP / 2FA Implementation |
| 47 | `neopc-mailtrap` | 134 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add stripHtml util and use in admin mail |
| 48 | `neopc-comments-package` | 142 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Enrich comments with user data; demo & API updates |
| 49 | `copilot/plan-npm-package-splitting` | 152 | YES | MAIN BETTER | #138 draft | NO (open PR #138 draft) | Review PR #138 draft — base feature in main; verify no un-merged delta, then close/delete. | Docs: NPM publishing strategy (planning). |
| 50 | `copilot/add-data-import-export-package` | 156 | NO | NA (absent) | #135 draft | NO | PORT — self-contained @ottabase/ottaport (CSV/JSON/TSV import+export for OttaORM). Common SaaS need. | Data import/export engine for OttaORM: CSV/JSON/TSV parse, field mapping, batched upserts, filtered exports, job history, optional R2. |
| 51 | `copilot/add-admin-ui-for-db-backups` | 156 | NO | NA (absent) | #132 draft | NO | PORT — self-contained @ottabase/backups (D1→R2 dumps, retention, /admin/backups UI). Fills an ops gap. | Automated D1→R2 SQL backup service: timestamped files, SHA-256 hashing, day/count retention, admin settings UI. |
| 52 | `agent-cur/development-environment-setup-df76` | 156 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix renderer crashes for all-blocks blog post |
| 53 | `copilot/implement-ottabase-search` | 156 | PARTIAL | MAIN DIFFERENT | #133 draft | NO | Evaluate vs main's @ottabase/spotlight — ottasearch is D1-backed data search (Cmd+K, Notion UI); spotlight is a command palette. May complement. | Hardening pass on @ottabase/ottasearch: query parsing, full reindex (removes partial-reindex limits). |
| 54 | `copilot/replace-native-alerts-confirmations` | 157 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Merge branch 'main' into copilot/replace-native-alerts-confirmations |
| 55 | `claude/recraft-ai-clone-BL5FL` | 157 | NO | NA (absent) | — | YES | Skip — experimental Recraft.ai image-gen clone; niche, no PR, not aligned with core. | Experimental Recraft.ai-style AI image generation clone. |
| 56 | `copilot/create-feature-roadmap` | 157 | YES | MAIN BETTER | #130 draft | NO (open PR #130 draft) | Review PR #130 draft — base feature in main; verify no un-merged delta, then close/delete. | Docs: 2-year roadmap (planning). |
| 57 | `copilot/replicate-youch-error-handling` | 157 | NO | NA (absent) | #119 draft | NO | Consider — @ottabase/error-page (Youch-style edge error pages). Nice DX; self-contained. | Youch-style pretty HTML error pages for edge runtimes: stack frames, dark/light, request metadata masking, cause chains, dev/prod modes. |
| 58 | `copilot/add-open-source-framework-support` | 157 | NO | NA (absent) | #101 draft | NO | Optional — OSS distribution tooling (manifest, create-app CLI, sync-tiers). Relevant if publishing as a template. | Open-source distribution tooling: package manifest, create-app CLI, tier-sync CLI. |
| 59 | `neopc-optimzie-workspace-deps` | 157 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Pin dependency versions across monorepo |
| 60 | `copilot/create-custom-agent-docs` | 157 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix formatting in agent instructions |
| 61 | `claude/rename-cropper-to-ui-cropper-xvLha` | 158 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Merge branch 'main' into claude/rename-cropper-to-ui-cropper-xvLha |
| 62 | `copilot/make-monorepo-flexible` | 158 | YES | MAIN BETTER | #121 | NO (open PR #121) | Review PR #121 — base feature in main; verify no un-merged delta, then close/delete. | Monorepo flexibility (note: PR aborted on unrelated histories). |
| 63 | `copilot/compare-monorepo-flexibility` | 158 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | fix: harden map url detection |
| 64 | `claude/shareable-monorepo-BvhnT` | 159 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Setup user-zone, dynamic routes & config fixes |
| 65 | `claude/add-cta-disclosure-plugins-uCBCN` | 159 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | feat(ottaeditor,ottarenderer): add CTA alignment, Disclosure plugin, enhance Layout |
| 66 | `claude/audit-readme-docs-OIMXB` | 160 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Harden cf-realtime broadcast example with authz (#122) |
| 67 | `copilot/sub-pr-117-again` | 160 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | docs: secure cf-realtime broadcast example |
| 68 | `copilot/add-map-and-layout-plugins` | 160 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add column clear UI and map type/embed handling |
| 69 | `copilot/sub-pr-117` | 163 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | docs(cf-realtime): add auth to broadcast endpoint examples, fix _GUIDE.md bugs |
| 70 | `copilot/add-animation-framework` | 164 | NO | NA (absent) | #114 draft | NO | Optional — @ottabase/motion (brand-kit-aware animation utilities via Motion.dev). No animation package in main. | Brand-kit-aware animation utilities: transition presets, React hooks/components powered by Motion.dev, driven by brand motion tokens. |
| 71 | `copilot/enhance-referral-username-setup` | 164 | YES | MAIN BETTER | #115 | NO (open PR #115) | Review PR #115 — base feature in main; verify no un-merged delta, then close/delete. | Referral enhancements: usernames, dedup, CSV export, vanity URLs (→ referrals in main; verify deltas). |
| 72 | `copilot/sub-pr-112-again` | 164 | YES | MAIN BETTER | #116 draft | NO (open PR #116 draft) | Review PR #116 draft — base feature in main; verify no un-merged delta, then close/delete. | Merge helper for PR #112 (ottalanding). |
| 73 | `copilot/add-referral-system-package` | 165 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Changes before error encountered |
| 74 | `claude/add-theme-system-IVo71` | 165 | YES | MAIN BETTER | #112 | NO (open PR #112) | Review PR #112 — base feature in main; verify no un-merged delta, then close/delete. | Ottalanding homepage themes (→ brand-engine / otta-landing in main). |
| 75 | `copilot/sub-pr-112` | 166 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | fix: landing admin select option typing |
| 76 | `claude/review-framework-improvements-D0njN` | 166 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add @ottabase/ottalanding package with semantic landing page system (#111) |
| 77 | `copilot/create-docs-package` | 166 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Address peer review: aria-label, aria-hidden, fix unused deps, README, code block IDs |
| 78 | `copilot/update-agents-documentation` | 166 | YES | MAIN BETTER | #110 draft | NO (open PR #110 draft) | Review PR #110 draft — base feature in main; verify no un-merged delta, then close/delete. | AGENTS.MD docs (main has its own AGENTS.MD). |
| 79 | `claude/analyze-dependency-consistency-CRP3G` | 168 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Optimize dependency catalog: 82 → 51 entries, remove Prisma fully |
| 80 | `claude/implement-split-pane-kH5Q7` | 168 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Address code review feedback for ui-split-pane package (#105) |
| 81 | `claude/create-notifications-package-F5VQq` | 168 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add comprehensive notifications enablement guide |
| 82 | `copilot/sub-pr-104` | 168 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Polish: clarify comment and fix toJSON in test helper |
| 83 | `claude/upgrade-mantine-03fxG` | 168 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix TypeScript errors, header rendering, and line number overlap in CodeBlock (#103) |
| 84 | `copilot/sub-pr-102` | 168 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Address PR review comments: fix imports, header rendering, line numbers, and TypeScript co |
| 85 | `copilot/add-review-plugin-ottaeditor` | 168 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add not-prose class to Review component |
| 86 | `claude/review-brand-kit-package-WEe3R` | 170 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Brand Kit inheritance + per-route token overrides |
| 87 | `copilot/ensure-cache-prefix-integrity` | 170 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Normalize import ordering across files |
| 88 | `codex/redesign-brand-kit-for-improved-ux` | 171 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Apply suggestions from code review |
| 89 | `copilot/implement-routing-system` | 173 | YES | MAIN BETTER | #96 draft | NO (open PR #96 draft) | Review PR #96 draft — base feature in main; verify no un-merged delta, then close/delete. | `framework` Router w/ grouping+middleware (→ ottarouter in main). |
| 90 | `claude/nextjs-opennext-cloudflare-DyMJK` | 173 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Apply brand theme on dark/light mode changes |
| 91 | `copilot/review-brand-engine-packages` | 173 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Improve layout validation, routing, and provider |
| 92 | `claude/increase-code-coverage-W6dLB` | 174 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | feat: implement comprehensive e2e testing with Playwright |
| 93 | `migration-destructive-actions-support` | 175 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Migration system: atomic destructive ops, parameterized queries, safer column handling (#9 |
| 94 | `copilot/sub-pr-92` | 175 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | feat: Add batch transactions, parameterized queries, and improved destructive migrations |
| 95 | `copilot/sub-pr-88-again` | 175 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Initial plan |
| 96 | `copilot/sub-pr-88` | 175 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Merge branch 'claude/create-notifications-package-F5VQq' into copilot/sub-pr-88 |
| 97 | `claude/ottabase-forms-complete-vQiqh` | 176 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix validation data usage, timezone handling, NaN checks, and type safety in OttaORM/Forms |
| 98 | `copilot/sub-pr-83-yet-again` | 176 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Remove trigger file |
| 99 | `copilot/sub-pr-83-another-one` | 176 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Initial plan |
| 100 | `copilot/sub-pr-83-again` | 176 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Initial plan |
| 101 | `copilot/sub-pr-83` | 176 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Initial plan |
| 102 | `neopc-admin-routes-and-first-run-case` | 177 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Refactor auth email_verified and date parsing |
| 103 | `claude/add-setup-wizard-jmH15` | 177 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Normalize timestamps to Unix ms across codebase |
| 104 | `claude/add-auth-feature-PyL7N` | 178 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add audit logging to all admin mutation routes |
| 105 | `claude/single-user-setup-hgD0u` | 178 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | feat: Single-founder super admin bootstrap + RBAC admin guards |
| 106 | `claude/implement-todos-HA64p` | 178 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Remove redundant constructors and unused imports |
| 107 | `neopc-theme-engine-enh` | 178 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | [WIP] Add configurable BrandLayout component for flexible layouts (#79) |
| 108 | `copilot/sub-pr-78` | 178 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Remove inline alpha from HSL color tokens to fix Tailwind compatibility |
| 109 | `claude/audit-codebase-quality-faBiF` | 178 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add comprehensive codebase audit report |
| 110 | `copilot/reimagine-theming-system` | 179 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | fix(security): bump wrangler from ^4.54.0 to ^4.59.1 to patch OS Command Injection vulnera |
| 111 | `copilot/improve-theme-engine` | 179 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Address code review: remove unnecessary undefined guard in cursor loop |
| 112 | `copilot/add-user-profile-editor` | 181 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix auth registration timestamps |
| 113 | `claude/add-rbac-audit-logging-G3MtS` | 181 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add useLocalStorage and slug util; UI fixes |
| 114 | `claude/add-ottaorm-ottaselect-cYrje` | 182 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Remove duplicate Post model - use existing ottablog Post model |
| 115 | `neopc-github-yml-cicd` | 183 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Update .github/workflows/deploy.yml |
| 116 | `claude/add-i18n-support-RwGJc` | 183 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Prevent duplicate detector; fix I18nProvider deps |
| 117 | `claude/improve-package-readmes-4TBBn` | 183 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | docs: Archive outdated Prisma-based D1 documentation |
| 118 | `neopc-worker-modularize` | 183 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Cloudflare worker modularization (#68) |
| 119 | `agent-cur/cloudflare-worker-modularization-1a51` | 183 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add PATCH and DELETE methods to CORS headers |
| 120 | `neopc-blog-plus-plus` | 184 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Merge branch 'neopc-blog-plus-plus' of https://github.com/thinkdj/ottabase into neopc-blog |
| 121 | `claude/create-logger-package-PsH2I` | 185 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Guard import.meta.env and performance.now |
| 122 | `claude/replace-native-dialogs-D6f0t` | 185 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix: Show error message when version deletion fails |
| 123 | `claude/merge-main-formatting-XtwKO` | 186 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | chore: merge main with formatting updates |
| 124 | `copilot/add-validation-to-ottaorm-package` | 186 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | chore: report progress |
| 125 | `claude/remove-post-model-2kl74` | 187 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix: Register OttaORM database connection at top of fetch handler |
| 126 | `copilot/sub-pr-60` | 187 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix: Revert ottaorm package exports to use compiled dist files instead of source files |
| 127 | `copilot/sub-pr-60-again` | 187 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix: Update Tag references to PostTag in ottablog README |
| 128 | `agent-cur/last-7-commits-issues-4612` | 187 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix PostTagLink.unlinkTag to delete by composite key |
| 129 | `agent-cur/monorepo-agents-guidance-597e` | 188 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | docs: Update and create package READMEs for AI agents |
| 130 | `agent-cur/monorepo-agents-guidance-b4c6` | 188 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Update AGENTS guide for packages and conventions |
| 131 | `claude/add-drop-table-alert-Pj0ls` | 189 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Improve Drop Table dialog UX with loading states and semantic HTML |
| 132 | `claude/new-ottabase-theme-LTNgO` | 189 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix TypeScript error: remove invalid letterSpacing from heading sizes |
| 133 | `claude/fix-deploy-cleanup-4B72A` | 190 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix cleanup preview worker - install wrangler with npm directly |
| 134 | `claude/add-theme-zoom-state-7BuKn` | 190 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Export missing types from @ottabase/state package |
| 135 | `claude/optimize-config-state-rOBjm` | 190 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add BlogSeries and BlogPostVersion to entities array |
| 136 | `claude/separate-cron-package-MUadp` | 192 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Implement atomic SQL locking for scheduler |
| 137 | `claude/add-queue-package-mAuuB` | 196 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Clean up queue code and add missing stats to Admin UI |
| 138 | `claude/email-package-templates-bJf4n` | 197 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add Nodemailer provider for local email testing with HELO |
| 139 | `copilot/create-pr-preview-workflow` | 198 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | ci: generate preview worker names dynamically |
| 140 | `cloudflare-worker-modular` | 198 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Refactor Cloudflare worker to modular handler |
| 141 | `copilot/rename-ui-presets-non-corporate` | 198 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix aurora violet palette values |
| 142 | `claude/referral-system-LY8Go` | 199 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Replace alert/confirm with shadcn UI components, add pagination |
| 143 | `claude/update-package-readmes-VhjKq` | 201 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Standardize package READMEs with concise format and practical examples |
| 144 | `claude/file-upload-package-75l9h` | 201 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Update README and add comprehensive vitest tests for ottaupload |
| 145 | `claude/monorepo-automated-testing-WLzxP` | 201 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Refactor and improve test setup and registry usage |
| 146 | `claude/upgrade-react-nextjs-EWLfs` | 203 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Upgrade React to 19.2.3 and standardize dependency management |
| 147 | `claude/fix-tanstack-auth-wrH3J` | 203 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add Windows build scripts and instructions |
| 148 | `claude/shortlink-management-system-JfGlA` | 204 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Update apps/ottabase-template-app-tanstack/src/pages/shortlinks/components/ShortlinkForm.t |
| 149 | `claude/auth-tanstack-implementation-eKBlI` | 204 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Update packages/auth/src/backend-handler.ts |
| 150 | `auth-package-implementation-tanstack` | 205 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Integrate production-ready auth system |
| 151 | `auth-minipc` | 205 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Update package.json |
| 152 | `copilot/fix-routing-issue-on-refresh` | 209 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | refine spa html fallback handling |
| 153 | `claude/redesign-themes-fix-routing-9dy0M` | 210 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Redesign themes and fix SPA routing |
| 154 | `claude/setup-ui-build-TLNbV` | 210 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add react-hook-form and zod to tanstack app dependencies |
| 155 | `claude/add-missing-shadcn-packages-1Stki` | 210 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Update Next.js from 16.0.7 to 16.1.1 to fix deprecation warning |
| 156 | `copilot/optimize-fouc-and-chunking` | 210 | YES | MAIN BETTER | #34 draft | NO (open PR #34 draft) | Review PR #34 draft — base feature in main; verify no un-merged delta, then close/delete. | Build: FOUC prevention + chunking (superseded build). |
| 157 | `claude/fix-websocket-image-info-7uIqo` | 212 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Move ErrorBoundary to app root, improve error toasts |
| 158 | `claude/automate-ottaorm-migrations-X1V9g` | 213 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | fix: Clean up remaining merge conflict markers in runtime-generator.ts |
| 159 | `copilot/optimize-build-chunking` | 213 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | chore: update baseline mapping and bundle config |
| 160 | `claude/plan-monorepo-packages-DpJIb` | 214 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | feat(forms): Improve forms with validation, uploads, and error handling |
| 161 | `claude/update-all-readmes-xXNYx` | 214 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | docs: Update and consolidate all README files for consistency |
| 162 | `claude/refactor-worker-apis-MbVq2` | 214 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Merge main: integrate generic CRUD handler with modular architecture |
| 163 | `claude/fix-cloudflare-url-display-YSAYB` | 214 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Rename account name variables to worker subdomain for clarity |
| 164 | `claude/fix-queue-display-Glx4e` | 214 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix queue messages not displaying in demo UI |
| 165 | `claude/tanstack-db-optimization-ngWZm` | 214 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Update packages/ottaorm/src/crud/index.ts |
| 166 | `claude/update-deploy-config-CgY9h` | 214 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix: Use 'vite build' instead of 'vinxi build' in docs |
| 167 | `claude/rename-assets-binding-Ba8KM` | 215 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Rename ASSETS binding to OBCF_ASSETS for consistency |
| 168 | `claude/fix-deploy-workflow-hLSte` | 216 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix deploy workflow: use compact JSON output in jq filter |
| 169 | `claude/add-localflare-package-vUkgL` | 216 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Move wrangler and localflare to pnpm catalog |
| 170 | `claude/conditional-deployment-changes-MCTa8` | 216 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add conditional deployment based on file changes |
| 171 | `claude/fix-cicd-deploy-SsN1i` | 216 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix CI/CD build tools verification |
| 172 | `claude/fix-tanstack-refresh-routing-TNS1T` | 216 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Update apps/ottabase-template-app-tanstack/vite.config.ts |
| 173 | `claude/setup-monorepo-testing-l2xSV` | 216 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add comprehensive testing infrastructure for monorepo |
| 174 | `claude/update-deploy-tanstack-ACIAd` | 216 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add TanStack template deployment configuration |
| 175 | `copilot/fix-vite-cjs-deprecation` | 217 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add slug generation when creating posts to fix missing required field |
| 176 | `claude/migrate-tanstack-template-YGZLm` | 217 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add API proxy and improved dev scripts for TanStack template |
| 177 | `tanstack-base` | 217 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Generate UUID for id if missing during model creation |
| 178 | `copilot/setup-migrations-codebase-first` | 217 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | feat: implement Drizzle Option 2 (codebase first) with drizzle-kit push |
| 179 | `copilot/update-tanstack-template-app` | 217 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | fix: Address code review comments for theme.mantine.ts and Todo model |
| 180 | `copilot/verify-tanstack-template-app` | 220 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Clean up temporary files and add to gitignore |
| 181 | `copilot/fix-worker-build-errors` | 221 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Refactor CI build scripts based on code review feedback |
| 182 | `2025-12-17-NeoPC-before-xmas-tvm` | 231 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add intelligent Cloudflare auto-setup and env var substitution |
| 183 | `copilot/fix-turbo-build-cache-issues` | 236 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Update build scripts to include transitive dependencies with ... filter |
| 184 | `copilot/setup-cicd-for-cloudflare` | 236 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | docs: consolidate deployment guides - merge HOWTO_DEPLOY.MD into CLOUDFLARE_DEPLOY.md |
| 185 | `copilot/add-timezone-standardization-package` | 236 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add preset format functions for common date/time display patterns |
| 186 | `feat-auth-nextauth` | 238 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add Auth.js integration and demo to template app |
| 187 | `feat-migrate-cli` | 238 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Migrate: package (cli) |
| 188 | `claude/fix-cloudflare-deploy-01WWwDU82dpBa4rxrvYoNsDy` | 254 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix Cloudflare deploy CI/CD configuration |
| 189 | `copilot/add-ci-cd-for-cloudflare-workers` | 258 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add explicit permissions to GitHub Actions workflow for security |
| 190 | `claude/cloudflare-scheduler-package-01DBUcBvVpfntEjph96ifmyW` | 258 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Fix scheduler issues and add critical optimizations |
| 191 | `claude/create-ottabase-docs-package-015cm7QDQn2mKurCta8E4S9T` | 258 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Enhance @ottabase/docs with comprehensive features |
| 192 | `claude/add-env-config-package-017MRLjDfm8FZ58sptuMEaZg` | 259 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add @ottabase/env package for type-safe environment variable management |
| 193 | `claude/ottasearch-package-01TzYBAGq6SvcRYqEX515w5Z` | 259 | PARTIAL | MAIN DIFFERENT | — | NO | Evaluate vs main's spotlight (see PR #133). Universal D1 search component; overlaps command palette but not identical. | Original @ottabase/ottasearch: universal D1-backed search, Notion-like UI, keyboard nav, flexible display modes. |
| 194 | `claude/add-ui-icons-package-011CUfJTBhUsmKrRJq3B3qeH` | 260 | NO | NA (absent) | — | YES | Optional/low — @ottabase/ui-icons (unified Lucide+Tabler). main consumes icon libs directly; convenience only. | Unified icon package exposing Lucide + Tabler through one dependency. |
| 195 | `claude/review-cloudflare-workflows-011CUrmQomzhy1Fm7Kz7WyDc` | 260 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add executive testing summary answering all questions |
| 196 | `claude/update-shadcn-components-011CUpfuKV1TPsgBoD5EChe3` | 260 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add missing shadcn/ui components and complete component library |
| 197 | `claude/add-auditlog-package-019CCyMdmibU7NFHKdWpWym7` | 260 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add @ottabase/auditlog package |
| 198 | `claude/cf-realtime-pubsub-package-011CUjCALkngDWZ3FYLzrHr7` | 271 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | :x erge branch 'main' of https://github.com/thinkdj/ottabase into claude/cf-realtime-pubs |
| 199 | `claude/create-ottalayout-package-011CUbGugBiEjxp1doWY6tTf` | 272 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add OttaLayout demo page with interactive preset switcher |
| 200 | `claude/ottabase-models-package-011CUfGRbSSmMKmZ7BTBwpyY` | 272 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Update tsconfig.json to include all new packages from main |
| 201 | `claude/create-cf-framework-package-011CUngQSFr9GrG36ozXfnoK` | 273 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add KV-based rate limiting simulation for local dev |
| 202 | `claude/mantine-providers-setup-011CUheyP1ZCs7en1MquHFSu` | 276 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Add MantineThemeSwitcher component and enhance Mantine integration |
| 203 | `claude/cf-ratelimiter-package-011CUeDi4soS4zG9W1a1wt2W` | 277 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Integrate cf-ratelimiter into ottabase-template-app |
| 204 | `claude/create-ui-fonts-package-011CUeCmNgaPZCiGjLevDijm` | 277 | NO | NA (absent) | — | YES | Optional/low — @ottabase/ui-fonts (centralized font config). main keeps fonts in ui-base; convenience only. | Centralized, type-safe font management: CSS custom props, pre-configured Google Fonts. |
| 205 | `claude/cloudflare-data-layer-011CUawPGpyxSxZZPjZ4qwKK` | 279 | YES | MAIN BETTER | — | YES | No — superseded by rewritten/consolidated main. | Enable dual-mode support for @ottabase/db (Standalone + Cloudflare) |
