# Task 03: Theme Variants (Brand Engine)

## Goal

Enable seasonal or campaign themes that can overlay on any layout. This allows changing the look (colors, tokens)
without changing the structural layout.

## Plan

### 1. Schema

- [ ] Update `packages/brand-engine/src/persistence/schema.ts`
- [ ] Define `themeVariantsTable` (`id`, `name`, `slug`, `tokensJson`, `activeFrom`, `activeUntil`)

### 2. ThemeVariant Model

- [ ] Create `packages/brand-engine/src/persistence/ThemeVariant.model.ts`
- [ ] Implement CRUD methods
- [ ] Add method to merge tokens onto base theme

### 3. API Handlers

- [ ] Create `packages/brand-engine/src/handlers/theme-variant-api.ts`
- [ ] `GET /api/brand/themes` - List variants
- [ ] `POST /api/brand/themes` - Create variant
- [ ] `PUT /api/brand/themes/:id` - Update variant
- [ ] `DELETE /api/brand/themes/:id` - Delete variant

### 4. Theme Resolution Logic

- [ ] Update `BrandResolver.ts` to accept an optional `themeVariantId` or logic to pick active variant
- [ ] If a theme variant is active, merge its tokens over the base `brandSettings` tokens BEFORE generating CSS
      variables
- [ ] Review `css-runtime.ts` to ensure merged tokens are applied correctly

## References

- See Phase 3 in `packages/brand-engine/BRAND_ENGINE_PLAN.md`.
