# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (Unreleased)

- `@ottabase/kernel`: the package contract. One manifest (`definePackage`) declares a package's tables, migrations,
  models, RLS policies, routes, cron and queue handlers, event subscriptions, nav, env and health;
  `createPackageRegistry` collects a list of them once and throws at boot on a duplicate key, table export, cron name or
  queue job type. `mountPackages`, `runHealth`, `applyPackageLifecycle` (install/upgrade with a KV record) and the
  client half (`@ottabase/kernel/client`: `definePackageClient`, `installedPackages`, `packageAdminPages`).
- `@ottabase/events`: a typed in-process event bus with queue fan-out. `emit()` runs inline subscribers now and
  dispatches one `events:deliver` job for `via: 'queue'` subscribers (inline when there is no queue); a throwing
  subscriber is reported and counted, never propagated; `defer()` hands slow work to `waitUntil` when offered.
- Manifests for the built-in packages: `createShortlinksPackage`, `createReferralsPackage`, `createCommentsPackage`,
  `createOttalandingPackage` (with its policies), `createOttablogPackage({ mode })` (org-mode migrations, suppressed
  indexes and policies) and `@ottabase/ottaai/manifest` `createOttaaiPackage({ strategy })` (table, model, policy).
- `@ottabase/apikeys`: API keys for an app's own customers. Hashed at rest (SHA-256), a recognisable prefix, scopes,
  expiry, revocation, `lastUsedAt` written back at most once a minute, `authenticate(request, env, { scopes })` reading
  `Authorization: Bearer` or `X-Api-Key` (401/403), an `afterVerify` hook for a per-key rate limit, and self-service
  routes under `/api/keys` (personal and organization keys). Listed in otta-web.
- `@ottabase/flags`: entitlements as a core package. Plans with features and limits, `resolvePlan` for whatever the host
  knows (a payport license, a column), operator overrides in `flag_overrides` (plan, feature, limit; app, org or user
  scope; expiring), `requireFeature`/`requireLimit` guards answering 402 `UPGRADE_REQUIRED`, `/api/flags/me` and the
  override routes, and a fail-closed client gate (`@ottabase/flags/react`: `usePlan`, `useFeature`, `PlanGate`).
- `@ottabase/meter`: usage credits as a core package. A balance per (tenant, meter) in `meter_balances`, consumed by one
  conditional D1 `UPDATE` (no read-then-write), with periods, `grant`/`topUp`/`reset`/`refund`, a `meter_usage` ledger
  pruned by `meter:prune-usage`, `requireCredits` answering 402 `CREDITS_EXHAUSTED` with `X-Remaining-Credits`, and
  `/api/meter` routes. Both are listed in otta-web's package list.
- `@ottabase/postmaster`: the half of email that is not sending. Inbound mail for Cloudflare Email Routing
  (`createInboundEmailHandler` parses the raw message with postal-mime into plain data, plus-address tag included, and
  rejects unknown mailboxes at SMTP time), a suppression list in `email_suppressions` (`*` for never, a list name for
  one unsubscribe; `suppressions.guard(mailer)` drops suppressed recipients), signed stateless one-click unsubscribe
  links with RFC 8058 headers, and Resend (Svix-signed) and SES/SNS bounce and complaint webhooks under
  `/api/email/hooks` that record hard bounces and complaints. otta-web lists it and exports the Worker's `email()`
  handler, which puts every inbound message on the bus as `email.inbound`.
- otta-web: `GET /api/admin/health` (platform admin) runs every package's required-env check and health probe;
  `ensurePackageSchedules` seeds a `scheduled_tasks` row for every cron contribution that declares a `schedule`.

### Changed (Unreleased)

- **Packages are installed by listing their manifest in `apps/otta-web/ottabase/packages.ts`**, nothing else. The four
  hand-wired files are gone (`config.migrations.ts`, `config.routes.ts`, `config.premium.ts`,
  `src/ottabase/config/premium.ts`); `db-utils`, the router, the cron and queue registries, the schema collector, the
  admin nav and the client router all read the registry. The app's own tables, routes and jobs are a package too
  (`ottabase/packages/app.ts`), as are core housekeeping (`core.ts`) and Brand Engine persistence.
- `@ottabase/premium`: a Premium Package is a kernel manifest plus licensing (`PremiumPackage extends OttaPackage`,
  `premium: true`). `routes.build(host)` receives the package host (`premiumRegistryOf(host)` for gates);
  `mountPremiumPackages(router, registry, { packages })`; the `collectPremium*` helpers and the registry's
  `tables()/migrations()/models()/policies()/nav()` moved to the kernel registry. `isPremiumPackage` narrows a list.
- `@ottabase/config`: `packages`, `customPackages`, `BuiltInPackageName`, `isPackageEnabled`, `isCustomPackageEnabled`
  and the `OTTABASE_PKG_*` env toggles are removed; a package is installed when it is listed. `OTTABLOG_MODE` and
  `OTTAAI_STRATEGY` env overrides are removed too: both decide migrations and RLS policies, so they are values in
  `ottabase.config.ts` only.
- otta-web: `handleCustomRoutes` is gone (custom routes are app-package routes);
  `getAiConfigSnapshot(env, { installed })` takes the installed flag from the admin route; the shortlink fallback and
  the blog HTML injections are gated by the worker entry (`packages.has(...)`), not inside the libraries; referral
  attribution on sign-up follows `features.referrals.enabled`.

- otta-web: `audit_logs` retention. `AuditLog.pruneOlderThan(days, appId)` (the app's own rows plus unowned rows) and a
  seeded daily scheduled task (`audit:prune`, 03:17 UTC, payload `{"olderThanDays": 90}`) created by `/api/ottaorm/init`
  and the bootstrap seed step, after the default roles; edit or pause it in the Cron admin.
- otta-web: server code reads the app id from `getOttabaseConfig(env).appId` everywhere; the hand-rolled
  `env.APP_ID ?? 'otta-web'` fallbacks in bootstrap, init and registration are gone.
- otta-web: `worker/lib/__tests__/tenant-isolation.test.ts` runs the real `getSecurityContext` into the real RLS engine
  (only D1 stubbed): member scoping, forged `x-org-id`, stale session org, anonymous callers, cross-org writes, and a
  hand-built context without membership.
- otta-web queue DLQ: entries are keyed by job id (`queue:dlq:<jobId>`), so lookup, retry and delete are one KV read
  instead of listing up to 1000 keys. Listings are ordered by `failedAt` per page.
- `@ottabase/ottaorm`: removed the Auth.js adapter leftovers `Session`/`sessions` and `Authenticator`/`authenticators`
  (model, schema, core migration, RLS policy, app registration). Nothing read or wrote them: a session is a signed
  cookie plus a KV registry entry, and there is no passkey support. Also removed core migrations
  `003_create_posts_table` and `005_create_post_tags_table`, which predate `Post` moving to `@ottabase/ottablog` and
  only created stray tables when the blog was disabled.
- **otta-web Worker type-checks are green** (`tsconfig.worker.json`, `tsconfig.worker-test.json`), still without the DOM
  lib. Browser code no longer reaches the Worker program:
    - `@ottabase/auth/config` declares `SocialProvider` itself instead of type-importing it from the button component.
    - `useMediaLightboxUrlSync` moved from the `@ottabase/medialibrary` root to `@ottabase/medialibrary/react`.
    - New `@ottabase/brand-engine/dom` subpath holds `applyBrandTheme`, `injectFont` and `upsertStyleElement`; the root
      keeps the pure CSS builders the edge uses.
    - `drawShareCard` / `wrapLines` (canvas) moved from the `@ottabase/ottalanding` root to
      `@ottabase/ottalanding/react`.
    - Worker tsconfigs use `@cloudflare/workers-types/2023-07-01`, matching the 2024-12-30 compatibility date (the bare
      entrypoint models 2021, where `FormData.get` returned only strings).
    - Plain `crypto` replaces `globalThis.crypto` guards in ottaorm and ottaai (every supported runtime has Web Crypto;
      the unused `NO_WEB_CRYPTO` error code is gone).
    - The premium client/server wiring test gets its own `type-check:wiring-test` target (DOM + Workers types); it
      imports both sides by design. Entry-boundary tests added for medialibrary, brand-engine and ottalanding.
- **Removed backward-compatibility code** (pre-launch: every install starts on the current version):
    - `@ottabase/ottablog`: the old single-category `posts.category_id` column, `Post.byCategory()` and the
      `categoryName`/`categorySlug` enrichment (categories live in `post_category_links`); the one-shot
      `ottablogMigrations` (orphan cleanup, old translation index drop); the `BlogRenderer` type re-export.
      `Post.delete()` is documented as the translation cascade it actually is (auto-init emits no foreign keys).
    - `@ottabase/brand-engine`: the stored `tokensJson` `colors`→`color` fallback, the unused `resolveModeValue`, and
      the `--motion-ease-bouncy` alias (use `--ease-spring`). `@ottabase/brand-engine-react`: the unused `mode` field.
    - `@ottabase/ottalayout`: `contentWidth` `'fixed'`/`'fluid'` (use `'md'`/`'lg'`); built-in themes converted.
    - `@ottabase/utils/user` (use `getInitials` from `@ottabase/utils/string`); `@ottabase/medialibrary/schema` (use
      `mediaTable` from `@ottabase/ottaorm`); the RBAC `tenantId` alias of `organizationId`; per-component type
      re-exports in `@ottabase/forms`; `ShortlinksListResponse`; `JsonEditorDefault`; the ottaai `secretAliasInput`
      fallback.
    - otta-web: the `spacious` email template alias, the no-op `ThemeContext.setTheme`, `ThemeSwitcher` and
      `theme.loader`, the `/admin/appearance/theme-generator` and changelog editor redirect routes, and zero-consumer
      `config.loader` exports. Cloudflare Images reads only `CF_IMAGES_ACCOUNT_ID` / `CF_IMAGES_API_TOKEN` (the
      `CLOUDFLARE_API_TOKEN` fallback is gone).

- **Landing site is now database-backed and edited in the admin.** New built-in package `@ottabase/ottalanding`:
    - Typed landing content in D1: `landing_sites` (one row per app) and `landing_pages` (path, metadata, ordered
      sections).
    - A section catalog: hero, logos, features, testimonials, pricing, FAQ, CTA and text.
    - Three themes (Launch, Editorial, Bold), each a Brand Engine preset plus its own layout. Switching theme never
      touches content.
    - Each section shape is declared once as field descriptors. These derive its TypeScript type, its Zod validation
      (shared by server and browser) and the admin form.

    otta-web:
    - Platform admins edit the site at `/admin/content/landing`: a theme picker with live previews, a pages list, site
      settings, and a page editor with add/reorder/remove sections, field-level errors and a live preview of the draft.
    - Admin API at `/api/landing` (platform admin only). Generic CRUD stays default-denied, with a defensive RLS policy.
    - `/api/ottaorm/init` seeds a starter site.

    `apps/otta-landing` is now a read-only renderer of the same D1:
    - binds `OBCF_D1`, shares otta-web's local wrangler state in dev, and selects content by `APP_ID`
    - server-renders theme tokens on first paint, including a visitor light/dark switch in every theme (choice
      remembered and applied before paint; the admin preview can show either mode)
    - renders a themed 404 and a setup notice before the first migration
    - only production is indexable (`noindex` elsewhere); canonical and Open Graph URLs come from the site's public URL
    - exactly one `<h1>` per page, and hero images take an image description for `alt`

    Stored site settings are read field by field, so one value that no longer fits falls back on its own instead of
    reverting the whole site; the public URL accepts only a full `http(s)://` address. The admin asks before leaving the
    page editor or site settings with unsaved changes. Housekeeping: `cloudflare-env.d.ts` (now declares `IMAGES`), the
    landing app's `app/` and `lib/` are under the server lint rules, and the stale `.env.example`, `.eslintrc.json` and
    Mantine PostCSS plugins are removed.

    The slot/variant configurator, per-visitor localStorage choices, preview routes, legacy components and
    `config/brand.config.ts` are removed. So is the orphaned `packages/homepage-contract` README (that package had no
    source).

- **RBAC: authorization is permission + scope, never role NAME.** Admin gates no longer trust the role names
  `owner`/`admin`/`platform_owner`. A role is now purely a bundle of permissions; every gate asks "does a grant **at the
  required scope** carry the required permission." Two capabilities:
    - **Platform admin** (SaaS control plane) = a **system-scoped** (`organization_id = 'system'`) grant carrying
      `platform:admin` (or `*:*`). Only `platform_owner` has it, via the bootstrap.
    - **Org admin** (own tenant) = an **org-scoped** grant carrying `org:admin`, held by `owner`/`admin`.

    `assertAdmin` now derives `systemAllowed` from `context.systemPermissions` (`platform:admin`) and `orgAllowed` from
    `org:admin`; the old `hasAdminRole` (name match) is deleted. RLS `RLSPolicies.AdminOnly()` now sets
    `requirePlatformAdmin` and the engine checks the scope-aware `SecurityContext.platformAdmin` instead of role names.
    **Why:** every self-registered user receives the RBAC role _named_ `owner` in their personal organization, so
    name-based gates let any signup reach `/admin` (and, on a stale DB, the whole platform). Keying on a system-scoped
    `platform:admin` grant makes the boundary real and immune to role renames or tenant-created role-name collisions.

- **RBAC: role permission sets.** New namespaces `platform:admin`/`platform:*` and `org:admin`/`org:*`. The org-scoped
  `owner`/`admin` roles now carry
  `['*:read', '*:create', '*:update', '*:delete', 'org:admin', 'media:*', 'comments:moderate', 'audit:read']` — full
  CRUD within the org, but **no `*:*`** and **no `brand:*`** (appearance/menus are app-global, hence platform-owned).
  `platform_owner` retains `*:*`.

- **RBAC: self-healing system roles.** `Role.ensureDefaultRoles({ heal: true })` reconciles existing `isSystem` role
  rows to the canonical permission sets, correcting a role seeded under an older definition — e.g. a legacy
  `owner = ['*:*']` — with no manual re-seed or DB wipe. The reconcile runs on the deliberate `/__bootstrap__/seed` path
  (which also invalidates caches + refreshes platform-owner sessions); the signup path only creates-if-missing. The
  separate bootstrap `enforceDefaultRolePermissions` step is removed as redundant. Customize by creating NEW roles,
  never by editing system ones (the admin API rejects edits to `isSystem` roles).

- **Session: platform-admin flag.** `loadUserContext` (session-store) computes `platformAdmin` from **system-scoped**
  grants only and exposes it on `session.user.platformAdmin`; it is threaded through the KV snapshot so the client and
  RLS can gate the control plane on a scope-aware flag rather than a name.

- **Admin surface split (shared platform + org).** `/admin` platform pages (users, RBAC, infrastructure, appearance,
  blog studio, taxonomy, security) require platform admin; org pages (own blog, media, members, org settings, audit)
  require `org:admin`. `ProtectedRoute` gains `requirePlatformAdmin`; the admin nav filters by capability so an org
  admin sees only their own sections. Every admin-ish helper is now permission-based, not role-name based:
  `isAdminUser`/`isPlatformAdmin`/`isOrgAdmin` (frontend), `isAdmin` (rbac/utils), `isOwnerOrAdmin` (rbac/app-context),
  and `User.isAdmin(organizationId)` (ottaorm) — the last checks `platform:admin`/`org:admin` scoped to a given org.

- **Bootstrap: `GET /__bootstrap__/seed` maintenance page.** A focused, one-click "Reconcile roles & permissions" UI
  over the existing `POST /__bootstrap__/api/seed` (secret-gated, non-destructive). Runs `ensureDefaultRoles()` to heal
  the built-in system-role permission sets after a framework upgrade — e.g. a legacy `owner = ['*:*']` row — without
  clearing the DB or hand-editing SQL. Reuses the wizard's layout; prefill the token via `?secret=`.

- **Bootstrap: `GET /__bootstrap__/promote-owner` page.** A secret-gated UI over
  `POST /api/admin/platform-owner/promote` to grant an existing account the system-scoped `platform_owner` role — for
  ownership transfer or break-glass recovery when no owner can sign in. Previously curl-only.

- **Admin → Infrastructure → Email.** A platform-admin page (`/admin/infrastructure/email`) over `/api/email/providers`
  and `/api/email/test`: shows configured providers and sends a test email to verify delivery. The email demo is now
  just the (non-privileged) template preview; the privileged test-send/provider status moved to the admin console.

### Fixed (Unreleased)

- **Generic CRUD is now DEFAULT-DENY (allowlist).** `/api/ottaorm/*` previously allowed any registered model except an
  explicit denylist — which repeatedly missed sensitive tables (`user_roles`, then `user_group_members`). It now serves
  ONLY an allow-list of app-data models (posts/taxonomy/media/comments/organizations/todos); every other model —
  grant/auth/system tables and app-global control-plane data (e.g. `user_group_members`, `menu_slot_assignments`,
  `ottablog_themes`, `audit_logs`, `sessions`) — is refused with `CRUD_NOT_ALLOWED`. This closes the
  `user_group_members` self-grant vector (an authenticated user could `POST` themselves group ownership) and any future
  same-class model by default. `menu_slot_assignments` also gains `requirePlatformAdmin` in RLS as defense-in-depth.

- **Roster takeover — admin tier closed.** The prior fix stopped a plain member, but an org **admin** could still
  `PATCH self {role:'owner'}` (granting owner was unguarded) and then evict the founder. The update/remove/invite
  handlers now enforce a role hierarchy: only an OWNER may grant, modify, or remove owner-level membership.

- **Bootstrap secret brute-force oracle throttled.** Every `/__bootstrap__/*` endpoint (esp. the read-only
  `GET /api/status`) returned 401-vs-200 on secret correctness with no rate limit — a free oracle that made the promote
  endpoint's own limiter moot. Failed secret attempts are now IP-rate-limited at the shared `isValidSecret` choke point
  (best-effort; only real 429s block, so a missing limiter never breaks bootstrap).

- **Org creation is now all-or-nothing.** With the `ownerId` fallback removed (see stale-ownership fix), a partial
  failure between the `organizations` and `organization_members` inserts would orphan the org (unreachable even by its
  creator). All **three** org-creation paths — generic CRUD, `provisionDefaultOrganizationForUser`, and the first-user
  bootstrap `createPersonalOrganizationIfMissing` — now compensating-delete the org if the owner membership can't be
  written. (The bootstrap path was missed in the first atomicity pass; it does two raw non-atomic D1 inserts.)

- **Cross-tenant bypass is now scope-aware.** `enforceOrgMembership` (the RLS defense-in-depth tenant check) gated its
  super-admin bypass on the `*:*` permission STRING, which an org-scoped/legacy grant can carry without being a platform
  admin. It now gates on the scope-aware `SecurityContext.platformAdmin` flag — consistent with the `checkAccess`
  platform gate — so only a genuine platform admin may act across tenants; a stale org-scoped `*:*` cannot.

- **Secret-gated throttles share one fail-open policy.** The bootstrap-secret check and the platform-owner promote
  endpoint handled a missing rate-limiter binding inconsistently (one ignored the 500 and proceeded, the other 500'd the
  whole request). Both now use a shared `enforceBruteForceThrottle`: a real 429 blocks, but an unavailable limiter FAILS
  OPEN behind the secret gate **with a logged warning** — so a misconfigured binding can't brick first-run bootstrap or
  break-glass ownership recovery, and the degraded state is diagnosable. Added coverage for the limiter counting/window
  logic and the org-creation compensating-delete rollback.

- **RBAC Permissions Matrix un-broken.** `useRBAC`'s role hooks now target `/api/admin/roles*` (platform-scoped) instead
  of the now-blocked generic `/api/ottaorm/roles`, so the permissions matrix — linked from the RBAC Roles page — works.

- **CRITICAL — unauthenticated privilege escalation via generic CRUD on RBAC grant tables.** `user_roles`, `roles`, and
  `permissions` were registered OttaORM CRUD models with no permission gate, so `POST /api/ottaorm/user_roles` could
  mint a `platform_owner` grant and `GET` could dump all grants — no session, secret, or rate limit. Hard-blocked all
  three in `ottaorm-crud.ts` and added `requirePlatformAdmin` to their RLS as defense-in-depth. Use `/api/admin/roles`
  and the org-members / promote endpoints (all platform-admin scoped). (`roles`/`permissions` were previously only
  _accidentally_ fail-closed by an RLS-field/column mismatch — now intentionally gated.)

- **CRITICAL — org roster takeover by a rank-and-file member.** `assertRosterAccess` accepted any active membership
  (`isMember`), and `requireAdminAccess({scope:'either'})` resolves admin status against the caller's OWN org (where
  every signup is `org:admin`), so an invited `member` of org O could self-promote to `owner` and evict the founder. The
  roster guard now requires an OWNER/ADMIN membership in the TARGET org (`isOwnerOrAdmin`).

- **HIGH — stale-ownership cross-tenant access.** `Organization.ownerId` is stamped at creation and never cleared, and
  two paths trusted it: (a) `OrganizationMember.organizationIdsForUser` unioned owned orgs into `memberOrganizationIds`
  — which `getSecurityContext` uses to decide whether a client-supplied `x-org-id` is honored as the caller's active
  org, and which `enforceOrgMembership` uses as its defense-in-depth set. So a removed ex-owner (whose co-owner remains)
  could set `x-org-id: O` and get O pinned as the tenant scope for `/api/ottaorm/*`, giving live read/write of O's
  tenant data — e.g. read O's full `audit_logs`, inject `posts`/`media` — not just a metadata leak. (b) The
  `organizations` RLS policy fell back to `{ ownerId }` when membership resolved to an empty set, letting the same
  ex-owner read/write the org record. Fixed both: `organizationIdsForUser` uses ACTIVE MEMBERSHIPS only (owners always
  have an active owner membership), and the `organizations` filter denies on a resolved-empty set (falls back to
  ownership only when membership is genuinely unresolved/undefined).

- **System-role edits + self-heal reconciled.** `PATCH /api/admin/roles/:id` now rejects edits to `isSystem` roles
  (mirrors DELETE), and `Role.ensureDefaultRoles()` gained a `heal` flag: the signup hot path is create-if-missing only
  (no silent revert, no unbounded session churn), and the reconcile runs only on the deliberate `/__bootstrap__/seed`
  path — which now also invalidates the RBAC cache and refreshes platform-owner sessions so healed permissions take
  effect. **Deploy note:** after deploying, run `/__bootstrap__/seed` once; existing non-platform sessions pick up
  role/permission changes (and the `platformAdmin` flag) on their next sign-in.

- **Promote-owner endpoint hardened.** `POST /api/admin/platform-owner/promote` now rate-limits by IP (like
  register/reset) and normalizes the email (trim + lowercase) so a correct-but-miscased address on this break-glass tool
  no longer 404s.

- **`User.isAdmin()` requires an organization.** Removed the scope-blind "admin somewhere" default (it returned true for
  nearly everyone); `isAdmin(organizationId)` now answers "admin in this org".

- **RBAC Roles admin page was wired to a dead endpoint.** `RBACRolesPage` called the unregistered `/api/rbac/roles`
  (404) instead of the real, platform-scoped `/api/admin/roles*`; role definition management now works from the UI.

- **Removed the non-functional Notifications admin page.** It posted to `/api/admin/notifications/{send,system-alert}`,
  which were never implemented (no notification model/delivery/history — the "history" and stats were hardcoded mocks).
  Dropped the page, route, and nav entry rather than ship a fake admin surface. A real notifications subsystem can be
  designed later as a proper feature.

- **Security: closed several `/admin`-adjacent leaks** surfaced during the RBAC audit — app-global blog taxonomy
  (`series`/`categories`/`tags`/`post_tags` + link tables) was writable unauthenticated (now requires `org:admin`);
  brand kits/layouts/menus and the blog Studio were reachable by any org owner (now platform-scoped); organization
  `plan`/`status` could be self-upgraded by any member (now stripped from non-platform-admin writes); the migration
  endpoint failed **open** when `ENVIRONMENT` was unset (now requires an explicit `development` value); and
  `GET /api/ottaorm/models-metadata` and `GET /api/system/kill-switches` were unauthenticated (now platform-scoped).

### Added (Unreleased)

- **Premium Packages framework — `@ottabase/premium`.** Sell add-ons for an Ottabase app, or install someone else's,
  without either side writing integration code. One `definePremiumPackage()` manifest carries everything a paid package
  contributes — Drizzle tables, migrations, OttaORM models, API routes, admin nav, entitlements and lifecycle hooks —
  and installing one starts with the new `apps/*/ottabase/config.premium.ts`. Premium Packages deliberately bypass the
  free-package wiring (`config.migrations.ts` PACKAGE_REGISTRY, `config.routes.ts`, `ottabase.config.ts`,
  `db-utils.ts`): runtime integration is derived from the manifest list. Drizzle's static schema export and any rendered
  admin page remain explicit build-time adapters, verified by the premium-registration test.
    - **Licensing is offline.** A license is a compact signed token (`obp1.<claims>.<sig>`, ECDSA P-256 via Web Crypto)
      verified in microseconds with no network on the request path, so a vendor outage cannot take a customer's feature
      down and customer traffic patterns never reach the vendor. The stated cost: an offline token **cannot be revoked
      before it expires** — expiry is the revocation mechanism, and subscription vendors mint short-dated tokens.
    - **License sources, in precedence order:** `PREMIUM_LICENSE_<KEY>` → the `PREMIUM_LICENSES` JSON map → a key pasted
      in the admin UI (KV). Env wins deliberately, so the key in your infrastructure config is the key actually in
      force. `PREMIUM_PKG_<KEY>=false` is the kill switch, independent of licensing. A package with no
      `licensePublicKey` is free by construction.
    - **Six states, and a free tier that survives them.** `active` / `grace` (expired inside `graceDays`, still serving)
      / `expired` / `invalid` / `unlicensed` / `disabled`. A non-serving license collapses to the package's
      `freeFeatures` and `freeLimits` rather than to nothing — a customer whose card expires keeps their data and their
      basic path; only the paid surface closes.
    - **Enforcement on the server, hints in the browser.** `requirePremium` / `requirePremiumFeature` /
      `requirePremiumLimit` answer **402 PAYMENT_REQUIRED** with machine-readable `metadata` (package, reason, limit,
      purchase URL); `mountPremiumPackages()` mounts each package's namespace behind its own gate. `<PremiumGate>`,
      `usePremiumFeature` and `usePremiumLimit` only decide what to render and **fail closed** while loading, on error,
      and outside the provider.
    - **Two route-gating modes.** `gate: 'license'` (default) closes a whole namespace with one gate;
      `gate: 'entitlements'` keeps it reachable so a free tier exists, at the cost of each paid route guarding itself.
    - **Lifecycle:** `onInstall`, `onUpgrade` (manifest version change), `onActivate`, `onDeactivate`, `onUninstall` —
      best-effort and idempotent by contract, because a paid add-on's bookkeeping must never take the host app down.
      Uninstall clears the install record and **never drops tables**.
    - **Operations:** `/api/premium/*` control plane (status, activate, remove, uninstall, re-check) with authorization
      injected by the host, plus a drop-in `<PremiumPackagesManager />` admin surface at **Admin → Growth → Premium
      packages**. License keys are never returned by any endpoint.
    - **An app with no Premium Packages is unaffected**: no routes, no middleware, no KV reads, no nav entries, no
      tables. Full guide in `docs/PREMIUM_PACKAGES.md`.

- **`@ottabase/premium-webhooks` — the worked example.** A real paid add-on, not a stub: customer-registered HTTPS
  endpoints, HMAC-SHA256 deliveries signed over `<timestamp>.<body>` (so a receiver's tolerance window actually rejects
  replays), per-endpoint health, and a delivery log. Free tier is one endpoint with signed delivery and health; the demo
  "pro" license raises the ceiling to 25 and unlocks retained delivery history — exercising a limit gate, a feature
  gate, and a free tier that stays reachable when the license lapses. Destinations are validated on write (HTTPS only,
  no credentials, literal private/loopback/link-local refused) and redirects are never followed; the documented
  limitation is that a hostname _resolving_ to a private address cannot be caught without a resolver. Its demo keypair
  is published in the repo on purpose so the whole activation flow can be tried in minutes — with a loud note that a
  real vendor keeps the private key offline. Available at **Admin → Growth → Webhooks**.

- brand-engine v2 — full design-system fidelity. The token schema grew from "shadcn colors + 3 fonts +
  radius/shadows/motion" to a complete design-system vocabulary so radical design systems port 1:1 as theme JSON:
  `palette` (verbatim CSS color values incl. `color-mix()` derivation ramps — one brand knob retints the app live), open
  typography roles (`mono` + arbitrary roles like `label`/`ticker`), `typeScale` (every Tailwind `text-*` step becomes
  themeable, fluid `clamp()` included), radius scale (incl. `full` — set `2px` to ban pills), open shadow record (`none`
  allowed), `border`, open motion vocabulary (named durations/easings, configurable spring, `@keyframes` registry),
  `focus` (unified global focus-visible ring), `interaction` (hover/press physics), `links` (content-anchor contract
  incl. real `:visited`), `selection`, `scrollbar`, `native` (color-scheme/accent-color/caret), `zIndex` ladder,
  `textStyles` (generated `.ts-*` voice classes), `fontFaces` (self-hosted/variable fonts), `effects` (registry
  utilities + preset-portable raw theme CSS), `scopes` (token "rooms" — `[data-brand-scope]` re-binds semantic vars per
  subtree), and `surface` (body backdrop). All sparse: a theme that defines none of them renders pixel-identical to
  before (fallback-chain law).
- brand-engine: two complete 1:1 design-system ports as fidelity references. `themes/visited.json` — "Visited"
  (the90s.page): Netscape triad with pinned `:visited` purple, one-knob `--link` derivation, 7-step type ramp, 2px
  die-cut radius, zero shadows, dotted focus rect, membrane press physics, After Dark room, kicker/dateline/OSD voices.
  `themes/marquee.json` — "Marquee" (uppcoming): one Fauscia pigment deriving six live `color-mix()` tints (soft/wash
  re-derived per room), always-dark `screen` scope, Archivo width-axis voices (`.ts-stretch-wide`), Spline Sans Mono
  ticker role, size-stepped radius ladder, spring hover-lift/press-scale physics, brand-glow shadow slot, and
  ticket-stub notch + perforation effect utilities.
- ui-shadcn: universal theming hooks — `data-slot` on every primitive (+ `data-variant`/`data-size` on CVA components),
  `[data-decor]` effect-carrier spans on Button/Card, `BrandScope` room wrapper, and a Tier-2 `BrandComponentsProvider`
  registry for forks whose components need genuinely different DOM (`overrides={{ button: UppButton }}` —
  button/badge/card/input resolve overrides).
- otta-web worker: edge injection now also emits the generated `#brand-effects` stylesheet, the (sanitized) per-kit
  `#brand-custom-css` (killing the 300 ms client-only custom-CSS FOUC), and font `<link>` tags for every typography-role
  URL (kills brand-font FOUT).
- `@ottabase/ottarouter` package: zero-dependency Cloudflare Workers router with order-free precedence (static >
  `:param` > `*`, exact method > `ALL`), prefix-scoped onion middleware, gated sub-router mounts, and null-based
  fall-through for composing with custom routes, shortlinks, and static assets.
- otta-web: security-context membership lookups (org + group) are now cached behind a 5-minute KV read-through cache
  (`auth:usr:{id}:member-orgs` / `member-groups:*`, same TTL as the RBAC cache), replacing 2–4 D1 queries per
  authenticated request with KV reads. New `invalidateMembershipCache()` helper (`worker/lib/auth-utils.ts`) invalidates
  eagerly on every in-app mutation path: sign-in invite activation, admin member invite/update/remove, organization
  creation, and generic CRUD on `user_groups`/`user_group_members`. KV failures fall back to direct D1 — caching never
  weakens membership enforcement. See docs/CACHE_KEYS.md.
- brand-engine / otta-web: edge→client brand config hydration handoff — the Cloudflare Worker now injects the full
  resolved brand config as a JSON `<script type="application/json">` tag (`buildInitialConfigScriptTag`) alongside the
  existing critical CSS, and `BrandProvider` hydrates from it instead of re-fetching `/api/brand` on mount. Removes a
  redundant round-trip and, more importantly, guarantees the client can never resolve a config that disagrees with what
  the edge already painted.

### Changed (Unreleased)

- brand-engine: the three drifting resolvers (`resolveTheme`, `brandKitToTheme`, `buildPreviewTheme`) now share one
  per-category core (`resolve-core.ts`). Fixes latent bugs: flat `motion.disableAnimations` was silently dropped by the
  kit pipeline; color `aliases` were dead in the kit pipeline (now active everywhere); `expandPresetToTokens` silently
  destroyed unknown token categories on admin save (now passes through `TOKEN_CATEGORY_KEYS`).
- brand-engine / otta-web: client theme application switched from inline CSS vars on `<html>` to replacing the same
  `<style id="brand-critical">`/`#brand-effects` elements the edge injects (`applyBrandTheme(light, dark)`), so
  dark-mode/room switching is pure CSS cascade and theme CSS never fights inline-style specificity. `BrandConfig` gains
  `themeLight`/`themeDark`; kit `defaultColorScheme` now drives next-themes' default. The zero-FOUC handoff contract
  (client derivation must be byte-identical to the edge-painted critical CSS, so first-load application is a no-op — no
  re-fetch, no base-theme-then-retheme flash) is locked by `apps/otta-web/src/__tests__/brand-theme-parity.test.ts`. The
  edge-injected critical style tag is now sanitized (`sanitizeCssForStyleTag`) like effects/custom CSS, since v2 token
  values (palette, shadows) are admin-authored free-form strings.
- ui-tailwind preset: `text-*` sizes, `rounded-*` (incl. `rounded-full`), `border` width, bare `shadow`, `font-mono`,
  named z-index steps, and press/spring motion utilities are now token-backed with pixel-identical fallbacks; dead
  `brand.{50,500,700}` hex ramp removed; `caret-blink` keyframes added.
- ui-shadcn: Tailwind v4-only syntax (emitting no CSS under the workspace's v3.4 — `w-(--var)`, `in-data-*`,
  `has-data-*`, trailing `!` importants) codemodded to working v3 equivalents across ~20 components; per-component
  focus-ring recipes replaced by one global token-driven `:focus-visible` rule; interactive components use bare
  `transition` so press/hover physics tokens animate; overlay scrims use the new `--overlay` token; toaster's raw
  green/red/yellow/blue palette replaced with semantic status tokens.
- spotlight, ui-components, ui-base, ui-code-highlight: token-blind hardcoded colors migrated to design tokens
  (ui-code-highlight gains a `--syntax-*` token set defaulting to the current GitHub palette).
- otta-web worker routing migrated from the hand-rolled `resolveApiRoute` if/regex chain to declarative
  `@ottabase/ottarouter` registrations (`worker/routes/router.ts`); route handlers, endpoint paths, and the
  `ottabase/config.routes.ts` custom-route contract are unchanged.
- otta-web bootstrap gate: `resolvePlatformState` now has a READY fast path — per-isolate memo (60s soft TTL) plus a
  KV=READY early return — eliminating the serialized KV read + D1 probe every request (including asset fetches)
  previously paid. State writers drop the memo on any transition away from READY; a re-init on a live deployment should
  expect up to ~2 minutes of stale READY traffic from remote isolates (memo TTL + KV propagation). The preemptive
  KV=READY+dead-D1 panic/maintenance mode was removed as part of this: `PlatformStateResult.panic` is currently always
  `false` and D1 failures surface in the actual queries.
- otta-web worker bundle is now minified with source maps uploaded (`minify` + `upload_source_maps` in wrangler.jsonc):
  upload size 3604→1742 KiB raw, 684→478 KiB gzip.
- otta-web frontend: removed the `mantine` manual chunk from `vite.config.ts` — it was `modulepreload`ed into every page
  (~55 KB gzip fetched+executed on first paint) although Mantine is only used by the lazy `/demo/mantine` route.
  First-load JS drops from ~330 to ~297 KB gzip; Mantine now lives entirely inside the demo route chunk.
- brand-engine: worker HTML injection now resolves the brand config once per request — new `resolveConfigFromFull`
  derives path-scoped light/dark themes (route token overrides included) from an already-resolved full config, pure CPU
  with no extra KV/D1 access, replacing a prior two-call pattern that doubled KV reads on every hard navigation.
- otta-web: brand-config `appId` resolution for edge HTML injection now sources from the worker's own configured app id
  (matching the client's static `APP_ID`) instead of a `?appId=`/`X-App-Id` request hint, which a normal document
  navigation never carries anyway; the injected payload also carries that `appId` so a deployment-time `APP_ID` env
  override can't cause a later `refresh()`/fetch to swap in a different app's brand mid-session.
- otta-web: HTML responses carrying injected brand config now set `Cache-Control: no-store` and drop
  `ETag`/`Last-Modified` — previously the injected response reused the static asset's original validators, so a browser
  could 304-revalidate and keep serving a stale embedded theme indefinitely after an admin brand-kit update.
- brand-engine: deleted the now-unused `resolveBrandConfig` persistence function (superseded by
  `resolveFullBrandConfig` + `resolveConfigFromFull`); `warmBrandCache`'s `skipCache` option renamed to `skipCacheRead`
  and the post-invalidation re-warm now actually writes the freshly resolved config back to KV (previously the same flag
  skipped the write too, making the "warm" a no-op).

### Fixed (Unreleased)

- otta-web: creating an organization no longer leaves the creator unable to use it (the security-context cache populated
  earlier in the same request is now invalidated after the owner membership is created).
- otta-web: fixed a document-corruption bug in brand HTML injection where tenant-authored brand text (tagline,
  `customCss`) containing `$'`, `` $` ``, or `$$` could be expanded by `String.replace`'s special replacement-pattern
  handling, splicing arbitrary trailing document content into `<head>`; the injector now uses a replacer function.
- brand-engine: fixed the `.dark` critical CSS silently falling back to the light palette on KV cache hits — the
  resolved dark theme was dropped by the cache-hit code path, so dark-mode users on a warm cache first-painted the light
  palette until client-side hydration corrected it.

### Security (Unreleased)

- `@ottabase/ottaorm` RLS: an org-scoped operation whose `SecurityContext` has no resolved `memberOrganizationIds` is
  now **denied** (it used to skip the cross-tenant check as "membership unknown"). The `organizations` policy likewise
  drops its `ownerId` fallback for an unresolved list. A context builder that forgets to resolve membership fails loudly
  instead of running unscoped; server code that derives an org itself (a comment inherits its post's org) states so by
  adding that org to a local copy of the list.
- `@ottabase/auth`: OAuth provider tokens (access, refresh, id token, expiry, scope) are no longer persisted. The
  `accounts` table is an identity link (`provider` + `providerAccountId` → user); the tokens were plaintext columns that
  nothing read back. The Google preset no longer requests offline access or forces the consent screen, so returning
  Google users sign in with one click.
- otta-web: all in-app membership mutations (admin routes, sign-in invite activation, org creation, generic CRUD on
  group memberships) eagerly invalidate the new membership cache so revocations take effect on the next request; only
  mutations made outside the app (custom code, direct D1 edits) fall back to the 300s TTL plus KV eventual consistency
  (~6 minutes worst case cross-colo) as the bound on retained access.
- otta-web: brand config JSON embedded inline in HTML (the new hydration handoff) is escaped for `<`, `>`, `&`, and
  U+2028/U+2029 before embedding, so tenant-controlled brand text cannot prematurely close the `<script>` tag or
  otherwise break out of the JSON payload.

## [1.0.0] - 2026-04-06

### Added

- Initial public open-source release of the Ottabase monorepo.
- Edge-native SaaS framework architecture for Cloudflare Workers.
- Primary TanStack Router + Vite + Workers app template.
- Next.js homepage template app for marketing and landing pages.
- OttaORM fat-model system with model-driven CRUD and relationship patterns.
- Multi-tenant foundations with RBAC and row-level security support.
- Auto-migration workflow with schema collection from core, app, and enabled packages.
- Broad package ecosystem covering auth, queueing, realtime, analytics, docs, forms, UI, blog/CMS, and utilities.

### Changed

- Established repository-wide OSS governance baseline (license, contribution, conduct, and security policy).

### Notes

- Pre-release history prior to this date reflects internal development and is intentionally summarized as part of this
  initial public release.
- Going forward, `Unreleased` and version sections should capture externally relevant changes only.
