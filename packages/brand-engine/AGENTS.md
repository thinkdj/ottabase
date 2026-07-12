# @ottabase/brand-engine — agent notes

Theming/design-system engine: design tokens, theme presets, CSS variables, brand-kit persistence and worker API handlers. Full docs: ./README.md

## Use when

- Anything branding/theming: tokens, preset expansion, critical/runtime CSS, fonts, favicons, email branding, brand-kit CRUD endpoints, menu slots.
- NOT for React bindings (BrandProvider, LayoutResolver) — those live in `@ottabase/brand-engine-react`.
- NOT for layout types/presets/resolver — import those from `@ottabase/ottalayout`; this package only owns `DEFAULT_ROUTE_MAPPINGS`.

## Imports

```ts
import { getToken, buildTokensFromBaseColor, resolveTheme, applyBrandTheme, buildCriticalStyleTagDual, applyBrandToEmail, getFaviconUrl, PRESET_THEMES, type DesignTokens } from '@ottabase/brand-engine';
import { BrandKit, brandKitToTheme, resolveBrandConfig, resolveFullBrandConfig, brandEngineMigrations, brandKitsTable, menusTable, layoutTemplatesTable } from '@ottabase/brand-engine/persistence';
import { handleGetBrand, handleGetPresets, handleCreateBrandKit, handleUpdateBrandKit, handleCloneBrandKit, handleUploadBrandKitLogo } from '@ottabase/brand-engine/handlers';
import { BUILTIN_THEME_NAMES, THEME_PRESET_ITEMS, registerBuiltInThemes } from '@ottabase/brand-engine/themes';
import { GOOGLE_FONTS, buildGoogleFontUrl, fontToTypography } from '@ottabase/brand-engine/fonts';
import { DEFAULT_ROUTE_MAPPINGS } from '@ottabase/brand-engine/layouts';
```

## Canonical usage

Resolve a theme and apply it (client) or inline it (worker SSR):

```ts
const light = resolveTheme({ base: theme, tenantOverrides, mode: 'light' });
const dark = resolveTheme({ base: theme, mode: 'dark' });
applyBrandTheme(light); // browser: sets CSS vars
const criticalTag = buildCriticalStyleTagDual(light, dark); // worker: inject before </head>
```

Worker API routes (handlers return `Response`, use errorResponse internally):

```ts
// GET /api/brand — full brand config for the app (scoped by appId, not organizationId)
return handleGetBrand(request, env, appId);
// POST /api/brand-kits
return handleCreateBrandKit(request, env, appId, auditUser);
```

Server-side kit → resolved theme:

```ts
const config = await resolveFullBrandConfig(env, { appId });
const lightTheme = await brandKitToTheme(kit, 'light');
```

## Wiring

1. Tables + migrations go in the app's `apps/*/ottabase/config.migrations.ts` `PACKAGE_REGISTRY` under key `brandEngine` (core — always enabled, not listed in `BUILT_IN_PACKAGES`): tables `brandKitsTable`, `menusTable`, `menuItemsTable`, `menuSlotAssignmentsTable`, `layoutTemplatesTable`, `layoutRouteMappingsTable`; `migrations: brandEngineMigrations`.
2. No per-app model files — fat models ship with the package: register `BrandKit`, `LayoutTemplate`, `LayoutRouteMapping`, `MenuSlotAssignment` via `registerModels([...])` in `worker/lib/db-utils.ts`.
3. Tables flow through `PACKAGE_REGISTRY`, not `ottabase/db/schema.ts` — do not re-export them there.

## Gotchas

- Presets are templates: expanded to full tokens and saved to DB on selection (`handleGetPresets` serves `PRESET_THEMES`); they are not resolved at runtime.
- Custom cursors are preserved when re-expanding a preset over an existing `tokensJson`.
- `expandPresetToTokens` is internal to `handlers/brand-kit-api.ts` — not exported; use the create/update handlers.
- `drizzle-orm` and `@cloudflare/workers-types` are peer deps (`catalog:`); internal deps are `workspace:*`. Edge runtime — no Node-only APIs.
- Call `registerBuiltInThemes()` at app startup before `getThemeByName`/`getThemeOrDefault`.
- Brand resolution is app-scoped (`appId`), unlike most RLS-scoped tables (organizationId/userId).
