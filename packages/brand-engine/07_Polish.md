# Task 07: Polish & Extensions (Brand Engine)

## Goal

Add finishing touches, optimizations, and extended features like Email Branding and Audit Logging.

## Plan

### 1. Email Branding

- [x] Create `packages/brand-engine/src/email/brand-email.ts`
- [x] Implement `applyBrandToEmail(html, config)`
- [x] Replace placeholders like `{{brandName}}`, `{{logoUrl}}`, `{{primaryColor}}` in email templates

### 2. Favicon Generation

- [x] Add `getFaviconUrl(config)` helper (icon URL suitable as favicon)
- [ ] Future: CF Images to auto-generate favicon.ico, apple-touch-icon from icon upload

### 3. Audit Log Integration

- [x] Integrate with `@ottabase/audit` in API handlers
- [x] Log:
    - `brand.update`
    - `brand.apply` (BrandBox activity)
    - `brand.logo.upload`

### 4. Documentation

- [x] Write a `README.md` for `@ottabase/brand-engine` usage
- [x] Document API endpoints
- [x] Document how to create new Layout Components in apps

## References

- See Phase 7 in `packages/brand-engine/BRAND_ENGINE_PLAN.md`.
