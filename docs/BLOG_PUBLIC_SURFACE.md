# Blog-Only Public Surface

Status: design exploration; not implemented  
Prepared: 2026-08-14  
Purpose: preserve the full architectural context for implementing an optional blog-only Ottabase deployment/public
surface (`publicSurface: 'app' | 'blog'`), so the decision does not have to be re-derived.

This is a design document, not a task list — it describes a feature that does not exist yet. Nothing in the codebase
depends on it. Delete it if the blog-only surface is dropped as a product direction.

## Executive recommendation

Add a distinct **public-surface setting**, defaulting to the current application experience:

```ts
publicSurface: 'app' | 'blog';
```

This is intentionally separate from:

```ts
features: {
    ottablog: {
        mode: 'platform' | 'org';
    }
}
```

`features.ottablog.mode` already controls **content tenancy**:

- `platform`: one platform-owned blog per app.
- `org`: organization-scoped posts, taxonomy, themes, and plugins.

Blog-only mode is instead a **routing, public navigation, layout, canonical URL, and deployment presentation** decision.
Reusing the existing tenancy mode would blur authorization, cache ownership, organization resolution, and user-facing
behavior.

The recommended first release is a **deploy-wide, build-time public surface**. In blog mode, the public blog is mounted
at the root while auth, Studio, media, appearance, and required admin capabilities remain reachable at explicit private
paths.

Do not begin with managed customer custom domains or per-host database configuration. Those can be a second phase after
the deploy-wide mode is correct.

## User goal being addressed

Some Ottabase adopters will want to deploy the template as a blog/content site, commonly at a hostname such as
`blog.example.com`, without exposing the generic SaaS template home, demo, docs, shortlinks, referrals, dashboards, and
other application-oriented public navigation.

"Blog-only" should mean:

- The public visitor experiences a blog/content site.
- The blog index is the homepage.
- Articles have clean public URLs.
- Editors can still sign in and use `/studio`.
- Owners can still reach the necessary administration and appearance tooling.
- The underlying package and infrastructure capabilities are not implicitly deleted.

It should **not** mean "disable every package except Ottablog." Package installation, public route exposure, editorial
tools, and administrative infrastructure are different concerns.

## What already exists and can be reused

Ottabase already has most of the necessary foundation:

1. Public blog HTTP surface
    - Canonical package router: [`packages/ottablog/src/router/router.ts`](packages/ottablog/src/router/router.ts)
    - Mounted at `/api/blog` in [`apps/otta-web/worker/routes/router.ts`](apps/otta-web/worker/routes/router.ts)
    - Includes public post list/detail, tags, categories, series, RSS, sitemap, related posts, password unlock, preview
      tokens, Studio state, and scheduled publishing.

2. Public React pages
    - [`apps/otta-web/src/pages/blog/BlogListPage.tsx`](apps/otta-web/src/pages/blog/BlogListPage.tsx)
    - [`apps/otta-web/src/pages/blog/BlogDetailPage.tsx`](apps/otta-web/src/pages/blog/BlogDetailPage.tsx)
    - Tag, category, and series archive pages in the same directory.

3. Blog theme room
    - Public blog routes are wrapped in `<BrandScope name="blog">` in
      [`apps/otta-web/src/router.tsx`](apps/otta-web/src/router.tsx).
    - Edge-injected scoped theme CSS is implemented in
      [`apps/otta-web/worker/lib/blog-theme-inject.ts`](apps/otta-web/worker/lib/blog-theme-inject.ts).

4. Edge SEO
    - Article title, description, canonical, Open Graph, Twitter, and JSON-LD injection lives in
      [`apps/otta-web/worker/lib/blog-seo-inject.ts`](apps/otta-web/worker/lib/blog-seo-inject.ts).
    - Pure SEO builders live in [`packages/ottablog/src/seo.ts`](packages/ottablog/src/seo.ts).

5. Focused editorial surface
    - `/studio` is already separate from the generic admin mental model.
    - [`apps/otta-web/src/pages/studio/StudioShell.tsx`](apps/otta-web/src/pages/studio/StudioShell.tsx) reuses the
      existing blog admin pages and permission gates.

6. Layout and menu infrastructure
    - Brand Engine resolves layout templates from route mappings through
      [`packages/brand-engine-react/src/LayoutResolver.tsx`](packages/brand-engine-react/src/LayoutResolver.tsx).
    - Layout route mappings and menu slots already exist in the Brand Engine persistence layer.
    - This can provide a blog-specific public shell without creating a second theming system.

## Current behavior and gaps

### Current public paths

The current client router declares:

- `/` as `HomePage`.
- `/blog` as the blog index.
- `/blog/$slug` as article detail.
- `/blog/tag/$slug`.
- `/blog/category/$slug`.
- `/blog/series/$slug`.

See [`apps/otta-web/src/router.tsx`](apps/otta-web/src/router.tsx).

### `/blog` is hardcoded in multiple layers

The following all assume `/blog`:

- Client route declarations and internal links.
- `extractBlogSlugFromPath()` default base path.
- Edge SEO document detection and canonical construction.
- Edge blog-theme document detection.
- RSS channel and item links.
- Sitemap index and post URLs.
- Preview-token returned paths.
- Studio "View blog" links.
- Blog "Back" and taxonomy links.

The implementation should introduce one central blog public-path contract rather than scattering
`publicSurface === 'blog'` branches throughout these files.

### Client config is static while Worker config is env-aware

[`apps/otta-web/ottabase/config.loader.ts`](apps/otta-web/ottabase/config.loader.ts) explicitly documents:

- Static exports are based on the config file at module load.
- Worker calls can apply environment overrides per request.
- The browser cannot see Cloudflare environment bindings.

Therefore a first-phase build-time config setting is straightforward and safe. An `OTTABASE_PUBLIC_SURFACE=blog` runtime
override would require a server-to-client bootstrap payload before the client router is built.

Brand Engine already injects a runtime hydration payload into HTML in
[`apps/otta-web/worker/lib/brand-html-inject.ts`](apps/otta-web/worker/lib/brand-html-inject.ts), but public-surface
configuration should ideally use a small generic runtime-config payload rather than becoming semantically coupled to
Brand Engine.

### Static asset routing matters for `/`

The current Wrangler asset binding does not declare `assets.run_worker_first` in
[`apps/otta-web/wrangler.jsonc`](apps/otta-web/wrangler.jsonc).

Cloudflare normally serves a matching static asset before invoking Worker code. The root `/` commonly matches the SPA
index asset. If runtime configuration or root-level edge SEO must be injected into `/`, selective Worker-first handling
for `/` will likely be required.

Direct article URLs such as `/my-post` generally miss the static asset and fall through to the Worker, but the homepage
needs explicit consideration.

Cloudflare reference:

- https://developers.cloudflare.com/workers/static-assets/routing/worker-script/

### Generic navigation is inappropriate in blog mode

The current fallback nav in
[`apps/otta-web/src/ottabase/components/layout/layout.constants.ts`](apps/otta-web/src/ottabase/components/layout/layout.constants.ts)
includes Home, Demo, Docs, Blog, Changelog, Shortlinks, Profile Information, Referrals, Analytics, and Admin.

Blog mode needs a seeded blog-oriented header/footer menu and a safe fallback when no database menu has been configured.
It should not depend on every adopter manually removing template navigation before launch.

### Root article slugs conflict with shortlinks and reserved paths

[`apps/otta-web/worker/routes/shortlinks.ts`](apps/otta-web/worker/routes/shortlinks.ts) implements a fallback that
treats almost every non-file root path as a potential short code before the request reaches SPA assets.

In blog mode, `/:slug` would collide with:

- Root shortlinks.
- `/login`, `/register`, `/verify-email`, `/reset-password`.
- `/studio` and `/admin`.
- `/api` and `/__bootstrap__`.
- `/tag`, `/category`, `/series`.
- `/rss.xml`, `/sitemap.xml`.
- Any retained `/changelog`, `/embed`, media, or system paths.

Recommended policy:

- In blog mode, make shortlinks explicit, for example `/go/:code` or `/s/:code`.
- Reject reserved article slugs in the Post model/domain validation.
- Keep one auditable reserved-slug list shared by server validation and routing tests.
- Static routes should always win over `/:slug`.

Do not allow a database shortlink and article with the same root slug to compete by request order.

### Public blog data currently mixes public endpoints and generic CRUD hooks

Most public data uses `/api/blog`, but supporting data still uses generic OttaORM hooks:

- The blog index uses `createModelHooks({ entityName: 'series' })` for the series filter.
- Blog detail uses generic series detail and post list hooks for series navigation.

The generic browser client intentionally does not send `x-org-id` for anonymous visitors. Meanwhile `/api/blog` can
resolve blog tenancy from the request host. Under org mode or custom hostnames, this can produce a correctly scoped post
followed by incorrectly scoped series/taxonomy support data.

Before host-aware org blogs are supported:

- Add the missing public series list/detail/navigation endpoints to the Ottablog router.
- Make every public blog page read through domain-aware `/api/blog` endpoints.
- Preserve entity-oriented query keys so the existing mutation invalidation behavior remains useful.

### Existing subdomain-to-organization behavior is insufficient for custom domains

[`apps/otta-web/worker/routes/blog.ts`](apps/otta-web/worker/routes/blog.ts) resolves org-mode public requests in this
order:

1. `?org=`.
2. `x-org-id`.
3. First hostname label looked up as an Organization slug.
4. Unresolved requests fall back to platform-owned content.

On `blog.example.com`, the first label is `blog`, so org mode would try to find an organization with slug `blog`. This
is not an acceptable custom-domain mapping strategy.

For a future managed-domain phase, use a validated hostname mapping model and fail closed on an unknown/inactive
configured hostname instead of falling back to another tenant or platform content.

### Brand Engine is app-scoped, not organization/hostname-scoped

[`packages/brand-engine/src/persistence/schema.ts`](packages/brand-engine/src/persistence/schema.ts) explicitly scopes
Brand Kits, layout templates, and route mappings by `appId`, not organization.

Ottablog themes can vary by organization, but the outer app header/footer brand cannot currently vary by organization or
hostname. A per-customer fully branded blog domain would need either:

- A site/hostname dimension in Brand resolution, or
- A deliberate decision that org-specific blog tokens customize the article room while the deployment retains one outer
  brand.

Do not accidentally describe current Brand Engine behavior as per-org white labeling.

### Session cookies are deliberately host-bound

Production auth uses `__Host-` cookies without a Domain attribute in
[`packages/auth/src/session-store.ts`](packages/auth/src/session-store.ts). This prevents subdomain cookie
tossing/fixation and is a security property worth preserving.

For a dual-host setup:

- `app.example.com` and `blog.example.com` will not automatically share a session.
- The simplest secure experience is to allow `/login` and `/studio` on the blog hostname.
- If Studio lives only on the app hostname, users should expect to authenticate there.
- Do not weaken the session cookie to a parent-domain cookie merely to make the mode convenient.

## Option matrix

| Option                          | Shape                                                          | Best for                                       | Main cost                                                       |
| ------------------------------- | -------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| Deploy-wide build-time surface  | One config value chooses app or blog                           | Founder deploying Ottabase as a blog           | Lowest complexity; recommended first                            |
| Deploy-wide runtime/env surface | One artifact selects mode per environment                      | Different preview/prod profiles                | Needs runtime config injection before router creation           |
| Host-aware dual surface         | `app.example.com` is full app; `blog.example.com` is blog root | One deployment serving both public experiences | Host resolution, canonical policy, auth boundaries, cache scope |
| Managed customer domains        | Many verified customer-owned hostnames map to apps/orgs        | Hosted Ottabase platform                       | Domain model, DNS validation, Cloudflare for SaaS integration   |
| Separate public blog Worker/app | Dedicated blog frontend shares Ottablog data/APIs              | Strict isolation or large public traffic       | Extra build/deploy, branding and API integration                |

### Rejected as a complete solution: Worker rewrite only

Rewriting `/` internally to `/blog` is not sufficient:

- TanStack Router still sees the browser URL `/`.
- The existing root route still selects `HomePage`.
- Internal article links remain `/blog/...`.
- Edge SEO and feeds still emit `/blog` URLs.
- Canonical and legacy URL behavior becomes ambiguous.

A redirect from `/` to `/blog` is technically consistent but does not produce the desired root-mounted blog experience.

### Rejected as a complete solution: disable every non-blog package

Package toggles affect tables, APIs, and feature availability. Blog-only mode still needs auth, media, appearance,
Studio, and potentially owner administration. Public surface selection should hide or reject unrelated public pages
without pretending their underlying infrastructure is uninstalled.

## Recommended public route contract

In `publicSurface: 'blog'`:

| Path                                            | Behavior                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------- |
| `/`                                             | Blog index                                                       |
| `/:slug`                                        | Published article detail                                         |
| `/tag/:slug`                                    | Tag archive                                                      |
| `/category/:slug`                               | Category archive                                                 |
| `/series/:slug`                                 | Series archive                                                   |
| `/rss.xml`                                      | Public RSS feed                                                  |
| `/sitemap.xml`                                  | Public blog sitemap                                              |
| `/studio/**`                                    | Authenticated editorial surface                                  |
| `/login`, `/register`, verification/reset paths | Auth flows                                                       |
| `/api/**`                                       | Existing Worker API surface, subject to current gates            |
| `/admin/**`                                     | Deep-linkable owner/admin control plane; omitted from public nav |
| `/blog`                                         | Permanent redirect to `/`                                        |
| `/blog/:slug`                                   | Permanent redirect to `/:slug`                                   |
| Unrelated public template paths                 | Real 404, not a redirect to `/`                                  |

Permanent legacy redirects preserve existing links and allow an adopter to enable blog mode after publishing at
`/blog/...`.

Do not redirect every missing path to the homepage; that creates soft 404s and poor crawler behavior.

## Recommended configuration shape

Keep the first version small:

```ts
export default defineOttabaseConfig({
    appId: 'my-blog',
    appName: 'My Blog',
    publicSurface: 'blog',
    features: {
        ottablog: {
            mode: 'platform',
        },
    },
});
```

Suggested semantics:

- Default: `'app'`, preserving all existing behavior.
- `'blog'` requires `packages.ottablog === true`; invalid combinations should fail clearly during config
  normalization/build rather than silently showing a missing homepage.
- In the first release, derive the public base path from the surface:
    - app surface: `/blog`.
    - blog surface: `/`.
- Do not expose an arbitrary base-path setting until a concrete supported use case requires it; arbitrary prefixes
  multiply route, canonical, sitemap, preview, and test combinations.

An enum is preferred over `blogOnly: true` because future public surfaces such as `docs` or `marketing` can be added
without accumulating mutually interacting booleans.

## Suggested architectural seams

### 1. Resolved public-site contract

Create one small resolved object consumed by both client route construction and Worker document handling. Conceptually:

```ts
interface ResolvedPublicSite {
    surface: 'app' | 'blog';
    blogBasePath: '/blog' | '/';
}
```

For a future host-aware phase it may expand server-side to include:

```ts
interface ResolvedPublicSiteRequest extends ResolvedPublicSite {
    appId: string;
    organizationId: string | null;
    canonicalOrigin: string;
    siteScopeId: string;
}
```

The server must derive this from trusted configuration or a verified hostname mapping. The browser must not choose its
own organization/app mapping.

### 2. Central blog path helpers

Introduce pure helpers for:

- Blog index URL.
- Post URL.
- Tag/category/series URL.
- RSS and sitemap URL.
- Preview URL.
- Legacy redirect mapping.
- Document-path classification and slug extraction.

Use these in package handlers, Worker injectors, React links, Studio links, tests, and documentation.

Avoid creating a controller/service layer. These helpers are routing primitives; persistence/domain logic remains in
OttaORM models.

### 3. Route-tree profiles

Build the TanStack route tree from a surface profile:

- App surface registers the current root HomePage plus `/blog/**`.
- Blog surface registers the blog index at `/` and article/archive root paths.
- Core private routes remain registered.
- Unrelated public template routes are omitted or guarded by the chosen public-surface policy.

Keep package gates in place. A blog route should still disappear when Ottablog is disabled.

### 4. Worker document routing

The Worker should use the same resolved public-site contract for:

- SPA asset fallback.
- Edge article lookup.
- Canonical URL construction.
- Blog-theme CSS injection.
- Root list metadata.
- True missing-article HTTP status.
- Legacy redirects.

Consider returning the SPA shell with HTTP 404 for a missing article so the client can render the existing branded
not-found page while crawlers receive the correct status.

### 5. Blog layout/menu preset

Use existing Brand Engine and menu slots:

- Seed a blog/public layout mapping for the active blog route family.
- Seed or provide a safe fallback blog nav.
- Map `/studio/**` and `/admin/**` to appropriate private layouts.
- Decide whether `/studio` should continue stacking beneath the outer app header or use a focused/fullscreen layout in
  blog deployments.

The existing route mappings are path-based. They are enough for a deploy-wide blog surface. They are not enough for
different layouts on two hostnames with the same path; that belongs to the host-aware phase.

### 6. Editorial affordances

The public blog currently shows "New Post" to any authenticated user and points to `/admin/content/blog/new`.

For blog mode:

- Check the appropriate content permission before showing the action.
- Prefer `/studio/new` for the writing-first experience.
- Keep server-side permission enforcement authoritative.

## Domain deployment strategy

### Founder-owned zone / self-deployed Ottabase

Use a Cloudflare Worker Custom Domain such as `blog.example.com`.

Cloudflare Custom Domains:

- Point all paths on the hostname to the Worker.
- Create DNS records and certificates on the deployer's behalf.
- Support multiple custom domains on one Worker.
- Require an active Cloudflare zone the deployer controls.

Reference:

- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/

This is a deployment concern, not an Ottablog tenancy feature. The first version can document the necessary
Wrangler/dashboard setup without building a domain control plane.

### Hosted Ottabase accepting customer-owned domains

Ordinary Worker Custom Domains cannot attach a hostname in a zone the platform does not own. Use Cloudflare for SaaS
Custom Hostnames.

References:

- https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/
- https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/create-custom-hostnames/

Future domain model, following OttaORM-first rules, could contain:

- `id`.
- Normalized `hostname`.
- `appId`.
- `organizationId` nullable for platform blog.
- `surface`.
- `isCanonical`.
- Verification/provisioning status.
- Provider/custom-hostname identifier.
- Created/updated metadata.

Requirements:

- Model inherits `BaseModel`.
- Hostnames are normalized and unique.
- Mapping becomes active only after ownership/TLS validation.
- Unknown or inactive managed hosts fail closed.
- Cache entries include hostname/site identity and are invalidated on domain changes.
- Canonical origin comes from the verified mapping, not an arbitrary forwarded Host header.
- `wrangler.jsonc` and `cloudflare-env.d.ts` stay in sync for any new bindings.

## SEO and content-delivery checklist

Blog surface should cover all of these before it is considered complete:

- Root blog index receives correct title, description, canonical, OG, and Twitter metadata at document response time.
- Root-mounted article detail gets the current JSON-LD and canonical behavior.
- Canonical URL uses the verified/request canonical host and active public base path.
- RSS uses root-mounted post URLs and exposes a conventional `/rss.xml` alias.
- Sitemap uses root-mounted post URLs and exposes `/sitemap.xml`.
- Preview token output uses the active base path.
- `/blog/**` legacy paths redirect permanently to their root equivalent.
- Unknown article slug returns HTTP 404.
- Draft, scheduled, protected, and changelog content retains existing visibility behavior.
- Search/filter/archive URLs remain crawlable and do not create duplicate canonicals.
- A decision is made about changelog content in blog mode: keep a separate `/changelog`, include it in the content
  surface, or omit it. Do not change this implicitly.
- Add `robots.txt` handling/documentation; the app currently has no dedicated robots file in `apps/otta-web`.

## Security and tenancy checklist

- Do not reuse `features.ottablog.mode` for public-surface selection.
- Do not trust browser headers or query parameters as authoritative domain-to-org mappings.
- Keep appId server-configured.
- Preserve RLS context for editorial/admin CRUD.
- Use the resolved/verified site mapping for every public post, taxonomy, theme, plugin, feed, sitemap, and SEO lookup.
- Make public API and edge SEO tenant resolution identical.
- Unknown managed custom host must not fall back to another organization's or platform's blog.
- Preserve host-bound session cookies.
- Keep auth and mutation APIs guarded exactly as today; hiding navigation is not authorization.
- Continue sanitizing editor HTML, URLs, JSON scripts, and CSS using the existing Ottabase sanitizer helpers.

## Tests that should accompany implementation

Repository rules require tests and documentation for this change. At minimum:

### Config tests

- Default surface resolves to `app`.
- Explicit `blog` resolves correctly.
- Unknown values fail or normalize according to the chosen config policy.
- Blog surface with Ottablog disabled fails clearly.
- Environment override behavior is tested only if runtime delivery is implemented.

### Client router tests

- App mode preserves all current paths.
- Blog mode maps `/` and `/:slug` correctly.
- Static private/auth/archive paths outrank `/:slug`.
- Unrelated public app routes are absent/404 in blog mode.
- Legacy links navigate through permanent server redirects rather than duplicate client pages.

### Worker tests

- Root blog document flow.
- Root article SEO injection.
- Correct canonical host/path.
- Root article missing -> HTTP 404.
- Blog theme injection for both base paths.
- RSS/sitemap output in both surfaces.
- Preview path in both surfaces.
- Shortlink collision policy.
- Static assets remain servable and Worker-first scope is no broader than intended.

### Tenancy tests

- Platform mode remains unchanged.
- Org mode scopes posts, taxonomy, themes, feeds, and SEO identically.
- Public supporting data no longer leaks through generic CRUD hooks.
- Unknown custom host fails closed in any future host-aware implementation.
- `blog.example.com` is not interpreted as org slug `blog` once explicit domain mapping is enabled.

### Navigation/layout tests

- Public blog fallback nav contains only blog-appropriate links.
- Authenticated editorial action requires content permission.
- Studio and admin layouts remain reachable.
- Dark mode and Brand Scope behavior are preserved.

### Documentation

- Update app README with the new setting and route contract.
- Update Ottablog README with mounting/base-path behavior.
- Document Cloudflare Custom Domain setup for self-deployers.
- Document incompatibility/interaction with root shortlinks.
- Document auth behavior across separate hostnames.

## Suggested implementation order

1. Finalize the product decision:
    - Sole blog deployment only, or simultaneous app + blog host?
    - Clean root article URLs required?
    - Is managed customer-domain onboarding in scope now or later?

2. Implement `publicSurface` in `@ottabase/config`:
    - Types.
    - Defaults and validation.
    - Config loader/export.
    - Tests and docs.

3. Extract blog public path helpers:
    - Base path.
    - Post/archive/feed/sitemap/preview builders.
    - Document path parsing.
    - Tests.

4. Build app/blog client route profiles:
    - Root index/detail/archive paths.
    - Preserve private routes.
    - Remove unrelated public routes in blog mode.
    - Reserved slug behavior.

5. Update public blog reads:
    - Add missing public series endpoints.
    - Remove generic CRUD reads from public pages where domain scoping matters.

6. Update Worker document behavior:
    - SEO and theme injection.
    - Root 404 status.
    - Legacy redirects.
    - Selective Worker-first handling for `/` if needed.

7. Update RSS, sitemap, previews, and every internal link.

8. Add blog-specific layout/menu defaults and editorial affordance cleanup.

9. Resolve shortlink behavior and enforce reserved Post slugs in the model.

10. Run focused tests, then workspace lint/type-check/test/build gates for every touched workspace.

11. Only after deploy-wide mode is stable, design `SiteDomain` and Cloudflare for SaaS support if required.

## Recommended scope for the first pull request

Include:

- Build-time `publicSurface: 'app' | 'blog'`.
- Clean blog-root routes.
- Central URL/path helpers.
- Edge SEO/theme base-path parity.
- RSS/sitemap/preview parity.
- Blog-only navigation/layout defaults.
- Reserved slug and shortlink policy.
- Legacy redirects and real article 404s.
- Tests and documentation.

Exclude:

- Per-organization domain records.
- Cloudflare API automation.
- Cloudflare for SaaS onboarding.
- Cross-subdomain SSO.
- Arbitrary blog base paths.
- A second frontend/Worker.
- Per-host Brand Engine persistence.

This keeps the first change useful to solo founders while avoiding a premature domain platform.

## Decisions to answer tomorrow

Recommended defaults are shown in parentheses.

1. Is the immediate goal a deployment that is entirely blog-first, or one Worker serving both `app.` and `blog.`
   simultaneously? (**Entire blog-first deployment first.**)
2. Should article URLs be `https://blog.example.com/my-post` or retain `/blog/my-post`? (**Clean root article URLs.**)
3. Should non-blog public template pages return 404 or remain reachable by deep link? (**404; private/editor/admin paths
   remain.**)
4. Should `/admin/**` be usable on the blog host? (**Yes, deep-linkable but absent from public nav.**)
5. Where should the public "New Post" action go? (**`/studio/new`, permission-gated.**)
6. What happens to root shortlinks? (**Explicit `/go/:code` namespace in blog mode.**)
7. Is changelog part of the blog surface? (**Keep behavior explicit and unchanged initially; decide separately.**)
8. Is a runtime environment override required in the first release? (**No; build-time config first.**)
9. Are customer-owned custom domains being managed by Ottabase itself? (**No in phase one; document deployer-owned
   Worker Custom Domains.**)

## Definition of done for blog surface v1

- One documented config value turns a stock Otta-Web deployment into a coherent blog-first public site.
- `/` and clean article/archive URLs work on direct navigation and client navigation.
- Editors can authenticate and use Studio without exposing generic app navigation.
- App mode is behaviorally unchanged.
- Edge SEO, theme CSS, preview URLs, RSS, and sitemap all agree on the active public URL scheme.
- Missing articles and hidden unrelated public pages return correct HTTP statuses.
- Root shortlinks cannot hijack article routes.
- Org-mode data remains consistently scoped across posts, taxonomy, themes, feeds, and SEO.
- Cloudflare custom-domain deployment is documented.
- Tests, README/docs, lint, type-check, test, and build gates pass for every affected workspace.

## High-value files to reopen first

- [`packages/config/src/ottabase-types.ts`](packages/config/src/ottabase-types.ts)
- [`packages/config/src/defineOttabaseConfig.ts`](packages/config/src/defineOttabaseConfig.ts)
- [`packages/config/src/resolveConfigWithEnv.ts`](packages/config/src/resolveConfigWithEnv.ts)
- [`apps/otta-web/ottabase/ottabase.config.ts`](apps/otta-web/ottabase/ottabase.config.ts)
- [`apps/otta-web/ottabase/config.loader.ts`](apps/otta-web/ottabase/config.loader.ts)
- [`apps/otta-web/src/router.tsx`](apps/otta-web/src/router.tsx)
- [`apps/otta-web/cloudflare-worker.ts`](apps/otta-web/cloudflare-worker.ts)
- [`apps/otta-web/worker/routes/blog.ts`](apps/otta-web/worker/routes/blog.ts)
- [`packages/ottablog/src/router/router.ts`](packages/ottablog/src/router/router.ts)
- [`packages/ottablog/src/router/handlers.ts`](packages/ottablog/src/router/handlers.ts)
- [`packages/ottablog/src/seo.ts`](packages/ottablog/src/seo.ts)
- [`apps/otta-web/worker/lib/blog-seo-inject.ts`](apps/otta-web/worker/lib/blog-seo-inject.ts)
- [`apps/otta-web/worker/lib/blog-theme-inject.ts`](apps/otta-web/worker/lib/blog-theme-inject.ts)
- [`apps/otta-web/worker/routes/shortlinks.ts`](apps/otta-web/worker/routes/shortlinks.ts)
- [`apps/otta-web/src/pages/blog/BlogListPage.tsx`](apps/otta-web/src/pages/blog/BlogListPage.tsx)
- [`apps/otta-web/src/pages/blog/BlogDetailPage.tsx`](apps/otta-web/src/pages/blog/BlogDetailPage.tsx)
- [`apps/otta-web/src/pages/studio/StudioShell.tsx`](apps/otta-web/src/pages/studio/StudioShell.tsx)
- [`apps/otta-web/src/ottabase/components/layout/layout.constants.ts`](apps/otta-web/src/ottabase/components/layout/layout.constants.ts)
- [`packages/brand-engine-react/src/LayoutResolver.tsx`](packages/brand-engine-react/src/LayoutResolver.tsx)
- [`packages/brand-engine/src/persistence/schema.ts`](packages/brand-engine/src/persistence/schema.ts)
- [`packages/auth/src/session-store.ts`](packages/auth/src/session-store.ts)
- [`apps/otta-web/wrangler.jsonc`](apps/otta-web/wrangler.jsonc)

## Worktree note

The repository was already dirty during exploration, with unrelated ongoing changes including Otta-Web
home/demo/PDF/premium work and a new `packages/cf-pdf` package. No existing file was edited as part of the exploration.
Preserve all pre-existing changes and run `git status --short` before implementation.

This handoff document is the only file intentionally added for the blog-separation exploration.
