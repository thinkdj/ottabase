# 🎨 Ottabase Brand Engine - Complete Implementation Plan

> **Runtime Multi-Tenant Design Token Engine** - Zero-redeploy branding system for Ottabase

## Executive Summary

The Ottabase Brand Engine extends the existing `@ottabase/brand-engine` package with **persistent, database-driven
branding** that enables any React app in the monorepo to consume brand settings from D1 (source of truth) via KV (edge
cache) without requiring redeployments. This transforms branding from a build-time concern to a runtime, multi-tenant
capability.

---

## 🎯 Core Goals

1. **Any React app** in the monorepo can consume brand config via a simple hook
2. **DB-backed persistence** (D1) with KV caching for edge performance
3. **Multi-tenant support** (organization-level and app-level overrides)
4. **Zero redeploy** - brand changes apply instantly
5. **Admin UI** for non-technical users to manage branding
6. **Design token-first** approach leveraging existing `@ottabase/brand-engine`
7. **Multiple layout templates** - dynamic layout per route group (e.g. homepage vs app shell)
8. **Theme overlays** - seasonal/campaign themes on same layout (e.g. Christmas colors, same layout)
9. **BrandBox** - saveable presets (layout + theme + brand config) that can instantly affect the site

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Brand Engine Architecture                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │
│  │   Admin UI   │───▶│   API Layer  │───▶│  Persistence │             │
│  │  (React)    │    │  (Workers)   │    │   D1 + KV    │             │
│  └──────────────┘    └──────────────┘    └──────────────┘             │
│         │                    │                    │                     │
│         │                    │                    │                     │
│         ▼                    ▼                    ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │         @ottabase/brand-engine (existing)                    │       │
│  │  • Design Tokens  • Theme Resolver  • CSS Runtime           │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │              React Apps (Consumers)                         │       │
│  │  • useBrand() hook  • BrandProvider  • Auto CSS injection   │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Admin updates brand settings → API writes to D1
2. API invalidates KV cache
3. Edge middleware / first request:
   - Check ?brandPreview=box-id for preview mode
   - Fetch from D1 via BrandResolver (BrandBox first, then BrandSettings)
   - Resolve theme, layout templates, route mappings
   - Cache full ResolvedBrandConfig in KV
   - Inline critical CSS vars into <html> (zero FOUC)
4. React app: BrandProvider hydrates, LayoutResolver picks layout by path
5. useBrand() / useBrandBox() consume config
```

### Zero FOUC Strategy (Enhancement)

Edge middleware or SSR fetches brand config before first paint and injects:

```html
<style id="brand-critical">
    :root {
        --color-primary: ...;
        --font-heading: ...;
    }
</style>
```

Client-side BrandProvider then takes over and can apply full theme; no flash of unstyled content.

### Edge Middleware (SSR Injection)

```typescript
// In Cloudflare Worker / Next.js middleware / SSR
// Before returning HTML, fetch brand config and inject:
const config = await resolveBrandConfig(env, { organizationId, appId });
const criticalCss = buildCriticalCSS(config.theme); // :root{--color-primary:...;...}
// Prepend to <head>: <style id="brand-critical">${criticalCss}</style>
```

---

## 🆕 Layout Templates, Theme Overlays & BrandBox

### Problem 1: Multiple Layouts Per App

**Issue**: Frameworks make it hard to have different layouts dynamically—e.g. vertical/homepage layout for landing, app
shell for `/app/*`, docs layout for `/docs/*`.

**Solution**: **Layout Templates** with **Route Group Mapping**

- Define multiple layout templates (homepage, app-shell, docs, etc.)
- Map route path patterns to layout template IDs
- Router/Provider resolves layout based on current path
- Layouts load dynamically—no code changes needed

```
Route: /           → layoutTemplateId: "homepage"
Route: /app/*      → layoutTemplateId: "app-shell"
Route: /docs/*     → layoutTemplateId: "docs"
Route: /blog/*     → layoutTemplateId: "homepage"  (reuse)
```

### Problem 2: Theme Changes Without Layout Changes

**Issue**: No easy way to apply seasonal/campaign themes to existing layout—e.g. Christmas colors, same layout.

**Solution**: **Theme Variants / Overlays**

- Themes and layouts are **decoupled**
- A **Theme Variant** is a color/token overlay that can apply to any layout
- Same layout + different theme = instant visual change
- Use cases: Christmas, Black Friday, product launches, A/B testing

### Problem 3: Unified Brand Presets

**Issue**: Theme, layout, logos, etc. are managed separately. No way to save and apply a complete "brand look"
instantly.

**Solution**: **BrandBox**

- A **BrandBox** is a saved snapshot: layout + theme + logos + fonts + tokens + custom CSS
- One-click apply to instantly affect the site
- Use cases: client presets, seasonal campaigns, white-label variants
- BrandBoxes can be **duplicated**, **scheduled** (future), and **exported/imported**

---

### BrandBox Resolution Flow

```
Request (path + org + app)
    ↓
Resolve active BrandBox (or default)
    ↓
Resolve Layout Template for current path (from BrandBox's route mappings)
    ↓
Apply Theme (from BrandBox)
    ↓
Inject CSS vars, load layout component, render
```

---

## 📦 Package Structure

```
packages/brand-engine/
├── src/
│   ├── index.ts                    # ✅ Existing exports
│   ├── tokens.ts                   # ✅ Existing
│   ├── theme.ts                    # ✅ Existing
│   ├── resolver.ts                  # ✅ Existing
│   ├── css-runtime.ts              # ✅ Existing
│   │
│   ├── persistence/                # 🆕 NEW - Database layer
│   │   ├── schema.ts               # D1 schema for brand_settings
│   │   ├── BrandSettings.model.ts  # OttaORM fat model
│   │   ├── cache.ts                # KV caching layer
│   │   ├── assets.ts               # R2 asset management (logos)
│   │   ├── BrandBox.model.ts       # BrandBox (layout + theme + config)
│   │   ├── LayoutTemplate.model.ts # Layout templates
│   │   ├── ThemeVariant.model.ts   # Theme overlays (seasonal, campaign)
│   │   └── BrandResolver.ts        # Resolves BrandBox first, then BrandSettings
│   │
│   ├── layouts/                    # 🆕 NEW - Layout template system
│   │   ├── registry.ts             # Layout component registry
│   │   ├── resolver.ts             # Resolve layout by path + route mappings
│   │   ├── types.ts                # LayoutTemplate, RouteMapping types
│   │   └── presets/                # Built-in presets (homepage, app-shell, docs)
│   │
│   ├── fonts/                      # 🆕 NEW - Google Fonts integration
│   │   ├── google-fonts.ts         # Font metadata + search
│   │   ├── font-loader.ts          # Dynamic font injection
│   │   └── font-categories.ts      # Font categorization
│   │
│   └── handlers/                   # 🆕 NEW - API handlers
│       ├── brand-api.ts            # CRUD endpoints (RBAC: brand:*)
│       ├── brandbox-api.ts         # BrandBox CRUD, apply (RBAC: brand:apply)
│       ├── layout-api.ts           # Layout templates CRUD
│       ├── theme-variant-api.ts    # Theme variants CRUD
│       └── font-api.ts             # Font search/preview
│
└── package.json
```

```
packages/brand-engine-react/        # React bindings (peer: react)
├── src/
│   ├── BrandProvider.tsx
│   ├── LayoutResolver.tsx          # Router-agnostic via usePathname adapter
│   ├── useBrand.ts
│   ├── useBrandBox.ts
│   ├── useLayoutForPath.ts
│   ├── useFontPreview.ts
│   └── routers/                    # Adapters: tanstack, react-router, next
│       ├── tanstack.ts
│       └── index.ts
└── package.json
```

```
packages/brand-engine-admin/        # Admin UI (peer: react, @tanstack/query, ui-shadcn)
├── src/
│   ├── BrandAdminPage.tsx
│   ├── BrandBoxManager.tsx
│   ├── LayoutTemplateEditor.tsx
│   ├── ThemeVariantEditor.tsx
│   ├── LogoUploader.tsx
│   ├── ColorPicker.tsx
│   ├── FontSelector.tsx
│   ├── BrandPreview.tsx
│   └── TokenEditor.tsx
└── package.json
```

**Note**: Admin lives in `brand-engine-admin` to avoid heavy React/Query deps in core. Apps import admin components from
`@ottabase/brand-engine-admin`.

### RBAC Permissions (Integration with @ottabase/rbac)

| Permission    | Description                                           |
| ------------- | ----------------------------------------------------- |
| `brand:*`     | Full access (read, edit, apply)                       |
| `brand:read`  | View brand config, use BrandProvider                  |
| `brand:edit`  | Update settings, upload logos, create/edit BrandBoxes |
| `brand:apply` | Set active BrandBox (instant apply)                   |

All brand API handlers must check permissions via `@ottabase/rbac` before proceeding.

---

## 1️⃣ Database Schema (D1)

### Brand Settings Table

```typescript
// packages/brand-engine/src/persistence/schema.ts
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Brand Settings Table
 * Stores all branding configuration with multi-tenant support
 */
export const brandSettingsTable = sqliteTable('brand_settings', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),

    // Multi-tenancy: null = system default, else organization/app specific
    organizationId: text('organization_id'),
    appId: text('app_id'), // Optional: app-specific overrides

    // ═══════════════════════════════════════════════════════════════════
    // IDENTITY
    // ═══════════════════════════════════════════════════════════════════

    /** Brand name (displayed in header, emails, etc.) */
    brandName: text('brand_name').notNull().default('My App'),

    /** Tagline / slogan */
    tagline: text('tagline'),

    // ═══════════════════════════════════════════════════════════════════
    // LOGOS (R2 keys)
    // ═══════════════════════════════════════════════════════════════════

    /** Primary logo (R2 key) */
    logoKey: text('logo_key'),

    /** Logo for dark mode (R2 key) */
    logoDarkKey: text('logo_dark_key'),

    /** Small icon/favicon (R2 key) */
    iconKey: text('icon_key'),

    /** Social share image (R2 key) */
    ogImageKey: text('og_image_key'),

    /** Email header logo (R2 key) */
    emailLogoKey: text('email_logo_key'),

    // ═══════════════════════════════════════════════════════════════════
    // DESIGN TOKENS (JSON - leverages existing brand-engine types)
    // ═══════════════════════════════════════════════════════════════════

    /** Full design tokens (JSON blob) - uses DesignTokens type */
    tokensJson: text('tokens_json'), // Partial<DesignTokens>

    /** Layout configuration (JSON) */
    layoutJson: text('layout_json'), // Partial<LayoutConfig>

    // ═══════════════════════════════════════════════════════════════════
    // APPEARANCE
    // ═══════════════════════════════════════════════════════════════════

    /** Default color scheme: 'light' | 'dark' | 'system' */
    defaultColorScheme: text('default_color_scheme').default('system'),

    /** Allow users to toggle dark mode */
    allowDarkModeToggle: integer('allow_dark_mode_toggle', { mode: 'boolean' }).default(true),

    // ═══════════════════════════════════════════════════════════════════
    // VERSIONING & DRAFT MODE
    // ═══════════════════════════════════════════════════════════════════

    /** Is this a draft (not published)? */
    isDraft: integer('is_draft', { mode: 'boolean' }).default(false),

    /** Version number (increments on publish) */
    version: integer('version').default(1),

    /** Previous version snapshot (JSON) for rollback */
    previousVersionJson: text('previous_version_json'),

    // ═══════════════════════════════════════════════════════════════════
    // ADVANCED
    // ═══════════════════════════════════════════════════════════════════

    /** Custom CSS (injected into <style>) */
    customCss: text('custom_css'),

    /** Custom meta tags (JSON) */
    customMetaJson: text('custom_meta_json'),

    /** White-label mode: hide "Powered by Ottabase" */
    hideOttabaseBranding: integer('hide_ottabase_branding', { mode: 'boolean' }).default(false),

    // ═══════════════════════════════════════════════════════════════════
    // METADATA
    // ═══════════════════════════════════════════════════════════════════

    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});

export type BrandSettingsType = typeof brandSettingsTable.$inferSelect;
export type NewBrandSettingsType = typeof brandSettingsTable.$inferInsert;
```

### Layout Templates Table

```typescript
/**
 * Layout Templates - Reusable layout definitions
 * Each template defines structure (header, nav, content width, etc.)
 * Components are resolved via registry (homepage, app-shell, docs, etc.)
 */
export const layoutTemplatesTable = sqliteTable('layout_templates', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id'),
    appId: text('app_id'),

    /** Display name (e.g. "Homepage", "App Shell", "Docs") */
    name: text('name').notNull(),

    /** Registry key - maps to Layout component (e.g. "homepage", "app-shell", "docs") */
    componentKey: text('component_key').notNull(),

    /** Layout config (header, nav, contentWidth, etc.) */
    configJson: text('config_json').notNull(),

    /** Optional description */
    description: text('description'),

    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});
```

### Route → Layout Mapping (Global Defaults Only)

**Source of truth**: `BrandBox.routeMappingsJson` when a BrandBox is active. The `layout_route_mappings` table stores
**global/org-level defaults** only—used when no BrandBox is active or when BrandBox has no `routeMappingsJson`.

```typescript
/**
 * Global/default route mappings (org-level or system-wide).
 * BrandBox.routeMappingsJson overrides these when present.
 */
export const layoutRouteMappingsTable = sqliteTable('layout_route_mappings', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id'),
    appId: text('app_id'),

    pathPattern: text('path_pattern').notNull(),
    /** Higher number = higher priority (checked first). Default catch-all /* should use 0 */
    priority: integer('priority').default(0),
    layoutTemplateId: text('layout_template_id').notNull(),
    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
});
```

**Path pattern glob semantics**:

- `*` = exactly one path segment (e.g. `/app/*` matches `/app/dashboard` but not `/app/dashboard/settings`)
- `**` = zero or more segments (e.g. `/docs/**` matches `/docs`, `/docs/a`, `/docs/a/b`)

### Theme Variants Table

```typescript
/**
 * Theme Variants - Color/token overlays that can apply to any layout
 * Use case: Christmas theme, Black Friday, seasonal campaigns
 * Decoupled from layout - same layout + different theme = different look
 */
export const themeVariantsTable = sqliteTable('theme_variants', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id'),
    appId: text('app_id'),

    /** Display name (e.g. "Christmas", "Black Friday") */
    name: text('name').notNull(),

    /** Optional slug for API (e.g. "christmas-2024") */
    slug: text('slug'),

    /** Design tokens (colors, typography overrides) - JSON */
    tokensJson: text('tokens_json').notNull(),

    /** Optional: date range for auto-activation (future) */
    activeFrom: integer('active_from'),
    activeUntil: integer('active_until'),

    /** Optional description */
    description: text('description'),

    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});
```

### BrandBox Table

```typescript
/**
 * BrandBox - A complete, saveable brand preset
 * Combines: layout templates + route mappings + theme + logos + tokens + custom CSS
 * One-click apply to instantly affect the site
 */
export const brandBoxesTable = sqliteTable('brand_boxes', {
    id: text('id')
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    organizationId: text('organization_id'),
    appId: text('app_id'),

    /** Display name (e.g. "Default", "Christmas 2024", "Client ACME") */
    name: text('name').notNull(),

    /** Optional slug for API */
    slug: text('slug'),

    /** Is this the active BrandBox for the org/app? */
    isActive: integer('is_active', { mode: 'boolean' }).default(false),

    // ═══ Content (all optional - inherits from default if not set) ═══

    /** Brand identity (name, tagline) */
    identityJson: text('identity_json'), // { brandName, tagline }

    /** Logo R2 keys */
    logosJson: text('logos_json'), // { logoKey, logoDarkKey, iconKey, ... }

    /** Design tokens */
    tokensJson: text('tokens_json'),

    /** Theme variant ID (links to theme_variants) - null = use default theme */
    themeVariantId: text('theme_variant_id'),

    /** Route → Layout mappings (JSON array) - overrides default mappings */
    routeMappingsJson: text('route_mappings_json'), // [{ pathPattern, layoutTemplateId, priority }]

    /** Layout config overrides per template (JSON) */
    layoutOverridesJson: text('layout_overrides_json'),

    /**
     * Snapshot of layout templates at apply-time (id → { componentKey, config }).
     * Ensures BrandBox is stable even if layout_templates change later.
     */
    layoutTemplatesSnapshotJson: text('layout_templates_snapshot_json'),

    /** Custom CSS */
    customCss: text('custom_css'),

    /** Custom meta */
    customMetaJson: text('custom_meta_json'),

    /** White-label toggle */
    hideOttabaseBranding: integer('hide_ottabase_branding', { mode: 'boolean' }).default(false),

    // ═══ Scheduling (future) ═══

    /** Optional: activate from date */
    activeFrom: integer('active_from'),
    /** Optional: activate until date */
    activeUntil: integer('active_until'),

    createdAt: integer('created_at')
        .$defaultFn(() => Date.now())
        .notNull(),
    updatedAt: integer('updated_at')
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now())
        .notNull(),
});
```

### Resolution Strategy

**BrandBox (active preset) resolution:**

```
1. Active BrandBox for org/app (isActive = true)
2. Default BrandBox (org=null, app=null) with isActive = true
```

**Layout resolution for a given path:**

```
1. Get route mappings from active BrandBox (or default)
2. Match current path against pathPattern (in priority order)
3. First match wins → use layoutTemplateId
4. Load layout template config + resolve component from registry
```

**Theme resolution:**

```
1. BrandBox.themeVariantId → load ThemeVariant tokens
2. If null, use BrandBox.tokensJson or brand_settings defaults
3. Merge with base theme, inject CSS vars
```

**Overall resolution order:**

```
1. Draft settings (isDraft = true) for current user/org/app
2. Active BrandBox for org/app (contains layout + theme + config)
3. Published app-level brand_settings (appId matches)
4. Published org-level brand_settings (organizationId matches)
5. System default (organizationId = null, appId = null)
```

---

### BrandResolver (Issues 1, 2, 3)

Resolves the **complete** brand config for API/edge. Returns `ResolvedBrandConfig` (theme + logos + routeMappings +
layoutTemplates map).

```typescript
// packages/brand-engine/src/persistence/BrandResolver.ts
export interface ResolvedBrandConfig {
    brandName: string;
    tagline?: string;
    logos: { primary?: string; dark?: string; icon?: string; ogImage?: string; emailLogo?: string };
    theme: ResolvedBrandTheme;
    defaultColorScheme: 'light' | 'dark' | 'system';
    allowDarkModeToggle: boolean;
    customCss?: string;
    hideOttabaseBranding: boolean;
    /** From BrandBox or layout_route_mappings table (global defaults) */
    routeMappings: Array<{ pathPattern: string; layoutTemplateId: string; priority: number }>;
    /** Map layoutTemplateId → { componentKey, config } - from snapshot or layout_templates */
    layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }>;
}

export async function resolveBrandConfig(
    env: { OBCF_D1: D1Database },
    opts: { organizationId: string | null; appId?: string | null; previewBrandBoxId?: string; userId?: string | null },
): Promise<ResolvedBrandConfig> {
    // 1. Preview mode: ?brandPreview=box-id overrides active
    const boxId = opts.previewBrandBoxId ?? (await getActiveBrandBoxId(env.OBCF_D1, opts.organizationId, opts.appId));
    if (boxId) {
        const box = await BrandBox.find(boxId);
        if (box) return brandBoxToConfig(box, env);
    }

    // 2. Fall back to BrandSettings
    const settings = await BrandSettings.resolve(opts.organizationId, opts.appId, opts.userId);
    return brandSettingsToConfig(settings, env);
}

async function brandBoxToConfig(box: BrandBox, env): Promise<ResolvedBrandConfig> {
    // Use layoutTemplatesSnapshotJson if present; else fetch from layout_templates by ID
    const layoutTemplatesMap = await resolveLayoutTemplatesMap(box, env.OBCF_D1);
    const routeMappings = JSON.parse(box.get('routeMappingsJson') || '[]');
    if (routeMappings.length === 0) {
        // Fall back to global layout_route_mappings
        routeMappings.push(...(await getGlobalRouteMappings(env.OBCF_D1, box.get('organizationId'), box.get('appId'))));
    }
    // ... build full config with theme from ThemeVariant if themeVariantId set
}
```

**KV cache**: Stores `ResolvedBrandConfig` (full payload). Key includes `previewBrandBoxId` when in preview mode.

---

## 2️⃣ OttaORM Fat Model

```typescript
// packages/brand-engine/src/persistence/BrandSettings.model.ts
import { BaseModel, type PackageType } from '@ottabase/ottaorm';
import { brandSettingsTable, type BrandSettingsType } from './schema';
import type { BrandTheme, DesignTokens } from '../theme';
import type { LayoutConfig } from '../layout';
import { resolveTheme } from '../resolver';
import { DEFAULT_LAYOUT } from '../layout';

export class BrandSettings extends BaseModel {
    static entity = 'brand_settings';
    static table = brandSettingsTable;
    static primaryKey = 'id';
    static packageName = '@ottabase/brand-engine';
    static packageType: PackageType = 'core';

    static casts = {
        isDraft: 'boolean' as const,
        allowDarkModeToggle: 'boolean' as const,
        hideOttabaseBranding: 'boolean' as const,
        createdAt: 'date' as const,
        updatedAt: 'date' as const,
    };

    // ═══════════════════════════════════════════════════════════════════
    // QUERIES
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Resolve brand settings for an organization/app combination
     * Follows resolution order: draft → app → org → default
     */
    static async resolve(
        organizationId: string | null,
        appId?: string | null,
        userId?: string | null,
    ): Promise<BrandSettings | null> {
        // 1. Check for draft (user-specific preview)
        if (userId) {
            const draft = await this.first({
                organizationId,
                appId: appId || null,
                isDraft: true,
                // In real implementation, add userId field for draft ownership
            });
            if (draft) return draft;
        }

        // 2. Check app-level settings
        if (appId) {
            const appSettings = await this.first({
                organizationId,
                appId,
                isDraft: false,
            });
            if (appSettings) return appSettings;
        }

        // 3. Check org-level settings
        if (organizationId) {
            const orgSettings = await this.first({
                organizationId,
                appId: null,
                isDraft: false,
            });
            if (orgSettings) return orgSettings;
        }

        // 4. Fall back to system default
        return this.getOrCreateDefault();
    }

    /**
     * Get or create default brand settings
     */
    static async getOrCreateDefault(): Promise<BrandSettings> {
        const existing = await this.first({
            organizationId: null,
            appId: null,
            isDraft: false,
        });
        if (existing) return existing;

        return this.create({
            organizationId: null,
            appId: null,
            brandName: 'Ottabase',
            defaultColorScheme: 'system',
            allowDarkModeToggle: true,
        });
    }

    /**
     * Create a draft copy for preview
     */
    async createDraft(userId: string): Promise<BrandSettings> {
        const draft = await BrandSettings.create({
            organizationId: this.get('organizationId'),
            appId: this.get('appId'),
            brandName: this.get('brandName'),
            tagline: this.get('tagline'),
            tokensJson: this.get('tokensJson'),
            layoutJson: this.get('layoutJson'),
            logoKey: this.get('logoKey'),
            logoDarkKey: this.get('logoDarkKey'),
            iconKey: this.get('iconKey'),
            isDraft: true,
            // userId would be stored here in real implementation
        });
        return draft;
    }

    /**
     * Publish draft (create version snapshot, mark as published)
     */
    async publish(): Promise<void> {
        if (!this.get('isDraft')) {
            throw new Error('Only drafts can be published');
        }

        // Find existing published version
        const published = await BrandSettings.first({
            organizationId: this.get('organizationId'),
            appId: this.get('appId'),
            isDraft: false,
        });

        // Save previous version snapshot
        if (published) {
            this.set('previousVersionJson', JSON.stringify(published.toJson()));
            this.set('version', (published.get('version') || 1) + 1);
        }

        // Mark as published
        this.set('isDraft', false);
        await this.save();
    }

    // ═══════════════════════════════════════════════════════════════════
    // CONVERTERS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * Convert to BrandTheme for use with brand-engine
     */
    toBrandTheme(): BrandTheme {
        const tokensJson = this.get('tokensJson');
        let tokens: Partial<DesignTokens> = {};

        if (tokensJson) {
            try {
                tokens = JSON.parse(tokensJson);
            } catch {}
        }

        const layoutJson = this.get('layoutJson');
        let layout: Partial<LayoutConfig> | undefined;
        if (layoutJson) {
            try {
                layout = JSON.parse(layoutJson);
            } catch {}
        }

        return {
            name: `brand-${this.get('organizationId') || 'default'}-${this.get('appId') || 'default'}`,
            tokens: tokens as DesignTokens,
            layout: layout as LayoutConfig,
        };
    }

    /**
     * Get logo URLs (R2 public URLs)
     */
    getLogoUrls(r2PublicUrl: string): {
        logo?: string;
        logoDark?: string;
        icon?: string;
        ogImage?: string;
        emailLogo?: string;
    } {
        const baseUrl = r2PublicUrl || '';
        return {
            logo: this.get('logoKey') ? `${baseUrl}/${this.get('logoKey')}` : undefined,
            logoDark: this.get('logoDarkKey') ? `${baseUrl}/${this.get('logoDarkKey')}` : undefined,
            icon: this.get('iconKey') ? `${baseUrl}/${this.get('iconKey')}` : undefined,
            ogImage: this.get('ogImageKey') ? `${baseUrl}/${this.get('ogImageKey')}` : undefined,
            emailLogo: this.get('emailLogoKey') ? `${baseUrl}/${this.get('emailLogoKey')}` : undefined,
        };
    }
}
```

---

## 3️⃣ KV Caching Layer

Caches **ResolvedBrandConfig** (theme + logos + routeMappings + layoutTemplatesMap) for instant edge delivery.

```typescript
// packages/brand-engine/src/persistence/cache.ts
import type { KVNamespace } from '@cloudflare/workers-types';
import type { ResolvedBrandConfig } from './BrandResolver';

const CACHE_PREFIX = 'brand:resolved:';
const CACHE_TTL = 60 * 60; // 1 hour

export interface BrandCacheClient {
    get(orgId: string | null, appId?: string | null, previewBoxId?: string): Promise<ResolvedBrandConfig | null>;
    set(
        orgId: string | null,
        appId: string | null | undefined,
        config: ResolvedBrandConfig,
        previewBoxId?: string,
    ): Promise<void>;
    invalidate(organizationId: string | null, appId?: string | null): Promise<void>;
}

export function createBrandCache(kv: KVNamespace): BrandCacheClient {
    const getKey = (orgId: string | null, appId?: string | null, previewBoxId?: string) => {
        const parts = [orgId || 'default', appId || 'default'];
        if (previewBoxId) parts.push(`preview:${previewBoxId}`);
        return `${CACHE_PREFIX}${parts.join(':')}`;
    };

    return {
        async get(organizationId, appId, previewBoxId) {
            const key = getKey(organizationId, appId, previewBoxId);
            const cached = await kv.get(key, { type: 'json' });
            return cached as ResolvedBrandConfig | null;
        },

        async set(organizationId, appId, config, previewBoxId) {
            const key = getKey(organizationId, appId, previewBoxId);
            await kv.put(key, JSON.stringify(config), { expirationTtl: CACHE_TTL });
        },

        async invalidate(organizationId, appId) {
            // Invalidate all keys for this org/app (including preview variants)
            // Implementation: delete primary key; preview keys expire on TTL
            const key = getKey(organizationId, appId);
            await kv.delete(key);
            if (appId) await kv.delete(getKey(organizationId, null));
            if (organizationId) await kv.delete(getKey(null, null));
        },
    };
}
```

---

## 4️⃣ R2 Asset Management

```typescript
// packages/brand-engine/src/persistence/assets.ts
import type { R2Bucket } from '@cloudflare/workers-types';

export interface BrandAssetClient {
    uploadLogo(
        file: ArrayBuffer,
        filename: string,
        type: 'logo' | 'logo-dark' | 'icon' | 'og-image' | 'email-logo',
    ): Promise<string>;
    deleteLogo(key: string): Promise<void>;
    getPublicUrl(key: string): string;
}

export function createBrandAssets(bucket: R2Bucket, publicUrlBase: string): BrandAssetClient {
    return {
        async uploadLogo(file, filename, type) {
            const ext = filename.split('.').pop() || 'png';
            const key = `brand-assets/${type}/${crypto.randomUUID()}.${ext}`;

            await bucket.put(key, file, {
                httpMetadata: {
                    contentType: getContentType(ext),
                    cacheControl: 'public, max-age=31536000', // 1 year
                },
            });

            return key;
        },

        async deleteLogo(key) {
            await bucket.delete(key);
        },

        getPublicUrl(key) {
            return `${publicUrlBase}/${key}`;
        },
    };
}

function getContentType(ext: string): string {
    const types: Record<string, string> = {
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        svg: 'image/svg+xml',
        webp: 'image/webp',
        ico: 'image/x-icon',
    };
    return types[ext.toLowerCase()] || 'application/octet-stream';
}
```

**R2 Deployment**: R2 has no built-in public URLs. Configure `R2_PUBLIC_URL` via: (a) R2 custom domain + worker, or (b)
Cloudflare Images. Store as env var in `wrangler.toml`.

**Favicon Generation**: On icon upload, optionally use Cloudflare Images or sharp to auto-generate `favicon.ico`,
`apple-touch-icon.png`, etc. Store multiple sizes in R2 under `brand-assets/icon/`.

---

## 4a. Layout Template System

### Layout Registry & Path Resolver

```typescript
// packages/brand-engine/src/layouts/registry.ts
import type { LayoutConfig } from '../layout';

export type LayoutComponentKey = 'homepage' | 'app-shell' | 'docs' | 'minimal';

export interface LayoutTemplate {
    id: string;
    componentKey: LayoutComponentKey;
    config: LayoutConfig;
    name?: string;
}

/** Apps register their layout components; Brand Engine resolves which to render */
const layoutComponentMap = new Map<
    LayoutComponentKey,
    React.ComponentType<{ config: LayoutConfig; children: React.ReactNode }>
>();

export function registerLayoutComponent(key: LayoutComponentKey, Component: React.ComponentType<any>) {
    layoutComponentMap.set(key, Component);
}

export function getLayoutComponent(key: LayoutComponentKey) {
    return layoutComponentMap.get(key);
}

/**
 * Convert path pattern to regex.
 * * = one segment ([^/]+), ** = zero-or-more segments (.*)
 */
export function pathPatternToRegex(pattern: string): RegExp {
    const escaped = pattern
        .replace(/\*\*/g, '<<GLOB>>')
        .replace(/\*/g, '[^/]+')
        .replace(/<<GLOB>>/g, '.*');
    return new RegExp(`^${escaped}$`);
}

/**
 * Resolve layout for a given path from route mappings.
 * Higher priority number = checked first.
 */
export function resolveLayoutForPath(
    pathname: string,
    routeMappings: Array<{ pathPattern: string; layoutTemplateId: string; priority?: number }>,
): string | null {
    const sorted = [...routeMappings].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    for (const m of sorted) {
        const re = pathPatternToRegex(m.pathPattern);
        if (re.test(pathname)) return m.layoutTemplateId;
    }
    return null;
}
```

### Built-in Layout Presets

```typescript
// packages/brand-engine/src/layouts/presets.ts
export const HOMEPAGE_LAYOUT = {
    componentKey: 'homepage',
    config: { header: 'minimal', navigation: 'topbar', contentWidth: 'full', footer: true, density: 'comfy' },
};

export const APP_SHELL_LAYOUT = {
    componentKey: 'app-shell',
    config: { header: 'topbar', navigation: 'sidebar', contentWidth: 'fluid', footer: false, density: 'comfy' },
};

export const DOCS_LAYOUT = {
    componentKey: 'docs',
    config: { header: 'topbar', navigation: 'sidebar', contentWidth: 'fixed', footer: true, density: 'compact' },
};
```

### React: LayoutResolver (Router-Agnostic)

```typescript
// packages/brand-engine-react/src/LayoutResolver.tsx
'use client';

import { useState, useEffect } from 'react';
import { useBrand } from './useBrand';
import { getLayoutComponent, resolveLayoutForPath } from '@ottabase/brand-engine/layouts';
import { HOMEPAGE_LAYOUT, APP_SHELL_LAYOUT, DOCS_LAYOUT } from '@ottabase/brand-engine/layouts/presets';

/** Router adapter: provide usePathname from your router */
export interface RouterAdapter {
	usePathname: () => string;
}

const defaultMappings = [
	{ pathPattern: '/app/*', layoutTemplateId: 'app-shell', priority: 10 },
	{ pathPattern: '/docs/*', layoutTemplateId: 'docs', priority: 10 },
	{ pathPattern: '/*', layoutTemplateId: 'homepage', priority: 0 },
];

const presets: Record<string, { componentKey: string; config: any }> = {
	'homepage': HOMEPAGE_LAYOUT,
	'app-shell': APP_SHELL_LAYOUT,
	'docs': DOCS_LAYOUT,
};

function usePathnameFallback() {
	const [path, setPath] = useState(() => (typeof window !== 'undefined' ? window.location.pathname : '/'));
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const handler = () => setPath(window.location.pathname);
		window.addEventListener('popstate', handler);
		return () => window.removeEventListener('popstate', handler);
	}, []);
	return path;
}

export function LayoutResolver({
	children,
	router,
}: {
	children: React.ReactNode;
	router?: RouterAdapter;
}) {
	const { config } = useBrand();
	const usePathname = router?.usePathname ?? usePathnameFallback;
	const pathname = usePathname();

	const routeMappings = config?.routeMappings?.length ? config.routeMappings : defaultMappings;
	const layoutTemplateId = resolveLayoutForPath(pathname, routeMappings) ?? 'homepage';

	const layoutTemplate =
		config?.layoutTemplatesMap?.[layoutTemplateId] ?? presets[layoutTemplateId] ?? HOMEPAGE_LAYOUT;
	const LayoutComponent = getLayoutComponent(layoutTemplate.componentKey as any);

	if (!LayoutComponent) return <>{children}</>;
	return <LayoutComponent config={layoutTemplate.config}>{children}</LayoutComponent>;
}
```

```typescript
// packages/brand-engine-react/src/routers/tanstack.ts
import { useLocation } from '@tanstack/react-router';
export const tanstackRouterAdapter = { usePathname: () => useLocation().pathname };
```

---

## 5️⃣ Google Fonts Integration

```typescript
// packages/brand-engine/src/fonts/google-fonts.ts
/**
 * Google Fonts metadata and utilities
 * Pre-curated list of high-quality fonts for branding
 */

export interface GoogleFont {
    family: string;
    category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
    weights: number[];
    popular: boolean;
    description?: string;
}

/**
 * Curated font list (expandable)
 */
export const CURATED_FONTS: GoogleFont[] = [
    // Sans-serif (modern, clean)
    {
        family: 'Inter',
        category: 'sans-serif',
        weights: [300, 400, 500, 600, 700],
        popular: true,
        description: 'Modern, highly legible',
    },
    {
        family: 'Outfit',
        category: 'sans-serif',
        weights: [300, 400, 500, 600, 700],
        popular: true,
        description: 'Geometric, contemporary',
    },
    {
        family: 'Plus Jakarta Sans',
        category: 'sans-serif',
        weights: [300, 400, 500, 600, 700],
        popular: true,
        description: 'Elegant, professional',
    },
    {
        family: 'DM Sans',
        category: 'sans-serif',
        weights: [400, 500, 700],
        popular: true,
        description: 'Friendly, approachable',
    },
    {
        family: 'Space Grotesk',
        category: 'sans-serif',
        weights: [300, 400, 500, 600, 700],
        popular: true,
        description: 'Tech-forward, bold',
    },
    // ... more fonts
];

/**
 * Search fonts by name or category
 */
export function searchFonts(query: string, category?: GoogleFont['category']): GoogleFont[] {
    const lowerQuery = query.toLowerCase();
    return CURATED_FONTS.filter((font) => {
        const matchesQuery = !query || font.family.toLowerCase().includes(lowerQuery);
        const matchesCategory = !category || font.category === category;
        return matchesQuery && matchesCategory;
    });
}

/**
 * Generate Google Fonts CSS URL
 */
export function getGoogleFontsUrl(fonts: string[], weights: number[] = [400, 500, 600, 700]): string {
    const families = fonts.map((f) => `family=${encodeURIComponent(f)}:wght@${weights.join(';')}`).join('&');
    return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
```

---

## 6️⃣ React Provider & Hooks

```typescript
// packages/brand-engine/src/react/BrandProvider.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { applyBrandTheme, resolveTheme } from '../css-runtime';
import type { ResolvedBrandTheme } from '../resolver';

export interface BrandConfig {
	brandName: string;
	tagline?: string;
	logos: {
		primary?: string;
		dark?: string;
		icon?: string;
		ogImage?: string;
		emailLogo?: string;
	};
	theme: ResolvedBrandTheme;
	defaultColorScheme: 'light' | 'dark' | 'system';
	allowDarkModeToggle: boolean;
	customCss?: string;
	hideOttabaseBranding: boolean;
	/** Route path patterns → layout template ID (for LayoutResolver) */
	routeMappings: Array<{ pathPattern: string; layoutTemplateId: string; priority: number }>;
	/** Map layoutTemplateId → { componentKey, config } */
	layoutTemplatesMap: Record<string, { componentKey: string; config: LayoutConfig }>;
}

interface BrandContextValue {
	config: BrandConfig | null;
	isLoading: boolean;
	error: Error | null;
	refresh: () => Promise<void>;
}

const BrandContext = createContext<BrandContextValue | null>(null);

export interface BrandProviderProps {
	children: React.ReactNode;
	/** API endpoint to fetch brand config */
	apiEndpoint?: string;
	/** Initial brand config (for SSR) */
	initialConfig?: BrandConfig;
	/** Organization ID for multi-tenant */
	organizationId?: string | null;
	/** App ID for app-specific branding */
	appId?: string | null;
	/** BrandBox ID for preview mode (?brandPreview=) */
	previewBrandBoxId?: string | null;
}

export function BrandProvider({
	children,
	apiEndpoint = '/api/brand',
	initialConfig,
	organizationId,
	appId,
	previewBrandBoxId,
}: BrandProviderProps) {
	const [config, setConfig] = useState<BrandConfig | null>(initialConfig || null);
	const [isLoading, setIsLoading] = useState(!initialConfig);
	const [error, setError] = useState<Error | null>(null);

	const fetchConfig = useCallback(async () => {
		try {
			setIsLoading(true);
			const params = new URLSearchParams();
			if (organizationId) params.set('organizationId', organizationId);
			if (appId) params.set('appId', appId);
			if (previewBrandBoxId) params.set('brandPreview', previewBrandBoxId);
			const url = params.toString() ? `${apiEndpoint}?${params}` : apiEndpoint;

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error('Failed to fetch brand config');
			}

			const data = await response.json();
			setConfig(data);
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err : new Error('Unknown error'));
		} finally {
			setIsLoading(false);
		}
	}, [apiEndpoint, organizationId, appId, previewBrandBoxId]);

	// Fetch config on mount
	useEffect(() => {
		if (!initialConfig) {
			fetchConfig();
		}
	}, [fetchConfig, initialConfig]);

	// Apply theme when config changes
	useEffect(() => {
		if (!config?.theme) return;

		// Apply to DOM
		if (typeof document !== 'undefined') {
			applyBrandTheme(config.theme);
		}

		// Inject custom CSS
		if (config.customCss) {
			injectCustomCss(config.customCss);
		}
	}, [config]);

	return (
		<BrandContext.Provider value={{ config, isLoading, error, refresh: fetchConfig }}>
			{children}
		</BrandContext.Provider>
	);
}

export function useBrand(): BrandContextValue {
	const context = useContext(BrandContext);
	if (!context) {
		throw new Error('useBrand must be used within a BrandProvider');
	}
	return context;
}

function injectCustomCss(css: string) {
	const id = 'brand-custom-css';
	let style = document.getElementById(id) as HTMLStyleElement | null;

	if (!style) {
		style = document.createElement('style');
		style.id = id;
		document.head.appendChild(style);
	}

	style.textContent = css;
}
```

---

## 7️⃣ API Handlers

```typescript
// packages/brand-engine/src/handlers/brand-api.ts
import { BrandSettings } from '../persistence/BrandSettings.model';
import { BrandBox } from '../persistence/BrandBox.model';
import { resolveBrandConfig } from '../persistence/BrandResolver';
import { createBrandCache } from '../persistence/cache';
import { createBrandAssets } from '../persistence/assets';
import { resolveTheme } from '../resolver';
import type { D1Database, KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import { jsonResponse, errorResponse } from '@ottabase/utils/http-response';

export interface BrandApiEnv {
    OBCF_D1: D1Database;
    OBCF_KV: KVNamespace;
    OBCF_R2: R2Bucket;
    R2_PUBLIC_URL?: string;
}

/**
 * GET /api/brand - Get resolved brand config (BrandBox first, then BrandSettings)
 * Query: ?brandPreview=box-id to preview a BrandBox without applying
 */
export async function handleGetBrand(
    request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
    userId?: string | null,
): Promise<Response> {
    const url = new URL(request.url);
    const previewBrandBoxId = url.searchParams.get('brandPreview') ?? undefined;

    const cache = createBrandCache(env.OBCF_KV);

    const cached = await cache.get(organizationId, appId, previewBrandBoxId);
    if (cached) return jsonResponse(cached, 200);

    const config = await resolveBrandConfig(env, {
        organizationId,
        appId,
        previewBrandBoxId,
        userId,
    });
    if (!config) return errorResponse('Brand config not found', 404);

    await cache.set(organizationId, appId || null, config, previewBrandBoxId);
    return jsonResponse(config, 200);
}

/**
 * PUT /api/brand - Update brand settings
 * RBAC: require brand:edit or brand:*
 */
export async function handleUpdateBrand(
    request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const body = await request.json();
    const cache = createBrandCache(env.OBCF_KV);

    // Find or create settings
    let settings = await BrandSettings.resolve(organizationId, appId);
    if (!settings) {
        settings = await BrandSettings.create({
            organizationId,
            appId: appId || null,
            brandName: body.brandName || 'My App',
        });
    }

    // Update fields
    const updateableFields = [
        'brandName',
        'tagline',
        'tokensJson',
        'layoutJson',
        'defaultColorScheme',
        'allowDarkModeToggle',
        'customCss',
        'hideOttabaseBranding',
    ];

    for (const field of updateableFields) {
        if (body[field] !== undefined) {
            settings.set(field, body[field]);
        }
    }

    await settings.save();

    // Invalidate cache
    await cache.invalidate(organizationId, appId);

    return jsonResponse({ success: true }, 200);
}

/**
 * POST /api/brand/logo - Upload logo
 * RBAC: require brand:edit or brand:*
 */
export async function handleUploadLogo(
    request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
    appId: string | null | undefined,
    logoType: 'logo' | 'logo-dark' | 'icon' | 'og-image' | 'email-logo',
): Promise<Response> {
    const assets = createBrandAssets(env.OBCF_R2, env.R2_PUBLIC_URL || '');
    const cache = createBrandCache(env.OBCF_KV);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
        return errorResponse('No file provided', 400);
    }

    const buffer = await file.arrayBuffer();
    const key = await assets.uploadLogo(buffer, file.name, logoType);

    // Update settings
    const settings = await BrandSettings.resolve(organizationId, appId);
    if (settings) {
        const fieldMap = {
            logo: 'logoKey',
            'logo-dark': 'logoDarkKey',
            icon: 'iconKey',
            'og-image': 'ogImageKey',
            'email-logo': 'emailLogoKey',
        };
        settings.set(fieldMap[logoType], key);
        await settings.save();
        await cache.invalidate(organizationId, appId);
    }

    return jsonResponse(
        {
            key,
            url: assets.getPublicUrl(key),
        },
        200,
    );
}

/**
 * POST /api/brand/apply - Set active BrandBox (instant apply)
 * RBAC: require brand:apply or brand:*
 */
export async function handleApplyBrandBox(
    request: Request,
    env: BrandApiEnv,
    organizationId: string | null,
    appId?: string | null,
): Promise<Response> {
    const body = await request.json();
    const brandBoxId = body.brandBoxId;
    if (!brandBoxId) return errorResponse('brandBoxId required', 400);

    const cache = createBrandCache(env.OBCF_KV);

    // Deactivate all other BrandBoxes for this org/app
    await BrandBox.deactivateAll(organizationId, appId);

    // Activate the selected BrandBox
    const box = await BrandBox.find(brandBoxId);
    if (!box) return errorResponse('BrandBox not found', 404);
    box.set('isActive', true);
    await box.save();

    await cache.invalidate(organizationId, appId);
    return jsonResponse({ success: true }, 200);
}
```

---

## 8️⃣ Admin UI Components

### Main Admin Page

```tsx
// packages/brand-engine/admin/BrandAdminPage.tsx
'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Button,
} from '@ottabase/ui-shadcn';
import { LogoUploader } from './LogoUploader';
import { ColorPicker } from './ColorPicker';
import { FontSelector } from './FontSelector';
import { BrandPreview } from './BrandPreview';
import { TokenEditor } from './TokenEditor';
import { api } from '@ottabase/api';

export function BrandAdminPage() {
    const queryClient = useQueryClient();
    const [hasChanges, setHasChanges] = useState(false);

    const { data: config, isLoading } = useQuery({
        queryKey: ['brand-settings'],
        queryFn: () => api('/api/brand'),
    });

    const [formState, setFormState] = useState(config || {});

    const mutation = useMutation({
        mutationFn: (data: any) => api('/api/brand', { method: 'PUT', body: JSON.stringify(data) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['brand-settings'] });
            setHasChanges(false);
        },
    });

    const updateField = (field: string, value: any) => {
        setFormState((prev: any) => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Settings Panel */}
            <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold">Brand Settings</h1>
                        <p className="text-muted-foreground">Customize your app's branding</p>
                    </div>
                    <Button onClick={() => mutation.mutate(formState)} disabled={!hasChanges || mutation.isPending}>
                        {mutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>

                <Tabs defaultValue="identity">
                    <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="identity">Identity</TabsTrigger>
                        <TabsTrigger value="colors">Colors</TabsTrigger>
                        <TabsTrigger value="typography">Typography</TabsTrigger>
                        <TabsTrigger value="layout">Layout</TabsTrigger>
                        <TabsTrigger value="advanced">Advanced</TabsTrigger>
                    </TabsList>

                    {/* Identity Tab */}
                    <TabsContent value="identity" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Brand Identity</CardTitle>
                                <CardDescription>Your app's name and logo</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">{/* Brand name, tagline, logo uploaders */}</CardContent>
                        </Card>
                    </TabsContent>

                    {/* Colors Tab */}
                    <TabsContent value="colors" className="space-y-4">
                        <TokenEditor
                            value={formState.tokensJson}
                            onChange={(v) => updateField('tokensJson', v)}
                            onValidateContrast // Uses calculateContrastRatio from brand-engine; warns if WCAG fails
                        />
                    </TabsContent>

                    {/* Typography Tab */}
                    <TabsContent value="typography" className="space-y-4">
                        <FontSelector
                            label="Heading Font"
                            value={formState.fonts?.heading}
                            onChange={(v) => updateField('fonts', { ...formState.fonts, heading: v })}
                        />
                    </TabsContent>

                    {/* Layout Tab */}
                    <TabsContent value="layout" className="space-y-4">
                        {/* Layout preset selector */}
                    </TabsContent>

                    {/* Advanced Tab */}
                    <TabsContent value="advanced" className="space-y-4">
                        {/* Custom CSS, white-label toggle, etc. */}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Preview Panel */}
            <div className="lg:col-span-1">
                <div className="sticky top-4">
                    <BrandPreview config={formState} />
                </div>
            </div>
        </div>
    );
}
```

### BrandBox Manager

```tsx
// packages/brand-engine/admin/BrandBoxManager.tsx
export function BrandBoxManager() {
    // List all BrandBoxes, create new, duplicate, apply (one-click)
    // Apply = POST /api/brand/apply { brandBoxId }
    // Shows: name, theme, layout summary, last applied
    // "Apply" button → instant site update
}
```

### Layout Template Editor

```tsx
// packages/brand-engine/admin/LayoutTemplateEditor.tsx
// - Create/edit layout templates (name, componentKey, config)
// - Route mappings: path pattern → layout template
// - Visual: path pattern input + dropdown for layout
// - Default mappings: /app/* → app-shell, /* → homepage
```

### Theme Variant Editor

```tsx
// packages/brand-engine/admin/ThemeVariantEditor.tsx
// - Create theme overlays (Christmas, Black Friday, etc.)
// - Color picker for primary/secondary/accent overrides
// - Same layout, different theme - preview side-by-side
// - Optional: activeFrom/activeUntil for scheduled activation
export function ThemeVariantEditor() {
    // ...
}
```

---

## 9️⃣ Additional Features

### Email Branding Engine

Apply brand settings to transactional emails:

```typescript
// packages/brand-engine/src/email/brand-email.ts
export function applyBrandToEmail(html: string, brandConfig: BrandConfig): string {
    // Inject brand colors, fonts, logo into email template
    // Replace placeholders with brand values
    return html
        .replace(/\{\{brandName\}\}/g, brandConfig.brandName)
        .replace(/\{\{logoUrl\}\}/g, brandConfig.logos.emailLogo || brandConfig.logos.primary || '')
        .replace(/\{\{primaryColor\}\}/g, brandConfig.theme.tokens.color.light.primary);
}
```

### Domain → Brand Mapping

```typescript
// packages/brand-engine/src/persistence/domain-mapping.ts
export const domainBrandMappingTable = sqliteTable('domain_brand_mapping', {
    id: text('id').primaryKey(),
    domain: text('domain').notNull().unique(),
    organizationId: text('organization_id'),
    appId: text('app_id'),
});
```

### Version History & Rollback

```typescript
// BrandSettings model already includes versioning
async rollback(): Promise<void> {
	const previous = this.get('previousVersionJson');
	if (!previous) throw new Error('No previous version to rollback to');

	const prevSettings = JSON.parse(previous);
	// Restore previous version
	await this.setFields(prevSettings);
	await this.save();
}
```

### Audit Log Integration

Integrate with `@ottabase/audit` to log brand changes:

```typescript
// In handlers, after successful mutations:
await auditLog(env, { action: 'brand.apply', entity: 'brand_box', entityId: brandBoxId, userId });
await auditLog(env, { action: 'brand.update', entity: 'brand_settings', userId });
await auditLog(env, { action: 'brand.logo.upload', entity: 'brand_asset', meta: { type: logoType } });
```

---

## 🔟 Integration with Existing Apps

### App Setup (TanStack Router Example)

```typescript
// apps/ottabase-template-app-tanstack/src/providers/Providers.tsx
import { BrandProvider, LayoutResolver } from '@ottabase/brand-engine-react';
import { registerLayoutComponent } from '@ottabase/brand-engine/layouts';
import { tanstackRouterAdapter } from '@ottabase/brand-engine-react/routers';
import { useAtomValue } from 'jotai';
import { organizationIdAtom } from '@/ottabase/state/appGlobalState';

import { HomepageLayout } from '@/layouts/HomepageLayout';
import { AppShellLayout } from '@/layouts/AppShellLayout';
import { DocsLayout } from '@/layouts/DocsLayout';

registerLayoutComponent('homepage', HomepageLayout);
registerLayoutComponent('app-shell', AppShellLayout);
registerLayoutComponent('docs', DocsLayout);

export function Providers({ children }: { children: React.ReactNode }) {
	const organizationId = useAtomValue(organizationIdAtom);

	return (
		<BrandProvider organizationId={organizationId} appId="ottabase-template-app">
			<LayoutResolver router={tanstackRouterAdapter}>{children}</LayoutResolver>
		</BrandProvider>
	);
}
```

**Preview mode** (e.g. from admin): Pass `previewBrandBoxId` to BrandProvider when viewing a BrandBox before applying.

### Using Brand in Components

```typescript
// Any component
import { useBrand } from '@ottabase/brand-engine-react';

export function Header() {
	const { config } = useBrand();

	return (
		<header>
			{config?.logos.primary && (
				<img src={config.logos.primary} alt={config.brandName} />
			)}
			<h1>{config?.brandName}</h1>
		</header>
	);
}
```

---

## 📋 Implementation Checklist

### Phase 1: Core Infrastructure (Set 1)

- [ ] Create `brand_settings`, `layout_templates`, `layout_route_mappings`, `theme_variants`, `brand_boxes` tables
- [ ] Implement `BrandSettings`, `BrandBox`, `LayoutTemplate`, `ThemeVariant` OttaORM models
- [ ] Implement `BrandResolver` (BrandBox first, then BrandSettings)
- [ ] Add KV caching layer (ResolvedBrandConfig with routeMappings + layoutTemplatesMap)
- [ ] Add R2 asset management for logos (note: R2_PUBLIC_URL required)
- [ ] Add `layoutTemplatesSnapshotJson` to BrandBox for layout versioning

### Phase 2: Layout Template System (Set 2)

- [ ] Layout registry (registerLayoutComponent, getLayoutComponent)
- [ ] Path pattern resolver (resolveLayoutForPath)
- [ ] Built-in presets (homepage, app-shell, docs)
- [ ] `GET /api/brand/layouts` - List layout templates
- [ ] `PUT /api/brand/layouts` - Create/update layout templates
- [ ] Route mappings CRUD

### Phase 3: Theme Variants & BrandBox (Set 3)

- [ ] Theme variant schema + model
- [ ] BrandBox schema + model (links layout + theme + config)
- [ ] `GET /api/brandbox` - List BrandBoxes
- [ ] `PUT /api/brandbox` - Create/update BrandBox
- [ ] `POST /api/brand/apply` - Set active BrandBox (instant apply)
- [ ] `POST /api/brandbox/:id/duplicate` - Duplicate BrandBox
- [ ] KV cache invalidation on BrandBox apply

### Phase 4: API Layer (Set 4)

- [ ] `GET /api/brand` - BrandResolver, ?brandPreview= support, full ResolvedBrandConfig
- [ ] `PUT /api/brand` - Update brand settings (RBAC: brand:edit)
- [ ] `POST /api/brand/logo` - Upload logos, favicon auto-generation (RBAC: brand:edit)
- [ ] `DELETE /api/brand/logo/:type` - Delete logos
- [ ] `GET /api/brand/fonts` - Search Google Fonts
- [ ] `POST /api/brand/apply` - Set active BrandBox (RBAC: brand:apply)
- [ ] `POST /api/brand/publish` - Publish draft
- [ ] `POST /api/brand/rollback` - Rollback to previous version
- [ ] Audit log integration (@ottabase/audit)

### Phase 5: React Integration (Set 5)

- [ ] Create `@ottabase/brand-engine-react` package
- [ ] Create `BrandProvider` with `previewBrandBoxId` support
- [ ] Create `LayoutResolver` with router adapter (TanStack, React Router, Next.js)
- [ ] Create `useBrand`, `useLayoutForPath`, `useFontPreview` hooks
- [ ] BrandConfig includes routeMappings, layoutTemplatesMap (from API)
- [ ] Edge/SSR injection of critical CSS vars (zero FOUC)

### Phase 6: Admin UI (Set 6)

- [ ] Create `@ottabase/brand-engine-admin` package
- [ ] Brand settings page, BrandBox Manager, Layout Template Editor, Theme Variant Editor
- [ ] Logo uploader (drag & drop), Color picker, Font selector
- [ ] Token editor with contrast validation (calculateContrastRatio, WCAG warnings)
- [ ] Live preview panel, Draft/publish workflow

### Phase 7: Polish & Extensions (Set 7)

- [ ] Email branding (applyBrandToEmail)
- [ ] Domain → brand mapping
- [ ] Import/export BrandBox (JSON)
- [ ] Scheduled BrandBox activation (activeFrom/activeUntil)
- [ ] RBAC integration (brand:\*, brand:read, brand:edit, brand:apply)
- [ ] Documentation

---

## 🎯 Key Differentiators

1. **Runtime, Not Build-Time** - Changes apply instantly without redeploy
2. **Multi-Tenant Native** - Built for SaaS from day one
3. **Design Token-First** - Leverages existing `@ottabase/brand-engine`
4. **Multiple Layouts Per App** - Route-group-based dynamic layouts (homepage vs app shell)
5. **Theme Overlays** - Seasonal/campaign themes on same layout (Christmas, Black Friday)
6. **BrandBox** - Saveable presets (layout + theme + config) with one-click apply
7. **Draft Mode** - Preview changes before publishing
8. **Version History** - Rollback to previous versions
9. **Edge Performance** - KV caching for sub-10ms lookups
10. **White-Label Ready** - Hide Ottabase branding, custom domains

---

## 🚀 Strategic Value

This transforms Ottabase from a framework with theming to a **runtime branding platform**:

- **Solo founders** can white-label their SaaS instantly
- **Agencies** can manage multiple client brands from one codebase
- **Enterprises** can have org-specific branding without code changes
- **Developers** get a simple API that "just works"

**Marketing angle**: _"Zero-redeploy white-label branding baked into your SaaS."_

---

## 📌 Summary: Layout, Theme Overlays & BrandBox

| Capability                           | Problem Solved                                            | Solution                                                                       |
| ------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Layout Templates + Route Mapping** | Can't have different layouts per route (homepage vs app)  | Multiple layout templates, path patterns → layout ID, dynamic `LayoutResolver` |
| **Theme Variants**                   | Can't change colors/theme on same layout (e.g. Christmas) | Decoupled theme overlays; same layout + different theme variant                |
| **BrandBox**                         | No way to save & apply complete brand preset instantly    | BrandBox = layout + theme + config; one-click apply to affect site             |

---

## 📋 Phase Plan (Implementation Order)

Implementation is chunked by dependency. Each phase ships a working slice before moving on.

### Phase 1: Foundation (No BrandBox / Layout Yet)

Get basic brand persistence working before BrandBox or layout logic.

1. **Schema & migrations** – `brand_settings` table only
2. **BrandSettings model** – OttaORM model with `resolve()`, `getOrCreateDefault()`
3. **KV cache** – Simple cache for resolved brand config (org/app key)
4. **R2 assets** – `createBrandAssets()`, logos; document R2_PUBLIC_URL
5. **Core API** – `GET /api/brand` (BrandSettings only), `PUT /api/brand`, `POST /api/brand/logo`; RBAC
6. **BrandProvider (minimal)** – Fetch config, apply theme, inject CSS (no routeMappings yet)

**Outcome**: Brand settings in DB, logos in R2, theming works end-to-end.

---

### Phase 2: Layout Templates & Route Mapping

Add layout-per-path without BrandBox.

1. **Layout schema** – `layout_templates`, `layout_route_mappings`
2. **Layout models** – LayoutTemplate, route mapping helpers
3. **Layout registry (non-React)** – `pathPatternToRegex`, `resolveLayoutForPath`, presets
4. **Layout API** – CRUD for layouts and mappings
5. **Extend BrandProvider** – Config includes routeMappings, layoutTemplatesMap (from global mappings)
6. **LayoutResolver** – Router adapter, resolve layout by path, wrap children
7. **App layout registration** – Register layout components in app

**Outcome**: Different layouts per path (e.g. homepage vs app shell) using global mappings.

---

### Phase 3: Theme Variants

Seasonal/campaign themes that overlay on any layout.

1. **Schema** – `theme_variants` table
2. **ThemeVariant model** – CRUD, token overlay logic
3. **API** – CRUD for theme variants; include in resolved config when selected
4. **Resolution** – Merge theme variant tokens onto base theme in resolver

**Outcome**: Same layout, different theme (e.g. Christmas, Black Friday). No UI yet.

---

### Phase 4: BrandBox

Unified presets with one-click apply.

1. **Schema** – `brand_boxes` with `layoutTemplatesSnapshotJson`, `routeMappingsJson`, etc.
2. **BrandBox model** – CRUD, `deactivateAll()`, snapshot on apply
3. **BrandResolver** – BrandBox-first resolution, `?brandPreview=`, layoutTemplatesMap from snapshot or DB
4. **API updates** – `handleGetBrand` uses BrandResolver; `POST /api/brand/apply`; KV cache shape
5. **BrandProvider** – Support `previewBrandBoxId`, `?brandPreview=` in fetch

**Outcome**: BrandBoxes drive full config (layout + theme + logos); one-click apply.

---

### Phase 5: Edge / SSR & Zero FOUC

1. **buildCriticalCSS()** – Generate `:root { ... }` from resolved theme
2. **Edge middleware** – Fetch brand config before first paint, inject critical CSS into `<head>`
3. **BrandProvider** – Hydrate full theme after; avoid overwriting critical CSS

**Outcome**: No flash of unstyled content.

---

### Phase 6: Admin UI

1. **brand-engine-admin package** – Create package with React, TanStack Query, shadcn
2. **Brand settings page** – Identity, logos, colors, typography, layout, advanced
3. **BrandBox manager** – List, create, duplicate, apply; preview before apply
4. **Layout template editor** – Edit templates and route mappings
5. **Theme variant editor** – Create/edit seasonal themes
6. **Shared components** – LogoUploader, ColorPicker, FontSelector, TokenEditor (contrast validation), BrandPreview

**Outcome**: Non-technical users can manage branding.

---

### Phase 7: Polish & Extensions

1. Favicon generation on icon upload
2. Audit logging integration
3. Email branding (`applyBrandToEmail`)
4. Domain mapping (optional)

---

### Dependency Graph

```
Phase 1 (Foundation)
    ↓
Phase 2 (Layouts)
    ↓
Phase 3 (Theme Variants)  ← can run in parallel with Phase 2
    ↓
Phase 4 (BrandBox)  ← needs 2 + 3
    ↓
Phase 5 (Edge/SSR)  ← needs 1 + 4
Phase 6 (Admin UI)  ← needs 1 + 2 + 3 + 4
    ↓
Phase 7 (Polish)
```

---

## 📝 Next Steps

1. Review and refine this plan
2. Create detailed technical specs for each component
3. Set up project board with phases
4. Begin Phase 1 implementation
5. Iterate based on feedback

---

**This plan leverages Ottabase's existing strengths** (OttaORM, D1, KV, R2, brand-engine) while adding the persistence
and admin layers needed for a complete branding solution.
