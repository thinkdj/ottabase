# Brand Engine – Full Implementation Plan

This plan addresses all retrospective findings. Changes span **package**, **app** (worker + src), and **admin** UI.

**Note**: No backward compatibility. This is the definitive version shipping to production.

---

## Phase 1: Consolidate BrandSettings + BrandBox

**Goal**: Single model `BrandConfig` (or extended `BrandSettings`). Drop `brand_boxes` table.

### 1.1 Schema & Model (Package)

- **Merge strategy**: Extend `brand_settings` table; add columns from BrandBox; drop `brand_boxes`.
- **New `brand_settings` columns** (add to existing):
    - `name` (text, nullable) – preset name (e.g. "Default", "Christmas 2024"); null = default/baseline for org/app
    - `slug` (text, nullable)
    - `is_active` (integer/boolean, default false) – at most one active per org/app; used for "Apply"
    - `theme_variant_id` (text, nullable) – links to theme_variants
    - `route_mappings_json` (text, nullable) – when set, overrides layout_data mappings
    - `layout_templates_snapshot_json` (text, nullable) – when set, overrides layout_data templates
- **Keep** `is_draft`, `version`, `previous_version_json` for draft/publish workflow.
- **Semantics**: Rows with `name IS NULL` = default config for org/app. Rows with `name` = named presets. One per
  org/app can have `is_active = true`. Resolution: preview by id → findActive → resolve (draft → app → org → system
  default).
- **Migration**: Create migration that:
    1. Adds new columns to `brand_settings`
    2. Migrates `brand_boxes` rows into `brand_settings` (map identityJson → brandName/tagline, logosJson → logo
       columns, etc.)
    3. Drops `brand_boxes` table
- **Delete**: `BrandBox.model.ts`, `brandBoxToConfig.ts`, `brand_boxesTable` from schema.
- **Refactor**: Keep class name `BrandSettings`; add preset methods – add `findActive()`, `activate()`,
  `deactivateAll()`, `snapshot()`, `getRouteMappings()`, `getLayoutTemplatesSnapshot()` from BrandBox.
- **Unify converter**: Single `brandConfigToResolvedConfig(settings, r2Url, mode, layoutData?, themeVariantTokens?)` –
  merge logic from `brandSettingsToConfig` and `brandBoxToConfig`.

### 1.2 Handlers (Package)

- **Merge** `brandbox-api.ts` into `brand-api.ts`. All preset handlers live in brand-api.
- **Handler names**:
    - `handleGetBrandBoxes` → `handleGetBrandPresets` – list rows where `name IS NOT NULL` (or all for org/app)
    - `handleCreateBrandBox` → `handleCreateBrandPreset` – create BrandConfig with name, snapshot from current
    - `handleUpdateBrandBox` → `handleUpdateBrandPreset`
    - `handleDeleteBrandBox` → `handleDeleteBrandPreset`
    - `handleApplyBrandPreset` – activate preset (set isActive, deactivate others); `POST /api/brand/apply` body:
      `{ presetId }`
    - `handleDuplicateBrandBox` → `handleDuplicateBrandPreset`

### 1.3 Resolution (Package)

- **Update `resolveBrandConfig`**:
    1. `brandPreview` → find by id (BrandConfig)
    2. `BrandConfig.findActive(org, app)` – replaces BrandBox.findActive
    3. `BrandConfig.resolve(org, app, userId)` – current BrandSettings resolve logic
- **Remove** all BrandBox imports.

### 1.4 Worker Routes (App)

- **Routes**: `/api/brand/presets` for all preset CRUD. Delete `brandbox.ts`; merge into single `brand.ts`.
- **Paths**: `GET/POST /api/brand/presets`, `PUT/DELETE /api/brand/presets/:id`,
  `POST /api/brand/presets/:id/duplicate`, `POST /api/brand/apply` (body: `{ presetId }`).
- **Update** `db-utils.ts` and router: Remove `BrandBox`; remove `handleBrandboxApi`; wire all routes in
  `handleBrandApi`.

### 1.5 Admin UI (App)

- **Rename** `BrandBoxManagerTab` → `BrandPresetManagerTab`. Tab label: "Presets".
- **API base**: `/api/brand/presets`.
- Update types: preset = BrandConfig with name, isActive.
- **BrandSettingsTab**: No structural change; still edits "default" BrandConfig.

### 1.6 Bootstrap / Schema Collection (App)

- Remove `brand_boxes` from schema collection; ensure `brand_settings` has new columns.
- Update any `getAllSchemas` / migrations that reference brand_boxes.

---

## Phase 2: Fix F2–F5 (Peer Review)

### 2.1 F2 – Theme Preview Propagation

**Package**:

- Ensure `resolveBrandConfig` accepts and uses `themeVariant` (already does).

**Brand-engine-react**:

- Add `themeVariant` prop to `BrandProvider`.
- In `fetchConfig`, append `?themeVariant=...` when prop or `?themeVariant=` in URL.
- Pass through to API.

**App (Edge)**:

- In `injectBrandCriticalCSS`, pass `themeVariant: url.searchParams.get('themeVariant') ?? undefined` to
  `resolveBrandConfig`.

### 2.2 F3 – Automatic Themes (Date-Based)

**Package**:

- In `resolveBrandConfig`, when `themeVariant` is NOT provided:
    - Call `ThemeVariant.findActiveForDate(orgId, appId)`.
    - If found, merge `variant.getTokens()` into config.
- Update cache key or invalidation if active variant can change by date (e.g. include `date` in key or short TTL for
  variant paths).

### 2.3 F4 – Publish Duplication Fix

**Package**:

- In `BrandSettings.publish()`:
    - Before setting self as published, find existing published for same org/app.
    - If found: either (a) soft-delete/archive it, or (b) set `is_active` false / mark as superseded, or (c) enforce
      single published row via unique constraint and UPDATE in place.
- **Recommended**: When publishing a draft, UPDATE the existing published row’s content from the draft, then delete the
  draft. Or: ensure only one `isDraft: false` per (org, app) via DB constraint and `first()` ordering.

### 2.4 F5 – JSON Validation

**Package**:

- In `handleUpdateBrand` and any handler that accepts `tokensJson`, `layoutJson`, `routeMappingsJson`, etc.:
    - Parse and validate before save.
    - Use `parseJsonField`-style helper; return 400 for invalid JSON.
- Optionally: lightweight schema validation (e.g. tokensJson must be object, layoutJson must be object).
- Apply to: `handleUpdateBrand`, `handleCreateBrandPreset`, `handleUpdateBrandPreset`, `handlePutLayout`, theme variant
  handlers.

---

## Phase 3: Performance Optimizations

### 3.1 Layout Data (Package)

- **Refactor `getLayoutData`**:
    - Single query for mappings: `WHERE (orgId, appId) IN ((org, app), (org, null), (null, null))` with
      `ORDER BY priority` or resolve in app layer.
    - Batch-load templates: `LayoutTemplate.whereIn('id', templateIds)` instead of per-id `find()`.
- **Reduce N+1**: One mappings query, one templates batch query.

### 3.2 Resolution Batching (Package)

- Consider loading `BrandConfig` + `LayoutData` in parallel where independent.
- Cache `createBrandCache` instance if creation is non-trivial (inject via env or singleton).

### 3.3 Cache Key for Variants (Package)

- When F3 is active, cache key may need `activeVariantId` or date segment for correct invalidation.
- Document cache key strategy in `cache.ts`.

---

## Phase 4: DX & Consistency

### 4.1 Shared Route Helpers (App)

- Extract `getOrgApp`, `brandEnv` into shared `brand-utils.ts` in worker/lib.
- Use in both brand and preset routes.

### 4.2 Type Contracts (Package + App)

- Define `UpdateBrandPayload`, `BrandConfigResponse`, `BrandPresetCreatePayload` types.
- Export from package; use in handlers and Admin UI.
- Fix Admin UI types (e.g. BrandSettingsTab `tokensJson` on `{}`, BrandBoxManagerTab `boxes` unknown).

### 4.3 Color Scheme Propagation (Package)

- Pass `colorScheme` from request/context into `brandConfigToResolvedConfig` where possible.
- Respect `defaultColorScheme` and `allowDarkModeToggle` in resolution.

---

## Phase 5: Admin UI Polish

### 5.1 BrandPresetManagerTab (App)

- Update to use new API paths and types.
- Add `themeVariant` to preset create/edit if applicable.
- Ensure Apply, Duplicate, Delete work with consolidated model.

### 5.2 BrandSettingsTab (App)

- Proper typing for settings response (`tokensJson`, `defaultColorScheme`, etc.).
- JSON validation feedback in UI (optional).

### 5.3 LayoutEditorTab (App)

- Fix mutation types (`params` with `organizationId`, `appId`).
- Ensure route mappings and layout templates work with consolidated BrandConfig.

### 5.4 Theme Preview in Admin (App)

- Add `?themeVariant=ID` support when editing theme variants – open preview in new tab or iframe.
- Ensure BrandProvider in Admin layout passes `themeVariant` when in preview mode.

---

## Execution Order

| Phase            | Order | Dependencies       |
| ---------------- | ----- | ------------------ |
| 1. Consolidation | 1     | None               |
| 2. F2–F5         | 2     | Phase 1 done       |
| 3. Performance   | 3     | Phase 1, 2 done    |
| 4. DX            | 4     | Phase 1 done       |
| 5. Admin Polish  | 5     | Phase 1, 2, 4 done |

---

## File Change Summary

### Package (`packages/brand-engine`)

| Action | File                                                              |
| ------ | ----------------------------------------------------------------- |
| Modify | `schema.ts` – add columns, remove brand_boxesTable                |
| Delete | `BrandBox.model.ts`                                               |
| Delete | `brandBoxToConfig.ts`                                             |
| Modify | `BrandSettings.model.ts` – extend to BrandConfig behavior         |
| Create | `brandConfigToResolvedConfig.ts` (or merge into one converter)    |
| Modify | `resolveBrandConfig.ts` – single model, F3 logic                  |
| Modify | `handlers/brand-api.ts` – JSON validation, merged preset handlers |
| Delete | `handlers/brandbox-api.ts` (merge into brand-api)                 |
| Modify | `persistence/index.ts` – exports                                  |
| Modify | `layoutData.ts` – batch queries                                   |

### App Worker (`apps/.../worker`)

| Action | File                                                                 |
| ------ | -------------------------------------------------------------------- |
| Modify | `routes/brand.ts` – all brand + preset routes                        |
| Delete | `routes/brandbox.ts`                                                 |
| Modify | `lib/brand-html-inject.ts` – pass themeVariant                       |
| Modify | `lib/db-utils.ts` – remove BrandBox from registerModels              |
| Modify | `routes/router.ts` – remove handleBrandboxApi, extend handleBrandApi |

### App Admin (`apps/.../src`)

| Action | File                                                          |
| ------ | ------------------------------------------------------------- |
| Rename | `BrandBoxManagerTab.tsx` → `BrandPresetManagerTab.tsx`        |
| Modify | `pages/admin/brand/BrandSettingsTab.tsx` – types              |
| Modify | `pages/admin/brand/LayoutEditorTab.tsx` – mutation types      |
| Modify | `pages/admin/brand/brandApi.ts` – API paths, types            |
| Modify | `pages/admin/AdminBrandEnginePage.tsx` – tab labels if needed |

### Brand-engine-react (`packages/brand-engine-react`)

| Action | File                                                  |
| ------ | ----------------------------------------------------- |
| Modify | `BrandProvider.tsx` – themeVariant prop and URL param |

---

## Migration Notes

- **Data**: If `brand_boxes` has data, migrate to `brand_settings` before drop. Map: identityJson→brandName/tagline,
  logosJson→logoKey columns, tokensJson, routeMappingsJson, layoutTemplatesSnapshotJson, themeVariantId, customCss,
  hideOttabaseBranding. Set `name` from box name, `is_active` from box isActive.
- **Tests**: Update brand-engine tests for single model; add tests for F3, F4, F5.
