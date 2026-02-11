# Task 05: Edge / SSR & Zero FOUC (Brand Engine)

## Goal

Eliminate Flash of Unstyled Content (FOUC) by injecting critical CSS variables at the edge or during SSR, before the
React app hydrates.

## Plan

### 1. Critical CSS Generator

- [x] Create `packages/brand-engine/src/css-critical.ts`
- [x] Implement `buildCriticalCSS(theme)` and `buildCriticalStyleTag(theme)`

### 2. Edge Middleware / SSR Injection

- [x] Cloudflare Worker in `cloudflare-worker.ts` intercepts HTML responses
- [x] `worker/lib/brand-html-inject.ts`: `injectBrandCriticalCSS()` fetches config, builds style tag, injects before
      `</head>`
- [x] Uses `resolveBrandConfig()` (extracted to `persistence/resolveBrandConfig.ts`)

### 3. Provider Hydration

- [x] `BrandProvider` applies theme via `applyBrandTheme`, then removes `#brand-critical` to become sole owner
- [x] No hydration mismatch (SPA: critical CSS in static HTML, React hydrates root div only)

## References

- See Phase 5 in `packages/brand-engine/BRAND_ENGINE_PLAN.md`.
