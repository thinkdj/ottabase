# Task 04: BrandBox (Brand Engine)

## Goal

Implement "BrandBox" - a unified preset containing Layout + Theme + Config + Logos. This enables one-click application
of a complete brand look.

## Plan

### 1. BrandBox Schema

- [x] Update `packages/brand-engine/src/persistence/schema.ts`
- [x] Define `brandBoxesTable` with:
    - `id`, `organizationId`, `appId`
    - `name`, `slug`, `isActive`
    - `identityJson`, `logosJson`, `tokensJson`, `themeVariantId`
    - `routeMappingsJson`, `layoutOverridesJson`
    - `layoutTemplatesSnapshotJson` (snapshot of layouts at time of creation/update)
    - `customCss`, `customMetaJson`, `hideOttabaseBranding`
    - `activeFrom`, `activeUntil` (Scheduling)
    - `createdAt`, `updatedAt`

### 2. BrandBox Model

- [x] Create `packages/brand-engine/src/persistence/BrandBox.model.ts`
- [x] Implement `activate()` (deactivates others via `deactivateAll`, sets this active)
- [x] Implement `snapshot()` method to capture current layout templates
- [x] Implement `findActive(orgId, appId)` for resolution

### 3. Updated Brand Resolver

- [x] Refactor `handleGetBrand` to prioritize Active BrandBox
- [x] Logic:
    1. Check for `?brandPreview=box-id` (preview mode)
    2. Check for Active BrandBox (`isActive=true`)
    3. Fallback to `BrandSettings` table
- [x] `brandBoxToConfig()` converts BrandBox to ResolvedBrandConfig

### 4. API Handlers

- [x] Create `packages/brand-engine/src/handlers/brandbox-api.ts`
- [x] `GET /api/brandbox` - List boxes
- [x] `POST /api/brandbox` - Create box (RBAC: `brand:edit`)
- [x] `PUT /api/brandbox/:id` - Update box (RBAC: `brand:edit`)
- [x] `DELETE /api/brandbox/:id` - Delete box (RBAC: `brand:edit`)
- [x] `POST /api/brand/apply` - Apply a BrandBox (activates it, invalidates cache) (RBAC: `brand:apply`)
- [x] `POST /api/brandbox/:id/duplicate` - Duplicate a box (RBAC: `brand:edit`)

### 5. Client Integration

- [x] Update `BrandProvider` to support `brandPreview` prop and `?brandPreview=BOX_ID` URL param

## References

- See Phase 4 in `packages/brand-engine/BRAND_ENGINE_PLAN.md`.
