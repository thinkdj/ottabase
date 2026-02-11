# Task 02: Layout System (Brand Engine)

## Goal

Add layout-per-path capabilities without BrandBox. This allows defining multiple layout templates (e.g., Homepage, App
Shell, Docs) and mapping them to route paths.

## Plan

### 1. Layout Schema

- [ ] Create `packages/brand-engine/src/layouts/schema.ts` (or add to `persistence/schema.ts`)
- [ ] Define `layoutTemplatesTable` (`id`, `name`, `componentKey`, `configJson`)
- [ ] Define `layoutRouteMappingsTable` (`pathPattern`, `priority`, `layoutTemplateId`)

### 2. Layout Models

- [ ] Create `packages/brand-engine/src/persistence/LayoutTemplate.model.ts`
- [ ] Create `packages/brand-engine/src/persistence/RouteMapping.model.ts` (helper model or direct Drizzle queries)

### 3. Layout Registry & Resolver (Core)

- [ ] Create `packages/brand-engine/src/layouts/registry.ts`
- [ ] Implement `registerLayoutComponent(key, Component)`
- [ ] Implement `getLayoutComponent(key)`
- [ ] Implement `pathPatternToRegex(pattern)`
- [ ] Implement `resolveLayoutForPath(pathname, mappings)`

### 4. Layout API Handlers

- [ ] Create `packages/brand-engine/src/handlers/layout-api.ts`
- [ ] `GET /api/brand/layouts` - List templates
- [ ] `PUT /api/brand/layouts` - Create/update templates
- [ ] `GET /api/brand/mappings` - List route mappings
- [ ] `PUT /api/brand/mappings` - Update route mappings

### 5. Extend BrandProvider & Config

- [ ] Update `BrandProvider` context to include `routeMappings` and `layoutTemplatesMap`
- [ ] Update `resolveBrandConfig` in `BrandResolver` to include global layout mappings

### 6. React Layout Resolver

- [ ] Create `packages/brand-engine-react/src/LayoutResolver.tsx`
- [ ] Implement logic to match current path against `config.routeMappings`
- [ ] Resolve component via registry
- [ ] Render the resolved layout component wrapping children

## References

- See Phase 2 in `packages/brand-engine/BRAND_ENGINE_PLAN.md`.
