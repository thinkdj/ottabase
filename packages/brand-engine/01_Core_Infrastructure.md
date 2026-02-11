# Task 01: Core Infrastructure (Brand Engine)

## Goal

Implement the foundational persistence and caching layer for the Brand Engine. By the end of this task, we should be
able to store brand settings in D1, cache them in KV, upload logos to R2, and fetch them via an API.

## Plan

### 1. Database Schema (D1)

- [ ] Create `packages/brand-engine/src/persistence/schema.ts`
- [ ] Define `brandSettingsTable` with fields:
    - `id`, `organizationId`, `appId`
    - `brandName`, `tagline`
    - `logoKey`, `logoDarkKey`, `iconKey`, `ogImageKey`, `emailLogoKey`
    - `tokensJson`, `layoutJson`
    - `defaultColorScheme`, `allowDarkModeToggle`
    - `isDraft`, `version`, `previousVersionJson`
    - `customCss`, `customMetaJson`, `hideOttabaseBranding`
    - `createdAt`, `updatedAt`
- [ ] Export `BrandSettingsType` and `NewBrandSettingsType`

### 2. OttaORM Model

- [ ] Create `packages/brand-engine/src/persistence/BrandSettings.model.ts`
- [ ] Implement `BrandSettings` class extending `BaseModel`
- [ ] Add `resolve(orgId, appId, userId)` static method (Draft -> App -> Org -> Default)
- [ ] Add `getOrCreateDefault()` method
- [ ] Add `createDraft()`, `publish()` methods
- [ ] Add `toBrandTheme()` converter
- [ ] Add `getLogoUrls(r2PublicUrl)` helper
- [ ] Define `casts` property for boolean/date fields

### 3. KV Caching Layer

- [ ] Create `packages/brand-engine/src/persistence/cache.ts`
- [ ] Implement `createBrandCache(kv)`
- [ ] `get(orgId, appId, previewBoxId)`
- [ ] `set(orgId, appId, config, previewBoxId)`
- [ ] `invalidate(orgId, appId)`

### 4. R2 Asset Management

- [ ] Create `packages/brand-engine/src/persistence/assets.ts`
- [ ] Implement `createBrandAssets(bucket, publicUrl)`
- [ ] `uploadLogo(file, filename, type)`
- [ ] `deleteLogo(key)`
- [ ] `getPublicUrl(key)`

### 5. API Handlers

- [ ] Create `packages/brand-engine/src/handlers/brand-api.ts`
- [ ] `GET /api/brand` - Resolve settings, use cache, return JSON
    - Support `?brandPreview=box-id`
- [ ] `PUT /api/brand` - Update settings, invalidate cache
    - **Updateable Fields**: `brandName`, `tagline`, `tokensJson`, `layoutJson`, `defaultColorScheme`,
      `allowDarkModeToggle`, `customCss`, `hideOttabaseBranding`
    - **RBAC**: Require `brand:edit` or `brand:*`
- [ ] `POST /api/brand/logo` - Upload logo to R2, update settings
    - **RBAC**: Require `brand:edit` or `brand:*`

### 6. React Provider (Minimal)

- [ ] Create `packages/brand-engine-react/src/BrandProvider.tsx`
- [ ] Fetch config from API (support `?brandPreview=` arg)
- [ ] Apply theme using `applyBrandTheme` (from existing `css-runtime.ts`)
- [ ] Inject `customCss`

## References

- See `packages/brand-engine/BRAND_ENGINE_PLAN.md` for full code snippets.
