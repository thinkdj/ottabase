# Task 08: Brand Kit – THE Way Forward

> **Brand Kit** = identity + logos + colors + fonts (saveable, org-scoped, reusable).  
> **Route mappings** = each row specifies pathPattern + layout + brandKit.  
> No Layout Sets, no Presets, no BrandSettings monolith. Fresh implementation.

---

## 1. Core Model

### 1.1 Brand Kit (Self-Contained)

A **Brand Kit** is the **single, self-contained object** for all look-and-feel settings. It holds everything: brand
identity, logos, colors, fonts, theme, and custom CSS. No other object holds brand config—only Brand Kit.

| Section            | Stored In                                                                        | Contents                                        |
| ------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Brand Identity** | `brandName`, `tagline`                                                           | Display name, tagline                           |
| **Logos**          | `logoKey`, `logoDarkKey`, `iconKey`, `ogImageKey`, `emailLogoKey`                | R2 keys for all logo assets                     |
| **Colors**         | `tokensJson.colors`                                                              | Light/dark palettes, semantic tokens            |
| **Theme**          | `themePresetId`, `tokensJson` (radius, spacing, shadow, motion)                  | Base preset + overrides                         |
| **Fonts**          | `tokensJson.typography`                                                          | Heading, body, handwriting font families + URLs |
| **Advanced**       | `customCss`, `hideOttabaseBranding`, `defaultColorScheme`, `allowDarkModeToggle` | Extra controls                                  |

**Clone use case**: Clone a Brand Kit to create variants (e.g. "Acme" → "Acme - Christmas"). Only the Brand Kit name
differs; all other fields are copied. Edit the clone for small changes (colors, fonts) without touching the original.

| Field                                                             | Type    | Description                                                                |
| ----------------------------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| `id`                                                              | text    | UUID primary key                                                           |
| `organizationId`                                                  | text    | null = system default                                                      |
| `name`                                                            | text    | Display name (e.g. "Marketing", "Acme - Christmas")                        |
| `slug`                                                            | text    | Optional API slug                                                          |
| `brandName`                                                       | text    | Brand name (header, emails)                                                |
| `tagline`                                                         | text    | Optional                                                                   |
| `logoKey`, `logoDarkKey`, `iconKey`, `ogImageKey`, `emailLogoKey` | text    | R2 keys                                                                    |
| `themePresetId`                                                   | text    | Base theme: default, neo, artisan, etc.                                    |
| `tokensJson`                                                      | text    | DesignTokens: colors, typography, spacing, radius, shadow, motion, cursors |
| `defaultColorScheme`                                              | text    | light \| dark \| system                                                    |
| `allowDarkModeToggle`                                             | integer | boolean                                                                    |
| `customCss`                                                       | text    | Optional injected CSS                                                      |
| `hideOttabaseBranding`                                            | integer | boolean                                                                    |
| `createdAt`, `updatedAt`                                          | integer | Timestamps                                                                 |

### 1.2 Route Mapping (Layout + Brand Kit per Row)

Each row maps a path pattern to **layout** and **brand kit**. Both are applied when the route matches.

| Field              | Type    | Description                                          |
| ------------------ | ------- | ---------------------------------------------------- |
| `id`               | text    | UUID primary key                                     |
| `organizationId`   | text    | null = system default                                |
| `appId`            | text    | null = org-level                                     |
| `pathPattern`      | text    | e.g. `/`, `/app/**`, `/docs/**`                      |
| `priority`         | integer | Higher = checked first; catch-all uses 0             |
| `layoutTemplateId` | text    | Layout template (homepage, app-shell, docs, minimal) |
| `brandKitId`       | text    | Brand Kit for this route – **required**              |

**Resolution**: On request, match path → get layout + brand kit for that row → apply layout structure and Brand Kit
theme/colors/logos/fonts.

### 1.3 Layout Templates

Unchanged. `layout_templates` table + built-in presets (homepage, app-shell, docs, minimal).

---

## 2. What to Discard

| Item                              | Reason                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `brand_settings` table            | Replaced by `brand_kits`. No more monolithic settings.                                |
| `BrandSettings` model             | Replaced by `BrandKit` model                                                          |
| Preset columns on brand_settings  | No presets; route mappings + brand kits are the config                                |
| `brand_boxes` table               | Never implemented / removed; not needed                                               |
| `theme_variants` table            | Optional: drop for now; seasonal overlays can be a future Brand Kit "variant" feature |
| `brandSettingsToConfig`           | Replaced by `brandKitToConfig`                                                        |
| `resolveBrandConfig` current flow | Replaced by path-aware resolution                                                     |
| Preset API handlers               | No apply/duplicate preset; CRUD for Brand Kits and route mappings only                |
| KV cache keyed by preset/preview  | New cache structure (see below)                                                       |

---

## 3. Schema (D1)

### 3.1 New: `brand_kits`

```typescript
export const brandKitsTable = sqliteTable('brand_kits', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id'),

    name: text('name').notNull(),
    slug: text('slug'),

    brandName: text('brand_name').notNull().default('My App'),
    tagline: text('tagline'),

    logoKey: text('logo_key'),
    logoDarkKey: text('logo_dark_key'),
    iconKey: text('icon_key'),
    ogImageKey: text('og_image_key'),
    emailLogoKey: text('email_logo_key'),

    themePresetId: text('theme_preset_id'),
    tokensJson: text('tokens_json'),

    defaultColorScheme: text('default_color_scheme').default('system'),
    allowDarkModeToggle: integer('allow_dark_mode_toggle', { mode: 'boolean' }).default(true),

    customCss: text('custom_css'),
    hideOttabaseBranding: integer('hide_ottabase_branding', { mode: 'boolean' }).default(false),

    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});
```

### 3.2 Modify: `layout_route_mappings`

Add `brand_kit_id`:

```typescript
// Add to layout_route_mappings table
brandKitId: text('brand_kit_id').notNull(),  // FK to brand_kits
```

### 3.3 Keep

- `layout_templates` – unchanged
- Built-in `LAYOUT_PRESETS` (homepage, app-shell, docs, minimal)

### 3.4 Drop

- `brand_settings`
- `theme_variants` (optional; can keep for future seasonal overlays)

---

## 4. Resolution Flow

### 4.1 Request

```
GET /api/brand?path=/app/dashboard&organizationId=org1&appId=app1&mode=light
```

**Required**: `path` – current pathname. Response is config for that path.

### 4.2 Resolution Steps

1. **Load route mappings** for org/app (app → org → system).
2. **Match path** against pathPattern (priority desc). First match wins.
3. **Load Brand Kit** by `brandKitId` from matched row.
4. **Load layout template** by `layoutTemplateId` (from DB or LAYOUT_PRESETS).
5. **Resolve theme** from Brand Kit: base theme (themePresetId) + tokensJson + mode.
6. **Return** `ResolvedBrandConfig` with theme, logos, identity, `layoutTemplateId`, `layoutTemplatesMap`.

### 4.3 Default Route Mapping

System default when no mappings in DB:

```
{ pathPattern: '/*', layoutTemplateId: 'homepage', brandKitId: <default-brand-kit-id>, priority: 0 }
```

Requires at least one system default Brand Kit (org=null).

---

## 5. Types

### 5.1 ResolvedBrandConfig (path-scoped)

```typescript
export interface ResolvedBrandConfig {
    brandName: string;
    tagline?: string;
    logos: { primary?: string; dark?: string; icon?: string; ogImage?: string; emailLogo?: string };
    theme: ResolvedBrandTheme;
    themeBase: string;
    tenantTheme: Partial<BrandTheme>;
    defaultColorScheme: 'light' | 'dark' | 'system';
    allowDarkModeToggle: boolean;
    customCss?: string;
    hideOttabaseBranding: boolean;
    /** For current path – client knows which layout to render */
    layoutTemplateId: string;
    layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }>;
    /** All route mappings for client-side use (e.g. prefetch on nav) */
    routeMappings: Array<{ pathPattern: string; layoutTemplateId: string; brandKitId: string; priority: number }>;
}
```

Note: `layoutTemplateId` is now the resolved one for the requested path. Client uses it with `layoutTemplatesMap` to
pick layout component.

### 5.2 Route Mapping Row

```typescript
interface RouteMappingRow {
    pathPattern: string;
    layoutTemplateId: string;
    brandKitId: string;
    priority: number;
}
```

---

## 6. Cache Strategy

### 6.1 Cache Key

`brand:resolved:{orgId}:{appId}:{mode}` – one cache entry per org/app/mode.

### 6.2 Cached Value

```typescript
interface BrandResolutionCache {
    routeMappings: RouteMappingRow[];
    layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }>;
    brandKitsMap: Record<
        string,
        {
            brandName: string;
            tagline?: string;
            logos: Record<string, string>;
            theme: ResolvedBrandTheme;
            themeBase: string;
            tenantTheme: Partial<DesignTokens>;
            defaultColorScheme: string;
            allowDarkModeToggle: boolean;
            customCss?: string;
            hideOttabaseBranding: boolean;
        }
    >;
}
```

All referenced Brand Kits are resolved once and stored. Path matching + lookup is fast.

### 6.3 Request Handling

1. Try cache get.
2. On miss: load route mappings, layout templates, all referenced brand kits. Resolve themes. Build cache. Set.
3. Match `path` against `routeMappings`.
4. Lookup Brand Kit from `brandKitsMap`.
5. Build and return `ResolvedBrandConfig` for that path.

### 6.4 Invalidation

When any of these change: route mappings, layout templates, any Brand Kit for that org/app.

---

## 7. API Handlers

### 7.1 GET /api/brand

**Path-scoped** (`path` required):

- **Query**: `path`, `organizationId`, `appId`, `mode`
- **Returns**: `ResolvedBrandConfig` for that path (single layout + single brand kit)

**Full config** (`full=1`):

- **Query**: `full=1`, `organizationId`, `appId`, `mode`
- **Returns**: All route mappings, all referenced brand kits (keyed by id), `layoutTemplatesMap`. Client resolves path
  and picks brand kit.

### 7.2 Brand Kits CRUD

| Method | Path                      | Description                                                                        |
| ------ | ------------------------- | ---------------------------------------------------------------------------------- |
| GET    | /api/brand/kits           | List Brand Kits for org                                                            |
| GET    | /api/brand/kits/:id       | Get one Brand Kit                                                                  |
| POST   | /api/brand/kits           | Create Brand Kit                                                                   |
| PUT    | /api/brand/kits/:id       | Update Brand Kit                                                                   |
| DELETE | /api/brand/kits/:id       | Delete Brand Kit                                                                   |
| POST   | /api/brand/kits/:id/clone | Clone Brand Kit (optional `name` in body for cloned name, e.g. "Acme - Christmas") |

### 7.3 Route Mappings CRUD

| Method | Path                | Description                              |
| ------ | ------------------- | ---------------------------------------- |
| GET    | /api/brand/mappings | List route mappings for org/app          |
| PUT    | /api/brand/mappings | Replace all mappings (or upsert per row) |

Payload for create/update mapping:

```typescript
{
	pathPattern: string;
	layoutTemplateId: string;
	brandKitId: string;
	priority?: number;
}
```

### 7.4 Logo Upload

| Method | Path                     | Description                                                   |
| ------ | ------------------------ | ------------------------------------------------------------- |
| POST   | /api/brand/kits/:id/logo | Upload logo for Brand Kit (type: logo, logo-dark, icon, etc.) |

Logo belongs to Brand Kit, not global settings.

### 7.5 Layout Templates

Keep existing: `GET /api/brand/layouts`, `PUT /api/brand/layouts`.

---

## 8. Client Integration

### 8.1 BrandProvider

Two fetch modes:

- **Path-scoped (default)**: `GET /api/brand?path={pathname}` – returns config for that path only. Refetch when path or
  mode changes.
- **Full (optional)**: `GET /api/brand?full=1` – returns all route mappings + all referenced brand kits +
  `layoutTemplatesMap`. Client resolves path locally. Better for SPA: no refetch on nav, no loading flicker.

### 8.2 LayoutResolver

- **Reads** `config.layoutTemplateId` and `config.layoutTemplatesMap`.
- **Renders** layout component for current path.
- With full config: resolves path against `routeMappings`, picks brand kit, applies theme. No refetch on nav.
- With path-scoped config: refetch when path changes.

### 8.3 useBrand()

Returns `{ config, isLoading, error }` where `config` includes resolved theme and layout for current path.

---

## 9. File-Level Implementation Plan

### 9.1 Delete

- `BrandSettings.model.ts`
- `brandSettingsToConfig.ts`
- References to `brand_settings`, presets, `theme_variants` in handlers

### 9.2 Create

- `schema.ts` – add `brandKitsTable`, add `brandKitId` to `layout_route_mappings`, remove `brand_settings`, optionally
  remove `theme_variants`
- `BrandKit.model.ts` – OttaORM model, `toBrandTheme()`, `getLogoUrls()`
- `brandKitToConfig.ts` – convert BrandKit + mode → theme, logos, identity
- `resolveBrandConfig.ts` – rewrite: path-aware, use route mappings + Brand Kit
- `layoutData.ts` – extend to include `brandKitId` in mappings; fetch logic for org/app
- `handlers/brand-kit-api.ts` – CRUD for Brand Kits + clone (`POST /api/brand/kits/:id/clone`)
- `handlers/layout-api.ts` – update mappings API to include `brandKitId`

### 9.3 Modify

- `cache.ts` – new cache shape `BrandResolutionCache`, path-aware response build
- `types.ts` – update `ResolvedBrandConfig`, add `RouteMappingRow` with `brandKitId`
- `LayoutRouteMapping.model.ts` – add `brandKitId` to schema/casts
- `handlers/brand-api.ts` – `handleGetBrand` requires `path`, uses new resolver
- Worker routes – wire `/api/brand/kits/*`, update `/api/brand`

### 9.4 Admin UI

**Brand Kits Admin**

- **List view**: All Brand Kits for org, with name, brandName, theme preset. "Create" and "Clone" actions.
- **Details view** (on click): Single page with tabbed sections—all settings in one place.
    - **Brand tab**: brandName, tagline
    - **Logo tab**: Primary, dark mode, icon, og-image, email logo (upload per asset)
    - **Colors tab**: Color palette editor (light/dark semantic tokens)
    - **Theme tab**: Base theme preset dropdown + tokens (radius, spacing, shadow, motion)
    - **Fonts tab**: Heading, body, handwriting font selectors (Google Fonts picker)
    - **Advanced tab**: customCss, defaultColorScheme, allowDarkModeToggle, hideOttabaseBranding
- **Clone**: Clone button creates copy with suffix (e.g. "Acme - Christmas"); opens in edit mode.

**Route Mappings Admin**

- Table: pathPattern | layoutTemplateId (dropdown) | brandKitId (dropdown) | priority
- Add/remove rows. Layout and Brand Kit selected per row. Configurations applied on save.

---

## 10. Default Data / Migration

### 10.1 System Default Brand Kit

On first run or migration, create one system Brand Kit:

```
organizationId: null
name: "Default"
brandName: "Ottabase"
themePresetId: "default"
```

### 10.2 Default Route Mappings

Create system default mappings pointing at default Brand Kit:

```
/*           → homepage  → default brand kit, priority 0
/demo/**     → app-shell → default brand kit, priority 10
/admin/**    → app-shell → default brand kit, priority 10
...
```

---

## 11. Path Pattern Semantics

Same as existing:

- `*` = one path segment (`/app/*` matches `/app/dashboard` but not `/app/dashboard/settings`)
- `**` = zero or more segments (`/docs/**` matches `/docs`, `/docs/a`, `/docs/a/b`)

---

## 12. Summary

| Before                     | After                                                    |
| -------------------------- | -------------------------------------------------------- |
| brand_settings (monolith)  | brand_kits (self-contained, reusable, org-scoped)        |
| Presets (snapshot + apply) | Route mappings: layout + brandKit per row                |
| Single config per app      | Path-scoped config (layout + brand kit per route)        |
| Theme variants (optional)  | Dropped; use Brand Kit clone (e.g. "BrandX - Christmas") |
| Cache per org/app          | Cache resolution data; path match on read                |

**Benefits**

- **Brand Kit is the only object** for brand settings—identity, logos, colors, theme, fonts all in one
- **Admin**: List Brand Kits → click one → tabbed details (Brand, Logo, Colors, Theme, Fonts, Advanced)
- **Clone** for variants (e.g. "Acme" → "Acme - Christmas") without touching the original
- Routes define layout + brand kit per row; both applied on match
- Homepage can use different Brand Kit than app shell
- No Layout Sets, no Presets, no apply flow

---

## 13. Admin UI Specification

### 13.1 Brand Kits List

- Page: `/admin/brand/kits` (or equivalent)
- Table/cards: name, brandName, theme preset, org
- Actions: "Create", "Clone" (per row)
- Click row → navigate to Brand Kit details

### 13.2 Brand Kit Details (Tabbed)

Single page, all settings in one place. Tabs:

| Tab          | Content                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------- |
| **Brand**    | brandName, tagline                                                                           |
| **Logo**     | Upload: primary, dark, icon, og-image, email logo. Preview per asset.                        |
| **Colors**   | Light/dark palette editor. Semantic tokens (primary, secondary, muted, etc.)                 |
| **Theme**    | Base preset dropdown (default, neo, artisan, …). Overrides: radius, spacing, shadow, motion. |
| **Fonts**    | Heading, body, handwriting font selectors (Google Fonts picker).                             |
| **Advanced** | customCss textarea, defaultColorScheme, allowDarkModeToggle, hideOttabaseBranding            |

- Save applies to current Brand Kit. Live preview (optional) in side panel.

### 13.3 Clone Flow

1. User clicks "Clone" on Brand Kit "Acme"
2. API `POST /api/brand/kits/:id/clone` with optional body `{ name: "Acme - Christmas" }`
3. Server creates copy with all fields duplicated; returns new Brand Kit
4. Navigate to details of new Brand Kit for editing

### 13.4 Route Mappings Editor

- Table: pathPattern | layoutTemplateId | brandKitId | priority
- Layout dropdown: homepage, app-shell, docs, minimal (and custom from layout_templates)
- Brand Kit dropdown: all Brand Kits for org
- Add row, remove row, reorder (priority). Save replaces all mappings for org/app.
