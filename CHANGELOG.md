# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (Unreleased)

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
