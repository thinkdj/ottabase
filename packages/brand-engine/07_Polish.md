# Task 07: Polish & Extensions (Brand Engine)

## Goal

Add finishing touches, optimizations, and extended features like Email Branding and Audit Logging.

## Plan

### 1. Email Branding

- [ ] Create `packages/brand-engine/src/email/brand-email.ts`
- [ ] Implement `applyBrandToEmail(html, config)`
- [ ] Replace placeholders like `{{brandName}}`, `{{logoUrl}}`, `{{primaryColor}}` in email templates

### 2. Favicon Generation

- [ ] Enhance Logo Upload API to auto-generate favicons (ico, png) from uploaded icon if possible (using CF Images or
      similar tool)

### 3. Audit Log Integration

- [ ] Integrate with `@ottabase/audit` in API handlers
- [ ] Log:
    - `brand.update`
    - `brand.apply` (BrandBox activity)
    - `brand.logo.upload`

### 4. Documentation

- [ ] Write a `README.md` for `@ottabase/brand-engine` usage
- [ ] Document API endpoints
- [ ] Document how to create new Layout Components in apps

## References

- See Phase 7 in `packages/brand-engine/BRAND_ENGINE_PLAN.md`.
