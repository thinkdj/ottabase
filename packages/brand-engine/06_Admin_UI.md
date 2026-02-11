# Task 06: Admin UI (Brand Engine)

## Goal

Build the internal Admin UI to manage brand settings, layouts, and BrandBoxes. This allows non-technical users to
control branding.

## Plan

### 1. Package Setup

- [ ] Initialize `packages/brand-engine-admin`
- [ ] Install dependencies: `react`, `@tanstack/react-query`, `@ottabase/ui-shadcn`, `lucide-react`

### 2. Components

- [ ] **LogoUploader**: Drag & drop zone, uploads to R2 via API
- [ ] **ColorPicker**: Helper for picking hex/rgba colors
- [ ] **FontSelector**: Dropdown to select Google Fonts
- [ ] **TokenEditor**: JSON or Visual editor for design tokens
    - [ ] Add contrast validation warning (WCAG)
- [ ] **BrandPreview**: Live preview iframe or component showing current settings

### 3. Pages / Views

- [ ] **BrandSettingsPage**: Tabs for Identity, Colors, Typography, Advanced
- [ ] **BrandBoxManager**: List view of boxes, Create/Edit modal, "Apply" button
- [ ] **LayoutTemplateEditor**: Manage layout templates and route mappings
- [ ] **ThemeVariantEditor**: Manage seasonal themes

### 4. Integration

- [ ] Expose `BrandAdminPage` as the main entry point
- [ ] Ensure it uses the API endpoints created in previous phases (`/api/brand/*`)

## References

- See Phase 6 in `packages/brand-engine/BRAND_ENGINE_PLAN.md`.
