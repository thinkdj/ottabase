# Task 05: Edge / SSR & Zero FOUC (Brand Engine)

## Goal

Eliminate Flash of Unstyled Content (FOUC) by injecting critical CSS variables at the edge or during SSR, before the
React app hydrates.

## Plan

### 1. Critical CSS Generator

- [ ] Enhance `css-runtime.ts` or create `packages/brand-engine/src/css-critical.ts`
- [ ] Implement `buildCriticalCSS(theme)` which returns a string: `:root { --color-primary: ...; }`

### 2. Edge Middleware / SSR Injection

- [ ] Identify the entry point for HTML response (Cloudflare Worker or Next.js middleware)
- [ ] In the handler:
    1. `await resolveBrandConfig(...)`
    2. `const criticalCss = buildCriticalCSS(config.theme)`
    3. Inject `<style id="brand-critical">${criticalCss}</style>` into the `<head>` of the HTML response

### 3. Provider Hydration

- [ ] Update `BrandProvider` to check for `#brand-critical` style tag
- [ ] Ensure it doesn't cause hydration mismatch or double-injection issues
- [ ] `BrandProvider` should "take over" and manage style updates after mount

## References

- See Phase 5 in `packages/brand-engine/BRAND_ENGINE_PLAN.md`.
