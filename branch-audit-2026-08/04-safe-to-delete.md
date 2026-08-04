# Safe to Delete

**176 branches** are safe to delete: **174** feature branches whose work is already in `main` (or is low-value), plus
**2** Dependabot branches. None of these has an open PR **except** the two Dependabot PRs (which you asked to mark safe
anyway).

> Verify against your own risk tolerance before bulk-deleting. Deletion is reversible only while the ref still exists on
> a fork/reflog, so consider tagging first if unsure:
> `git tag archive/<branch> origin/<branch>` for anything you want a recoverable pointer to.

## Dependabot (2) — ignored per request, mark safe

These are dependency bumps with open PRs (#220, #221). Either merge them, or close the PRs and let Dependabot re-roll.

```bash
git push origin --delete dependabot/npm_and_yarn/hookform/resolvers-5.5.7
git push origin --delete dependabot/npm_and_yarn/testing-library/jest-dom-7.0.0
```

## NOT in this list (do **not** bulk-delete)

The 29 preserve/review branches — the 27 non-dependabot open PRs plus `pc-payport` and the original `ottasearch`
package branch — are excluded. See [`01-port-candidates.md`](./01-port-candidates.md) and
[`02-open-prs.md`](./02-open-prs.md).

---

## The 174 feature branches — delete commands

Copy-paste to remove them all from `origin`. (Alphabetical.)

```bash
git push origin --delete 2025-12-17-NeoPC-before-xmas-tvm
git push origin --delete agent-cur/cloudflare-worker-modularization-1a51
git push origin --delete agent-cur/development-environment-setup-df76
git push origin --delete agent-cur/last-7-commits-issues-4612
git push origin --delete agent-cur/monorepo-agents-guidance-597e
git push origin --delete agent-cur/monorepo-agents-guidance-b4c6
git push origin --delete auth-minipc
git push origin --delete auth-package-implementation-tanstack
git push origin --delete claude/add-auditlog-package-019CCyMdmibU7NFHKdWpWym7
git push origin --delete claude/add-auth-feature-PyL7N
git push origin --delete claude/add-cta-disclosure-plugins-uCBCN
git push origin --delete claude/add-drop-table-alert-Pj0ls
git push origin --delete claude/add-env-config-package-017MRLjDfm8FZ58sptuMEaZg
git push origin --delete claude/add-i18n-support-RwGJc
git push origin --delete claude/add-localflare-package-vUkgL
git push origin --delete claude/add-missing-shadcn-packages-1Stki
git push origin --delete claude/add-ottaorm-ottaselect-cYrje
git push origin --delete claude/add-queue-package-mAuuB
git push origin --delete claude/add-rbac-audit-logging-G3MtS
git push origin --delete claude/add-setup-wizard-jmH15
git push origin --delete claude/add-theme-zoom-state-7BuKn
git push origin --delete claude/add-ui-icons-package-011CUfJTBhUsmKrRJq3B3qeH
git push origin --delete claude/analyze-dependency-consistency-CRP3G
git push origin --delete claude/audit-codebase-quality-faBiF
git push origin --delete claude/audit-readme-docs-OIMXB
git push origin --delete claude/auth-tanstack-implementation-eKBlI
git push origin --delete claude/automate-ottaorm-migrations-X1V9g
git push origin --delete claude/cf-ratelimiter-package-011CUeDi4soS4zG9W1a1wt2W
git push origin --delete claude/cf-realtime-pubsub-package-011CUjCALkngDWZ3FYLzrHr7
git push origin --delete claude/cf-workers-routing-package-tvqop7
git push origin --delete claude/cloudflare-data-layer-011CUawPGpyxSxZZPjZ4qwKK
git push origin --delete claude/cloudflare-scheduler-package-01DBUcBvVpfntEjph96ifmyW
git push origin --delete claude/code-review-analysis-ox54hr
git push origin --delete claude/conditional-deployment-changes-MCTa8
git push origin --delete claude/create-cf-framework-package-011CUngQSFr9GrG36ozXfnoK
git push origin --delete claude/create-logger-package-PsH2I
git push origin --delete claude/create-notifications-package-F5VQq
git push origin --delete claude/create-ottabase-docs-package-015cm7QDQn2mKurCta8E4S9T
git push origin --delete claude/create-ottalayout-package-011CUbGugBiEjxp1doWY6tTf
git push origin --delete claude/create-ui-fonts-package-011CUeCmNgaPZCiGjLevDijm
git push origin --delete claude/custom-auth-review-rksrw1
git push origin --delete claude/docs-audit-updates-xs095m
git push origin --delete claude/editorjs-plugins-theme-vars-qt0v05
git push origin --delete claude/email-package-templates-bJf4n
git push origin --delete claude/file-upload-package-75l9h
git push origin --delete claude/fix-cicd-deploy-SsN1i
git push origin --delete claude/fix-cloudflare-deploy-01WWwDU82dpBa4rxrvYoNsDy
git push origin --delete claude/fix-cloudflare-url-display-YSAYB
git push origin --delete claude/fix-deploy-cleanup-4B72A
git push origin --delete claude/fix-deploy-workflow-hLSte
git push origin --delete claude/fix-queue-display-Glx4e
git push origin --delete claude/fix-tanstack-auth-wrH3J
git push origin --delete claude/fix-tanstack-refresh-routing-TNS1T
git push origin --delete claude/fix-websocket-image-info-7uIqo
git push origin --delete claude/implement-split-pane-kH5Q7
git push origin --delete claude/implement-todos-HA64p
git push origin --delete claude/improve-package-readmes-4TBBn
git push origin --delete claude/increase-code-coverage-W6dLB
git push origin --delete claude/mantine-providers-setup-011CUheyP1ZCs7en1MquHFSu
git push origin --delete claude/marketing-md-docs-h94a9j
git push origin --delete claude/merge-main-formatting-XtwKO
git push origin --delete claude/migrate-tanstack-template-YGZLm
git push origin --delete claude/modernize-package-ui-uugwot
git push origin --delete claude/monorepo-automated-testing-WLzxP
git push origin --delete claude/new-ottabase-theme-LTNgO
git push origin --delete claude/nextjs-opennext-cloudflare-DyMJK
git push origin --delete claude/optimize-config-state-rOBjm
git push origin --delete claude/ottabase-custom-auth-je4gzb
git push origin --delete claude/ottabase-forms-complete-vQiqh
git push origin --delete claude/ottabase-models-package-011CUfGRbSSmMKmZ7BTBwpyY
git push origin --delete claude/ottabase-startup-ideas-gm4y1j
git push origin --delete claude/plan-monorepo-packages-DpJIb
git push origin --delete claude/platform-owner-permissions-46ohva
git push origin --delete claude/recraft-ai-clone-BL5FL
git push origin --delete claude/redesign-themes-fix-routing-9dy0M
git push origin --delete claude/refactor-worker-apis-MbVq2
git push origin --delete claude/referral-system-LY8Go
git push origin --delete claude/remove-post-model-2kl74
git push origin --delete claude/rename-assets-binding-Ba8KM
git push origin --delete claude/rename-cropper-to-ui-cropper-xvLha
git push origin --delete claude/replace-native-dialogs-D6f0t
git push origin --delete claude/review-brand-kit-package-WEe3R
git push origin --delete claude/review-cloudflare-workflows-011CUrmQomzhy1Fm7Kz7WyDc
git push origin --delete claude/review-framework-improvements-D0njN
git push origin --delete claude/saas-framework-audit-rct5hc
git push origin --delete claude/separate-cron-package-MUadp
git push origin --delete claude/setup-monorepo-testing-l2xSV
git push origin --delete claude/setup-ui-build-TLNbV
git push origin --delete claude/shareable-monorepo-BvhnT
git push origin --delete claude/sharp-galileo-wHDI6
git push origin --delete claude/shortlink-management-system-JfGlA
git push origin --delete claude/single-user-setup-hgD0u
git push origin --delete claude/solidify-org-flow-TL3c2
git push origin --delete claude/tanstack-db-optimization-ngWZm
git push origin --delete claude/update-all-readmes-xXNYx
git push origin --delete claude/update-deploy-config-CgY9h
git push origin --delete claude/update-deploy-tanstack-ACIAd
git push origin --delete claude/update-package-readmes-VhjKq
git push origin --delete claude/update-shadcn-components-011CUpfuKV1TPsgBoD5EChe3
git push origin --delete claude/upgrade-mantine-03fxG
git push origin --delete claude/upgrade-react-nextjs-EWLfs
git push origin --delete cloudflare-worker-modular
git push origin --delete codex/redesign-brand-kit-for-improved-ux
git push origin --delete copilot/add-ci-cd-for-cloudflare-workers
git push origin --delete copilot/add-map-and-layout-plugins
git push origin --delete copilot/add-referral-system-package
git push origin --delete copilot/add-review-plugin-ottaeditor
git push origin --delete copilot/add-timezone-standardization-package
git push origin --delete copilot/add-user-profile-editor
git push origin --delete copilot/add-validation-to-ottaorm-package
git push origin --delete copilot/analyze-test-coverage
git push origin --delete copilot/check-repo-history-for-secrets
git push origin --delete copilot/compare-monorepo-flexibility
git push origin --delete copilot/create-custom-agent-docs
git push origin --delete copilot/create-docs-package
git push origin --delete copilot/create-launch-plan-new-detailed-46
git push origin --delete copilot/create-pr-preview-workflow
git push origin --delete copilot/create-roadmap-and-plugins
git push origin --delete copilot/ensure-cache-prefix-integrity
git push origin --delete copilot/fix-chunk-load-error-homepage
git push origin --delete copilot/fix-routing-issue-on-refresh
git push origin --delete copilot/fix-stale-organization-id
git push origin --delete copilot/fix-turbo-build-cache-issues
git push origin --delete copilot/fix-usergroups-ottaworm
git push origin --delete copilot/fix-vite-cjs-deprecation
git push origin --delete copilot/fix-worker-build-errors
git push origin --delete copilot/improve-theme-engine
git push origin --delete copilot/modify-admin-listing-changelogs
git push origin --delete copilot/optimize-build-chunking
git push origin --delete copilot/reimagine-theming-system
git push origin --delete copilot/rename-template-apps
git push origin --delete copilot/rename-ui-presets-non-corporate
git push origin --delete copilot/replace-native-alerts-confirmations
git push origin --delete copilot/review-brand-engine-packages
git push origin --delete copilot/setup-cicd-for-cloudflare
git push origin --delete copilot/setup-migrations-codebase-first
git push origin --delete copilot/sub-pr-102
git push origin --delete copilot/sub-pr-104
git push origin --delete copilot/sub-pr-112
git push origin --delete copilot/sub-pr-117
git push origin --delete copilot/sub-pr-117-again
git push origin --delete copilot/sub-pr-60
git push origin --delete copilot/sub-pr-60-again
git push origin --delete copilot/sub-pr-78
git push origin --delete copilot/sub-pr-83
git push origin --delete copilot/sub-pr-83-again
git push origin --delete copilot/sub-pr-83-another-one
git push origin --delete copilot/sub-pr-83-yet-again
git push origin --delete copilot/sub-pr-88
git push origin --delete copilot/sub-pr-88-again
git push origin --delete copilot/sub-pr-92
git push origin --delete copilot/update-cloudflare-scripts-generic
git push origin --delete copilot/update-tanstack-template-app
git push origin --delete copilot/verify-tanstack-template-app
git push origin --delete fable-opus-auth-route-hardening
git push origin --delete feat-auth-nextauth
git push origin --delete feat-migrate-cli
git push origin --delete migration-destructive-actions-support
git push origin --delete neopc-TOTP-composer2
git push origin --delete neopc-admin-routes-and-first-run-case
git push origin --delete neopc-blog-plus-plus
git push origin --delete neopc-comments-package
git push origin --delete neopc-github-yml-cicd
git push origin --delete neopc-mailtrap
git push origin --delete neopc-nextjs-homepage-integrated
git push origin --delete neopc-optimzie-workspace-deps
git push origin --delete neopc-organization-flow-plus-plus
git push origin --delete neopc-theme-engine-enh
git push origin --delete neopc-worker-modularize
git push origin --delete pc-fable-opus-fixes
git push origin --delete pc-platform-owner
git push origin --delete pc-upp-theme
git push origin --delete pc-usergroups
git push origin --delete tanstack-base
```

---

## Delete local tracking refs too (optional)

After deleting remotes, prune your local view:

```bash
git fetch --all --prune
```
