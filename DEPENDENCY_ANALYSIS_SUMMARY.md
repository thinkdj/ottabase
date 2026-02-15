# Ottabase Dependency Consistency Analysis - Executive Summary

**Analysis Date:** February 15, 2026
**Packages Analyzed:** 41 total
**Analysis File:** `/home/user/ottabase/DEPENDENCY_ANALYSIS.json`

## Overview

This analysis evaluates the consistency and appropriateness of dependencies defined in the pnpm workspace catalog (`pnpm-workspace.yaml`) across all 41 packages in the Ottabase monorepo.

## Key Findings

### 1. Overall Health: GOOD (Minor Improvements Needed)

- **Total catalog entries:** 81
- **Actually used:** 49 (60.5%)
- **Never used:** 32 (39.5%)
- **Version mismatches:** 0 (Perfect!)

### 2. Critical Issues

#### Issue #1: 32 Unused Catalog Entries (39.5%)
These dependencies are defined in the catalog but not used by any package:
- Babel toolchain: `@babel/core`, `@babel/preset-env`, `@babel/preset-react`, `@babel/preset-typescript`, `babel-loader`
- Storybook ecosystem: `@storybook/*`, `eslint-plugin-storybook`, `storybook`
- TypeScript ESLint: `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`
- Prisma: `@prisma/adapter-d1`, `@prisma/client`, `prisma`
- Build tools: `css-loader`, `postcss-loader`, `style-loader`, `critters`
- Others: `date-fns`, `date-fns-tz`, `handlebars`, `highlight.js`, `husky`, `lint-staged`, `mongodb`, `postcss-loader`, `prettier`, `ts-node`, `tsx`, `vitest`

**Recommendation:** Review and remove these from catalog (they may be legacy or for future use).

#### Issue #2: 28 Single-Package Dependencies in Catalog
These dependencies should arguably be moved to their consuming package's local `package.json`:

**Template app specific (25 dependencies):**
- Mantine UI components: `@mantine/carousel`, `@mantine/core`, `@mantine/hooks`, `@mantine/modals`, `@mantine/notifications`
- Form/auth: `@auth/core`, `@hookform/resolvers`
- TailwindCSS extensions: `@tailwindcss/forms`, `@tailwindcss/typography`
- React Query: `@tanstack/react-query`, `@tanstack/react-query-devtools`
- Router: `@tanstack/react-router`
- Build/dev tools: `@vitejs/plugin-react`, `drizzle-kit`, `localflare`, `vite`, `vite-tsconfig-paths`, `wrangler`
- Others: `cross-env`, `nodemailer`, `postcss-preset-mantine`, `postcss-simple-vars`, `sonner`, `zod`, `@types/nodemailer`

**Package specific (3 dependencies):**
- `ts-node` (used only by `scripts`)

**Recommendation:** Move these to the respective app-level `package.json` files for better organization.

#### Issue #3: Missing from Catalog (1 dependency)
`@radix-ui/react-dialog` is used by 2 packages (`ui-shadcn` and `spotlight`) but not in the catalog.

**Recommendation:** Add `"@radix-ui/react-dialog": "^1.1.4"` to catalog.

### 3. What's Working Well

#### Excellent: Version Consistency
- **Status:** Perfect - 0 mismatches
- All packages correctly reference catalog versions using `"catalog:"` syntax
- No cases where different versions of the same dependency are used

#### Excellent: Wide Shared Dependencies
Core dependencies properly centralized in catalog:
- `react` (^19.2.4) - 15+ packages
- `react-dom` (^19.2.4) - 15+ packages
- `@types/react` (^19.2.7) - 20+ packages
- `@types/react-dom` (^19.2.3) - 15+ packages
- `typescript` (^5.9.3) - 25+ packages
- `tsup` (^8.5.1) - 20+ packages
- `eslint` (^9.39.2) - 20+ packages
- `@types/node` (^20.19.27) - 20+ packages
- `rimraf` (^6.1.2) - 15+ packages

#### Excellent: Proper Separation of Concerns
Dependencies correctly kept OUT of catalog (single-use, package-specific):
- **EditorJS plugins** (15 packages) → Only used by `ottaeditor`
- **Renderer dependencies** (4 packages) → Only used by `ottarenderer`
- **i18n dependencies** (3 packages) → Only used by `i18n`
- **Radix UI components** (22 packages) → Only used by `ui-shadcn`
- **ui-shadcn helpers** (6 packages) → Only used by `ui-shadcn`
- **CloudFlare Actors** → Only used by `cf-realtime`

## Detailed Breakdown

### Packages Analyzed (41 total)

**Apps (2):**
- `ottabase-template-app-tanstack`
- `ottabase-template-app-nextjs-homepage`

**Packages (39):**
- UI packages: `ui-components`, `ui-mantine`, `ui-base`, `ui-code-highlight`, `ui-shadcn`, `ui-tailwind`
- Core packages: `brand-engine`, `brand-engine-react`, `auth`, `db`, `api`, `config`, `cf`, `utils`
- Domain packages: `audit`, `ottaorm`, `rbac`, `logger`, `notifications`, `email`, `queue`, `cron`, `cropper`, `state`
- Feature packages: `forms`, `i18n`, `spotlight`, `ottaselect`, `shortlinks`, `ottaupload`, `ottaeditor`, `ottablog`, `ottarenderer`, `referrals`, `cf-realtime`, `scripts`, `hello-world`

## Recommended Actions

### Priority 1: HIGH (Do First)
- [ ] Add `@radix-ui/react-dialog` to catalog at version `^1.1.4`
  - Effort: < 5 minutes
  - File: `pnpm-workspace.yaml`

### Priority 2: MEDIUM (Do Soon)
- [ ] Review and remove 32 unused catalog entries
  - Effort: 1-2 hours
  - File: `pnpm-workspace.yaml`
  - Decision: Some may be intentional (future use), confirm before removal

### Priority 3: MEDIUM (Do Next Sprint)
- [ ] Move 25+ single-use dependencies to app-level package.json
  - Effort: 2-3 hours (mostly moving entries, testing)
  - Files:
    - `/home/user/ottabase/apps/ottabase-template-app-tanstack/package.json`
    - `/home/user/ottabase/apps/ottabase-template-app-nextjs-homepage/package.json`
    - `/home/user/ottabase/packages/scripts/package.json`
  - Benefit: Cleaner catalog, easier to understand what's truly shared

### Priority 4: LOW (Nice to Have)
- [ ] Set up automated dependency consistency checks
  - Effort: 2-3 hours
  - Tool: Consider custom script or tool to prevent future inconsistencies
  - Frequency: Run in CI/CD pipeline

## Detailed Recommendations

### Recommendation 1: Add @radix-ui/react-dialog
**What:** Add missing multi-package dependency to catalog
**Why:** Used by both `ui-shadcn` and `spotlight` - should be centrally managed
**How:** Add to `pnpm-workspace.yaml` catalog section:
```yaml
"@radix-ui/react-dialog": "^1.1.4"
```

### Recommendation 2: Cleanup Unused Catalog Entries
**What:** Review and remove 32 unused dependencies
**Why:** Keeps catalog maintainable and clear about what's actually shared
**Candidates for removal:**
```
@babel/core, @babel/preset-env, @babel/preset-react, @babel/preset-typescript
@prisma/adapter-d1, @prisma/client, prisma
@storybook/addon-docs, @storybook/addon-links, @storybook/addon-styling-webpack
@storybook/react-webpack5, @storybook/test
@typescript-eslint/eslint-plugin, @typescript-eslint/parser
babel-loader, critters, css-loader, eslint-plugin-storybook, handlebars
highlight.js, husky, lint-staged, mongodb, postcss-loader, prettier
storybook, style-loader, ts-node, tsx, vitest
```

### Recommendation 3: Move Single-Package Dependencies to App Level
**What:** Move 25+ catalog entries to app-level package.json
**Why:** Cleaner separation of concerns - apps and packages should define their own dependencies
**Candidates from ottabase-template-app-tanstack:**
```
@auth/core, @hookform/resolvers
@mantine/carousel, @mantine/core, @mantine/hooks, @mantine/modals, @mantine/notifications
@tanstack/react-query, @tanstack/react-query-devtools, @tanstack/react-router
@vitejs/plugin-react, cross-env, drizzle-kit, localflare, nodemailer, sonner, vite, wrangler, zod
postcss-preset-mantine, postcss-simple-vars, @types/nodemailer
```

**Candidates from ottabase-template-app-nextjs-homepage:**
```
@tailwindcss/forms, @tailwindcss/typography
```

**Candidates from scripts:**
```
ts-node
```

## Analysis Methodology

1. **Cataloging:** Read all 41 `package.json` files (apps and packages)
2. **Extraction:** Extract all dependencies, devDependencies, optionalDependencies, and peerDependencies
3. **Mapping:** Build a map showing which packages use each dependency
4. **Comparison:** Compare actual usage against catalog definitions
5. **Validation:** Check for version mismatches and consistency
6. **Analysis:** Identify patterns and opportunities for improvement

## Files Referenced

- **Catalog Definition:** `/home/user/ottabase/pnpm-workspace.yaml`
- **Analysis Output:** `/home/user/ottabase/DEPENDENCY_ANALYSIS.json`
- **This Summary:** `/home/user/ottabase/DEPENDENCY_ANALYSIS_SUMMARY.md`

## Conclusion

The Ottabase monorepo has **excellent version consistency** with no mismatches found. However, the catalog needs cleanup:
- Remove 32 unused entries
- Add 1 missing multi-package dependency
- Consider moving 25+ single-use entries to app level

Overall health is **GOOD** with opportunities for improvement. Estimated effort to address all recommendations: **4-8 hours**.

---

Generated: 2026-02-15
