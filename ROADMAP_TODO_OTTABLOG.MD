# OttaBlog Roadmap / TODO

Findings from a focused audit of the blog system: the `@ottabase/ottablog` package and its implementation in
`apps/otta-web`. Goal: what is missing to make it a full-fledged, dynamic, use-anywhere blog system (SaaS mode,
standalone site, embedded in any app), with special attention to permissions/RBAC and theming.

Status: audit only. Nothing below has been implemented. Items marked "(Recommended)" are the preferred option where
alternatives exist, and the priority list at the bottom is the suggested build order.

---

## Baseline: what exists today (do not re-audit)

The foundation is genuinely good. Future work should build on this, not rebuild it.

- **Models** (`packages/ottablog/src/ottaorm-models/`): Post, PostCategory, PostTag, PostTagLink, PostCategoryLink,
  PostSeries, PostVersion, OttablogTheme, OttablogPlugin.
- **Post model is rich**: statuses (draft, scheduled, published, archived), `publishAt`/`publishedAt`, versioning with
  per-post retention (`maxVersionsToKeep`), password-protected posts (`isProtected`, `passwordHash`, `passwordHint`),
  footnotes, private notes, SEO meta JSON, hero image JSON, reading time, word count, view count, featured flag,
  `allowComments`, and both `organizationId` and `appId` columns.
- **Concurrency safety**: optimistic locking on post PATCH via `expectedUpdatedAt`
  (`apps/otta-web/worker/routes/ottaorm-crud.ts`).
- **Public API** (`apps/otta-web/worker/routes/blog.ts`): list, post by slug, related posts, tag/category/series
  archives, RSS feed, sitemap, LIKE-based search, and scheduled publishing driven by a cron endpoint behind a cron
  secret (`Post.publishScheduled()`).
- **Admin**: list, editor, tags, categories, series, and Studio pages under
  `apps/otta-web/src/pages/admin/content/blog/`.
- **Studio**: theme and plugin enable/activate state stored in DB (`ottablog_themes`, `ottablog_plugins`), one active
  theme per `appId`, gated by platform admin (`requireAdminAccess({ scope: 'system' })`).
- **Security posture**: blog tables are on the default-deny generic CRUD allowlist; posts use Hierarchical RLS
  (organizationId + appId + userId); taxonomy writes require `org:admin`.

---

## Gap 1: Tenancy split-brain (the biggest thing)

The blog cannot decide whether it belongs to the platform or to a tenant. Today it is effectively one platform blog per
deployment, not a per-tenant blog system.

### Findings

- Public lookups discriminate by `appId` only. The code comment at `apps/otta-web/worker/routes/blog.ts:57` says it
  outright: "Public blog lookup by slug: always discriminates by appId."
- `organizationId` exists on posts and even in a unique index (`posts_org_app_slug_unique_idx` in
  `Post.schema.ts`), but no public surface uses it. There is no org-slug routing, no subdomain-scoped rendering, no
  custom domains per org.
- Slug uniqueness is layered: `posts_app_id_slug_unique_idx` (app + slug), `posts_org_app_slug_unique_idx`
  (org + app + slug), and `posts_slug_unique_no_app_idx` (slug where appId is null). The app-level index is stricter
  than the org-level one, so two orgs cannot reuse the same slug today. Any per-org mode must revisit this.
- Taxonomy (categories, tags, series, and the link tables) is explicitly app-global: `AppScoped` RLS with the comment
  "no tenant isolation" (`packages/ottaorm/src/rls/registry.ts`, around line 201).
- Taxonomy writes require `org:admin`, but because the tables are app-global, ANY org's admin co-edits the one shared
  taxonomy. Org A's admin can rename org B's category.
- The code comment in `apps/otta-web/worker/routes/ottaorm-crud.ts` acknowledges the junction-table problem itself:
  "Deeper per-post-ownership scoping of the junction links is a larger RLS change tracked separately."
- Posts use Hierarchical RLS (tenant + user + app) while their taxonomy and public URLs are app-scoped. That is the
  split-brain: posts are tenant-aware, everything around them is not.

### Options

1. **(Recommended) Explicit blog mode switch: `platform` vs `org`.** A config flag (following ADR-3, config-driven
   package composition in `ottabase.config.ts`) that makes tenancy a deliberate choice. `platform` mode is today's
   behavior, unchanged. `org` mode gives each organization its own blog: org-scoped taxonomy, org-scoped slugs,
   org-scoped theme, and a public routing story (subdomain or `/o/:orgSlug/blog` path prefix).
2. Always-org mode (force every deployment to per-org blogs). Rejected: breaks the solo-founder default, which is the
   framework's primary audience.
3. Leave as platform-only and document it. Rejected: kills the SaaS use case the schema already half-supports.

### Implementation notes for agents

Make the mode a single config value read once at the worker boundary, and thread it through as data, not branches
scattered across handlers. In `org` mode: taxonomy tables gain an `organizationId` column (they already carry `appId`,
so mirror that pattern) and their RLS flips from `AppScoped` to tenant-scoped; the public router resolves the org from
subdomain or path prefix before any query and passes it into the same query helpers the platform mode uses with
`organizationId: null`. Slug uniqueness is the sharp edge: the strict `posts_app_id_slug_unique_idx` must yield to the
org-level index in org mode, and since existing deployments already have the index, this needs a real migration entry in
`config.migrations.ts` (SQLite can DROP INDEX, but auto-init only creates; do not assume auto-migration handles it).
Theme activation keys change from `appId` to `(appId, organizationId)`. Keep the RLS work inside OttaORM policies rather
than ad-hoc WHERE clauses so the existing defense-in-depth (`enforceOrgMembership`, default-deny CRUD) keeps applying,
and remember the standing caveat that raw Drizzle queries bypass RLS. Decide and document what happens to existing
app-global taxonomy rows when a deployment flips modes (recommend: leave them as platform-owned rows with null org,
visible read-only to tenants). Custom domains per org are a later increment on top of the same org-resolution step.

---

## Gap 2: RBAC is coarse; no editorial model

### Findings

- The only content gates in practice are `org:admin` (taxonomy writes, via generic CRUD special-casing) and platform
  admin (`requireAdminAccess({ scope: 'system' })` for Studio, theme activation, plugin toggles in
  `apps/otta-web/worker/routes/blog.ts`).
- The RBAC system supports fine-grained permission strings (`posts:publish`, `posts:create`, and the role sets already
  include `comments:moderate`), but the blog never uses that granularity. Publishing is not a separate capability from
  editing.
- No editorial roles: no author/editor/contributor distinction, no "authors edit only their own posts, editors edit
  all," no draft to review to approve workflow.
- Blog Studio is platform-admin only. Consistent with app-global themes, but it means an org admin can never theme
  "their" blog. Fine for solo-founder mode, a blocker for SaaS mode.
- No shareable draft previews. Password protection exists but only for published posts; there is no signed preview
  token to hand a reviewer before publish.

### Options

1. **(Recommended) Permission-vocabulary gates plus ownership-aware RLS.** Enforce `posts:create`, `posts:update`,
   `posts:publish`, `posts:delete`, `taxonomy:manage` as distinct checks at the route layer, and add an ownership
   dimension in the posts RLS policy so a grant can mean "own posts only" or "all posts in scope." Ship three example
   roles (author, editor, admin) as non-system role presets.
2. A dedicated editorial-workflow engine (submission queues, approval states, notifications). Rejected for now: heavier
   than the framework needs; the permission + ownership layer gets 90 percent of the value and a workflow can be built
   on top later.

### Implementation notes for agents

Follow the hardening principle already established in this codebase: authorization is permission + scope, never role
name (see CHANGELOG "RBAC: authorization is permission + scope"). Do not invent an `isAuthor()` name check; define the
permission strings, put them in the seeded role presets via `Role.ensureDefaultRoles` patterns, and gate the blog routes
with the same `requireAdminAccess`-style helpers the admin surface uses, extended to accept a required permission
instead of a blanket admin flag. The ownership split belongs in the RLS layer: the posts policy is already
`Hierarchical(false)` with `contextFields: ['organizationId', 'appId', 'userId']`, so the change is making the userId
dimension conditional on whether the caller's grant carries an "all posts" permission, not adding route-level if/else.
Publishing as a distinct capability means the status transition to `published` (and `publishAt` scheduling) is checked
separately in the CRUD special-case block for posts that already exists in `ottaorm-crud.ts`. For draft previews, mint a
signed token the same way `@ottabase/auth` signs sessions (Web Crypto HMAC, no new dependency): embed post id and
expiry, verify in the public by-slug handler as an alternate access path that bypasses only the `status: 'published'`
filter, never RLS. Keep every new gate default-deny and add the new routes to tests the way the roster-guard fixes did.

---

## Gap 3: Theming; two systems that do not talk

### Findings

- Blog themes are code, not data. The registry (`packages/ottablog/src/themes/registry.ts`) ships exactly two themes,
  `default` and `minimal`. The `ottablog_themes` DB rows only activate/deactivate what code registered. A new blog look
  requires a code deploy, which is the opposite of Brand Engine v2 where a full design system is portable JSON.
- Zero brand-engine references inside the ottablog package (verified by grep). Blog themes inherit brand tokens only
  implicitly through Tailwind's token-backed utilities. There is no explicit contract, no `BrandScope` room for the
  blog, no guarantee a radical brand theme renders the blog coherently.
- One active theme per `appId`. No per-org theme, no per-category, per-series, or per-post layout overrides.
- The ottalayout-to-blog wiring was deliberately disabled (commit "Layouts: Disable default docs/blog layout mappings",
  Jul 15), so the layout-preset system does not drive blog pages out of the box either.

### Options

1. **(Recommended) Data-driven blog themes with an explicit brand-engine contract.** Blog themes become resolvable data
   (token overrides plus a layout/slot selection) layered on top of the app's brand kit, editable from Studio without a
   deploy. The two existing code themes become seed presets.
2. Keep code themes but wire ottalayout presets back in. Cheaper, but still deploy-gated and still no brand contract.
3. Full per-post visual editor. Rejected: out of scope for a framework; belongs to an app built on it.

### Implementation notes for agents

Treat a blog theme the way Brand Engine v2 treats a kit: a sparse JSON document of token overrides plus a named layout,
resolved through the existing shared resolver core (`resolve-core.ts`) rather than a new resolution path, and honoring
the fallback-chain law (a theme that defines nothing renders pixel-identical to today). Wrap blog page surfaces in a
`BrandScope` room (the `[data-brand-scope]` mechanism brand-engine v2 already ships) so blog token overrides re-bind
semantic variables for that subtree only and cannot leak into the app shell. Store the theme document on the existing
`ottablog_themes` row (add a JSON column) so activation, uniqueness per app, and Studio plumbing stay as-is; seed
`default` and `minimal` as rows generated from the current code themes so nothing breaks on upgrade. The edge is the
critical path: blog theme CSS must join the worker's existing brand injection pipeline (same place `#brand-effects` and
sanitized custom CSS are emitted) or dark mode and first paint will FOUC; reuse `sanitizeCssForStyleTag` because these
values become admin-authored free-form strings, and remember the lesson from the brand injector's `String.replace`
document-corruption fix: use a replacer function when splicing admin content into HTML. Scope follows Gap 1: theme
lookup keys on `(appId)` in platform mode and `(appId, organizationId)` in org mode, and Studio access widens from
platform-only to org admins exactly when org mode is on.

---

## Gap 4: Use-anywhere packaging and SEO

### Findings

- The entire blog HTTP surface (roughly 800 lines in `apps/otta-web/worker/routes/blog.ts`) is app code, not package
  code. `@ottabase/ottarouter` supports mountable sub-routers with gates and null fall-through, but ottablog does not
  ship one. Every new app must re-implement list, by-slug, RSS, sitemap, and Studio routes by hand.
- `apps/otta-landing` (the Next.js marketing template) has no blog surface at all, which is exactly where a
  standalone-site user most wants one.
- Blog pages render client-side in the SPA (TanStack Router + Vite). RSS, sitemap, and SEO meta exist as data and
  endpoints, but post HTML is not server-rendered and there is no per-post OG or meta injection at the edge. The worker
  already injects brand config into HTML documents, but not post metadata. Social scrapers and crawlers see the SPA
  shell.

### Options

1. **(Recommended) Ship a mountable blog router from the package, plus edge-injected per-post meta.** A
   `createBlogRouter(config)` export built on ottarouter, mounted by otta-web (and any future app) at `/api/blog`, with
   auth gates injected via config so the package never imports app auth. Separately, per-post title/meta/OG/JSON-LD
   injected into the HTML document at the worker, piggybacking the existing brand-injection pipeline.
2. Full SSR/prerender of published posts at the edge. More complete but much heavier; meta injection gets crawlers and
   link unfurls working without changing the SPA rendering model. Revisit SSR later if organic search demands it.
3. Copy the route file into each new app. Rejected: that is the current state and the problem.

### Implementation notes for agents

For the router: move the handlers into `packages/ottablog` behind a factory that accepts everything app-specific as
config (D1 binding accessor, `resolveAppId`, an admin-guard callback with the same shape as `requireAdminAccess`, cron
secret check), return an ottarouter sub-router, and have `apps/otta-web/worker/routes/router.ts` mount it where the
hand-registered routes are today; endpoint paths must not change, and the existing route tests should pass unmodified,
which is the acceptance test for the refactor. Preserve ottarouter's null fall-through so shortlinks and static assets
keep composing. For SEO: in the worker's HTML document path (the same place brand config is injected), detect blog
detail navigations, load the post (through the model so RLS applies, and only `status: 'published'`), and inject title,
description, canonical, OG/Twitter tags, and Article JSON-LD into `<head>`; escape exactly the way the brand JSON
hydration payload is escaped (the `<`, `>`, `&`, U+2028/U+2029 treatment) since excerpt and title are author-authored,
and use a replacer function for the splice. The injected response must follow the existing rule for personalized HTML:
`Cache-Control: no-store` with validators dropped, or a deliberate short-TTL KV cache keyed by slug and invalidated on
post update, mirroring how brand cache invalidation works. A blog surface for otta-landing is a separate increment:
consume the package's public API from Next.js server components; do not port worker code into Next.

---

## Gap 5: Table-stakes features for a public blog

Smaller, mostly independent items. Each is a candidate "good first feature." Ordered by impact.

- **Import/export (Recommended as the first pick here).** No WordPress/markdown import and no portable export. This is
  a real adoption blocker for "use it for my existing site." Implementation note: build as CLI scripts in
  `@ottabase/scripts` (or `otta` CLI commands) that talk to the existing API rather than the DB directly, so RLS and
  validation apply; WordPress WXR and a folder-of-markdown (front-matter) importer cover most migrations, and export
  should emit markdown plus a JSON sidecar for EditorJS blocks that do not map cleanly.
- **Author surfaces.** Single `authorId`, no co-authors, no public author profile or archive pages. Implementation
  note: an authors join table (post to user, ordered) plus one public archive route and RSS-per-author; author display
  data should come from a public-safe projection of User, never the full row.
- **Content i18n.** The i18n package covers UI strings only; Post has no locale field or translation linkage.
  Implementation note: a `locale` column plus a `translationGroupId` linking sibling posts is the smallest model that
  supports hreflang in the (future) meta injection; resist per-field translation JSON, it fights versioning and the
  editor.
- **Subscriptions/notify-on-publish.** The email package and queue exist, but there is no subscribe flow. Implementation
  note: a subscriber model with double-opt-in tokens (sign like auth does), a queue job on publish transition, and
  unsubscribe links; wire through `@ottabase/email` provider abstraction, and rate-limit the subscribe endpoint like
  register/reset already are.
- **Search quality.** LIKE-based search; D1 has no FTS (acknowledged in ARCHITECTURE.md). Implementation note: accept
  LIKE for small blogs; if needed, maintain a lightweight inverted-index table updated on publish, or offload to
  Cloudflare Vectorize behind a config flag; do not promise relevance ranking in docs until one of these lands.
- **Per-post analytics.** `viewCount` plus WAE events exist, but no per-post dashboard. Implementation note: an admin
  page reading the existing `@ottabase/analytics` query helpers (top-K, funnel) scoped by post id; no new write path
  needed.

---

## Suggested build order

1. **Gap 1: decide and implement the tenancy mode switch.** Everything else inherits this decision; do it first so
   later work does not get rebuilt.
2. **Gap 4a: mountable package router.** Turns "blog in otta-web" into "blog anywhere," and shrinks the app by ~800
   lines. Pure refactor, low risk, high leverage.
3. **Gap 4b: edge-injected per-post SEO meta.** Makes the public blog real for the open web (crawlers, link unfurls).
4. **Gap 2: editorial RBAC and draft preview links.** Permission vocabulary, ownership-aware RLS, signed previews.
5. **Gap 3: data-driven themes with the brand-engine contract.** The most visible payoff, but it depends on the
   tenancy decision (theme scope) and benefits from the router refactor landing first.
6. **Gap 5 items** in listed order, starting with import/export.

---

## Invariants to preserve (whatever you build)

- Generic CRUD stays default-deny: new models must be explicitly allowlisted in `ottaorm-crud.ts` and given a real RLS
  policy.
- Authorization is permission + scope, never role name.
- Tenant-scoped data access goes through BaseModel methods; raw Drizzle queries bypass RLS.
- Admin-authored strings that reach HTML go through sanitization and replacer-function splicing (see the brand injector
  fixes).
- Edge-injected HTML with per-request content does not reuse static asset validators (`no-store`, drop ETag).
- Sparse theme documents must render identical to the unthemed baseline (fallback-chain law).
- The solo-founder default experience must not get more complicated: every SaaS-mode feature defaults off.
