# Task 04: BrandBox (Brand Engine)

## Goal

Implement "BrandBox" - a unified preset containing Layout + Theme + Config + Logos. This enables one-click application
of a complete brand look.

## Plan

### 1. BrandBox Schema

- [ ] Update `packages/brand-engine/src/persistence/schema.ts`
- [ ] Define `brandBoxesTable` with:
    - `id`, `name`, `slug`, `isActive`
    - `identityJson`, `logosJson`, `tokensJson`, `themeVariantId`
    - `routeMappingsJson`, `layoutOverridesJson`
    - `layoutTemplatesSnapshotJson` (snapshot of layouts at time of creation/update)

### 2. BrandBox Model

- [ ] Create `packages/brand-engine/src/persistence/BrandBox.model.ts`
- [ ] Implement `activate(orgId, appId)` (sets existing active boxes to false)
- [ ] Implement `snapshot()` method to capture current layout templates

### 3. Updated Brand Resolver

- [ ] Refactor `BrandResolver.ts` to prioritize Active BrandBox
- [ ] Logic:
    1. Check for `previewBrandBoxId` (preview mode)
    2. Check for Active BrandBox ( `isActive=true` )
    3. Fallback to `BrandSettings` table
- [ ] Ensure `ResolvedBrandConfig` takes values from BrandBox if present

### 4. API Handlers

- [ ] Create `packages/brand-engine/src/handlers/brandbox-api.ts`
- [ ] `GET /api/brandbox` - List boxes
- [ ] `POST /api/brandbox` - Create box
- [ ] `POST /api/brand/apply` - Apply a BrandBox (activates it, invalidates cache)
- [ ] `POST /api/brandbox/:id/duplicate` - Duplicate a box

### 5. Client Integration

- [ ] Update `BrandProvider` to support `?brandPreview=BOX_ID` query param for previewing non-active boxes

## References

- See Phase 4 in `packages/brand-engine/BRAND_ENGINE_PLAN.md`.
