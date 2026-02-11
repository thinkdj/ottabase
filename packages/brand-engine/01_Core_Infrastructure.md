# Task 01: Core Infrastructure (Brand Engine)

## Goal

Implement the foundational persistence and caching layer for the Brand Engine. By the end of this task, we should be
able to store brand settings in D1, cache them in KV, upload logos to R2, and fetch them via an API.

## Plan

### 1. Database Schema (D1)

- [x] Create `packages/brand-engine/src/persistence/schema.ts`
- [x] Define `brandSettingsTable` with fields:
    - `id`, `organizationId`, `appId`
    - `brandName`, `tagline`
    - `logoKey`, `logoDarkKey`, `iconKey`, `ogImageKey`, `emailLogoKey`
    - `tokensJson`, `layoutJson`
    - `defaultColorScheme`, `allowDarkModeToggle`
    - `isDraft`, `version`, `previousVersionJson`
    - `customCss`, `customMetaJson`, `hideOttabaseBranding`
    - `createdAt`, `updatedAt`
- [x] Export `BrandSettingsType` and `NewBrandSettingsType`

### 2. OttaORM Model

- [x] Create `packages/brand-engine/src/persistence/BrandSettings.model.ts`
- [x] Implement `BrandSettings` class extending `BaseModel`
- [x] Add `resolve(orgId, appId, userId)` static method (Draft -> App -> Org -> Default)
- [x] Add `getOrCreateDefault()` method
- [x] Add `createDraft()`, `publish()` methods
- [x] Add `toBrandTheme()` converter
- [x] Add `getLogoUrls(r2PublicUrl)` helper
- [x] Define `casts` property for boolean/date fields

### 3. KV Caching Layer

- [x] Create `packages/brand-engine/src/persistence/cache.ts`
- [x] Implement `createBrandCache(kv)`
- [x] `get(orgId, appId, previewBoxId)`
- [x] `set(orgId, appId, config, previewBoxId)`
- [x] `invalidate(orgId, appId)`

### 4. R2 Asset Management

- [x] Create `packages/brand-engine/src/persistence/assets.ts`
- [x] Implement `createBrandAssets(bucket, publicUrl)`
- [x] `uploadLogo(file, filename, type)`
- [x] `deleteLogo(key)`
- [x] `getPublicUrl(key)`

### 5. API Handlers

- [x] Create `packages/brand-engine/src/handlers/brand-api.ts`
- [x] `GET /api/brand` - Resolve settings, use cache, return JSON
    - Support `?organizationId=&appId=` query params
- [x] `PUT /api/brand` - Update settings, invalidate cache
    - **Updateable Fields**: `brandName`, `tagline`, `tokensJson`, `layoutJson`, `defaultColorScheme`,
      `allowDarkModeToggle`, `customCss`, `hideOttabaseBranding`
    - **RBAC**: Require `brand:edit` or `brand:*`
- [x] `POST /api/brand/logo` - Upload logo to R2, update settings
    - **RBAC**: Require `brand:edit` or `brand:*` (enforce at route layer)

### 6. React Provider (Minimal)

- [x] Create `packages/brand-engine-react/src/BrandProvider.tsx`
- [x] Fetch config from API (support `?organizationId=&appId=` query params)
- [x] Apply theme using `applyBrandTheme` (from existing `css-runtime.ts`)
- [x] Inject `customCss`

## References

- See `packages/brand-engine/BRAND_ENGINE_PLAN.md` for full code snippets.
