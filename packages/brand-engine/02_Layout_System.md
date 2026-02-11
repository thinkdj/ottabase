# Task 02: Layout System (Brand Engine)

## Goal

Add layout-per-path capabilities without BrandBox. This allows defining multiple layout templates (e.g., Homepage, App
Shell, Docs) and mapping them to route paths.

## Plan

### 1. Layout Schema

- [x] Add to `packages/brand-engine/src/persistence/schema.ts`
- [x] Define `layoutTemplatesTable` (`id`, `organizationId`, `appId`, `name`, `componentKey`, `configJson`)
- [x] Define `layoutRouteMappingsTable` (`pathPattern`, `priority`, `layoutTemplateId`)

### 2. Layout Models

- [x] Create `packages/brand-engine/src/persistence/LayoutTemplate.model.ts`
- [x] Create `packages/brand-engine/src/persistence/LayoutRouteMapping.model.ts`

### 3. Layout Registry & Resolver (Core)

- [x] Create `packages/brand-engine/src/layouts/` (presets.ts, resolver.ts, index.ts)
- [x] Path resolver in brand-engine; component registry in brand-engine-react
- [x] Implement `pathPatternToRegex(pattern)` and `resolveLayoutForPath(pathname, mappings)`
- [x] Presets: HOMEPAGE_LAYOUT, APP_SHELL_LAYOUT, DOCS_LAYOUT, MINIMAL_LAYOUT

### 4. Layout API Handlers

- [x] Create `packages/brand-engine/src/handlers/layout-api.ts`
- [x] `GET /api/brand/layouts` - List templates
- [x] `PUT /api/brand/layouts` - Create/update templates
- [x] `GET /api/brand/mappings` - List route mappings
- [x] `PUT /api/brand/mappings` - Update route mappings

### 5. Extend BrandProvider & Config

- [x] Update `BrandProvider` / `BrandConfig` to include `routeMappings` and `layoutTemplatesMap`
- [x] Extend GET /api/brand to fetch layout data via `getLayoutData()` and merge into config

### 6. React Layout Resolver

- [x] Create `packages/brand-engine-react/src/LayoutResolver.tsx`
- [x] Implement logic to match current path against `config.routeMappings`
- [x] Resolve component via registry (`registerLayoutComponent`, `getLayoutComponent`)
- [x] Render the resolved layout component wrapping children

## References

- See Phase 2 in `packages/brand-engine/BRAND_ENGINE_PLAN.md`.
