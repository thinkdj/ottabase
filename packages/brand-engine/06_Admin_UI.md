# Task 06: Admin UI (Brand Engine)

## Goal

Build the internal Admin UI to manage brand settings, layouts, and BrandBoxes. This allows non-technical users to
control branding.

## Plan

### 1. Package Setup

- [x] Admin UI in app (`apps/ottabase-template-app-tanstack/src/pages/admin/`) – no separate package (KISS)

### 2. Components

- [x] **LogoUploader**: Drag & drop zone, uploads via POST /api/brand/logo/:type
- [ ] **ColorPicker**: Helper for picking hex/rgba colors (optional)
- [ ] **FontSelector**: Dropdown to select Google Fonts (optional)
- [ ] **TokenEditor**: Visual editor for design tokens; JSON textarea in BrandSettingsTab (optional: WCAG contrast)
- [ ] **BrandPreview**: Live preview iframe (optional)

### 3. Pages / Views

- [x] **BrandSettingsTab**: Tabs for Identity, Logos, Tokens, Advanced
- [x] **BrandBoxManagerTab**: List boxes, Create (snapshots current), Edit name, Apply, Duplicate, Delete
- [x] **LayoutEditorTab**: Layout templates (create, edit) + route mappings
- [x] **ThemeVariantEditorTab**: Create, edit, delete theme variants

### 4. Integration

- [x] **AdminBrandEnginePage** – tabbed entry (Brand Settings, BrandBoxes, Layouts, Theme Variants)
- [x] Uses `/api/brand/*`, `/api/brandbox` endpoints

### 5. RBAC / Security

- [x] RBAC guard on mutating routes: `requireBrandEditAccess` enforces `brand:edit` (or `brand:*`, `*:*`) per org
- [x] All PUT/POST/DELETE brand and brandbox routes protected; `organizationId` required; tenant isolation enforced

### 6. Optional Enhancements (future)

- ColorPicker, FontSelector for visual token editing
- TokenEditor with WCAG contrast validation
- BrandPreview iframe for live preview

## References

- See Phase 6 in `packages/brand-engine/BRAND_ENGINE_PLAN.md`.
