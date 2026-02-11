# Task 03: Theme Variants (Brand Engine)

## Goal

Enable seasonal or campaign themes that can overlay on any layout. This allows changing the look (colors, tokens)
without changing the structural layout.

## Plan

### 1. Schema

- [x] Update `packages/brand-engine/src/persistence/schema.ts`
- [x] Define `themeVariantsTable` (`id`, `organizationId`, `appId`, `name`, `slug`, `tokensJson`, `activeFrom`,
      `activeUntil`, `description`, `createdAt`, `updatedAt`)

### 2. ThemeVariant Model

- [x] Create `packages/brand-engine/src/persistence/ThemeVariant.model.ts`
- [x] Implement CRUD methods
- [x] Add method to merge tokens onto base theme (`mergeTokens`, `findActiveForDate`)

### 3. API Handlers

- [x] Create `packages/brand-engine/src/handlers/theme-variant-api.ts`
- [x] `GET /api/brand/themes` - List variants
- [x] `POST /api/brand/themes` - Create variant (RBAC: `brand:edit`)
- [x] `PUT /api/brand/themes/:id` - Update variant (RBAC: `brand:edit`)
- [x] `DELETE /api/brand/themes/:id` - Delete variant (RBAC: `brand:edit`)
- [x] `PUT /api/brand/layouts` - Create/update templates (layout-api; RBAC enforced at route layer when auth enabled)

### 4. Theme Resolution Logic

- [x] Update `handleGetBrand` to accept `?themeVariant=id` or `?themeVariant=active`
- [x] If a theme variant is active, merge its tokens over the base `brandSettings` tokens BEFORE generating CSS
      variables
- [x] `brandSettingsToConfig` accepts optional `themeVariantTokens` and deep-merges with tenant theme

## References

- See Phase 3 in `packages/brand-engine/BRAND_ENGINE_PLAN.md`.
