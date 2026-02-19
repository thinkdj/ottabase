# @ottabase/brand-engine

Unified theme engine for Ottabase — design tokens, preset template expansion, CSS variable injection, email branding,
and brand persistence via D1.

## Features

- **Design Tokens** — Typed schema for colors, typography, spacing, shadows, motion, cursors
- **Preset Templates** — Theme presets expanded and saved to database (no runtime resolution needed)
- **CSS Runtime** — Inject design tokens as CSS custom properties; auto-load Google Fonts
- **Critical CSS** — Server-rendered dual-mode (light + dark) style tags for zero-FOUC
- **Email Branding** — Replace `{{brandName}}`, `{{logoUrl}}`, etc. in email HTML
- **Favicon** — Resolve best favicon URL from brand config
- **Built-in Presets** — Default, Neo, Crisp, Funky, Artisan, Midnight, Rose, Verdant
- **Fonts & Cursors** — Google Fonts catalog, custom cursor SVG registry

> **Architecture Note**: Presets are **templates**, not runtime themes. When a preset is selected, it's expanded to a
> complete theme and saved to the database. This eliminates runtime resolution complexity and Cloudflare Workers isolate
> state issues. The database becomes the single source of truth.

> **Layout types & presets** live in [`@ottabase/ottalayout`](../ottalayout/README.md). **React bindings**
> (`BrandProvider`, `LayoutResolver`) live in [`@ottabase/brand-engine-react`](../brand-engine-react/README.md).

## Quick Start

### Design Tokens & Access

```typescript
import { getToken, DEFAULT_COLORS_LIGHT } from '@ottabase/brand-engine';

const primary = getToken(DEFAULT_COLORS_LIGHT, 'colors.primary.500');
```

### Preset Expansion (Server-Side)

```typescript
import { expandPresetToTokens } from '@ottabase/brand-engine/handlers';

// When user selects a preset, expand it to full tokens and save to DB
const tokensJson = expandPresetToTokens('verdant', null);
await brandKit.set('tokensJson', tokensJson).save();

// Custom color overrides are merged on top of preset
const customTokensJson = expandPresetToTokens('verdant', existingTokensJson);
```

### Load and Apply Theme (Client & Server)

```typescript
import { brandKitToTheme, applyBrandTheme } from '@ottabase/brand-engine';

// Load brand kit from DB
const kit = await BrandKit.findByAppId(appId);

// Convert to resolved theme
const theme = await brandKitToTheme(kit, 'light'); // or 'dark'

// Apply to document (client-side)
applyBrandTheme(theme);
```

### Generate Palette from Brand Color

```typescript
import { buildTokensFromBaseColor } from '@ottabase/brand-engine';

const tokens = buildTokensFromBaseColor('#4f46e5');
// → full DesignTokens with auto-generated semantic palette
```

### Critical CSS (SSR)

```typescript
import { buildCriticalStyleTagDual } from '@ottabase/brand-engine';

// Generates <style> tag with both light & dark tokens for zero-FOUC
const styleTag = buildCriticalStyleTagDual(lightTokens, darkTokens);
// Inject into <head> in your worker response
```

### Email Branding

```typescript
import { applyBrandToEmail } from '@ottabase/brand-engine';

const html = '<img src="{{logoUrl}}" /><h1>{{brandName}}</h1>';
const branded = applyBrandToEmail(html, resolvedConfig);
```

### Favicon

```typescript
import { getFaviconUrl } from '@ottabase/brand-engine';

const url = getFaviconUrl(config);
// → <link rel="icon" href={url} />
```

### Google Fonts

```typescript
import { buildGoogleFontUrl, GOOGLE_FONTS } from '@ottabase/brand-engine';

const url = buildGoogleFontUrl('Inter', [400, 600]);
// → 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap'
```

## API Endpoints

Wire in your Cloudflare Worker via handlers from `@ottabase/brand-engine/handlers`.

| Method | Path                        | Description                                   |
| ------ | --------------------------- | --------------------------------------------- |
| GET    | `/api/brand`                | Resolved brand config (per-app)               |
| GET    | `/api/brand/presets`        | List available theme presets (JSON)           |
| GET    | `/api/brand/kits`           | List brand kits for app                       |
| POST   | `/api/brand/kits`           | Create brand kit (expands preset if selected) |
| PUT    | `/api/brand/kits/:id`       | Update brand kit (re-expands preset)          |
| DELETE | `/api/brand/kits/:id`       | Delete brand kit                              |
| POST   | `/api/brand/kits/:id/clone` | Clone brand kit                               |
| POST   | `/api/brand/kits/:id/logo`  | Upload logo (logo, logo-dark, icon, og-image) |
| GET    | `/api/brand/layouts`        | List layout templates                         |
| PUT    | `/api/brand/layouts`        | Create/update layout template                 |
| GET    | `/api/brand/mappings`       | List route mappings                           |
| PUT    | `/api/brand/mappings`       | Replace route mappings                        |

## Architecture

### Package Structure

```
@ottabase/brand-engine        ← tokens, themes, CSS, persistence, handlers (no React)
@ottabase/brand-engine-react  ← BrandProvider, LayoutResolver, useBrand()
@ottabase/ottalayout          ← LayoutConfig types, presets, resolver, validators, React slots
```

- **brand-engine** owns theme tokens, brand persistence (D1), and API handlers
- **ottalayout** owns layout types and route resolution (pure logic)
- **brand-engine-react** wires them together at runtime with `<BrandProvider>` and `<LayoutResolver>`

### Preset-as-Template Architecture (v3)

**Flow**: Preset Selection → Expansion → Database → Runtime → Render

```typescript
// 1. USER ACTION: Select preset "verdant"
// Frontend sends: { themePresetId: "verdant" }

// 2. BACKEND: Expand preset to full tokens
const preset = PRESET_MAP["verdant"];
const expanded = {
  color: {
    light: preset.colors.light,  // Full color palette for light mode
    dark: preset.colors.dark      // Full color palette for dark mode
  },
  typography: preset.typography,
  spacing: preset.spacing,
  radius: preset.radius,
  shadow: preset.shadows,
  motion: preset.motion
};

// 3. MERGE: Custom overrides on top of preset
if (existingCustomColors) {
  expanded.color.light = { ...expanded.color.light, ...customColors.light };
  expanded.color.dark = { ...expanded.color.dark, ...customColors.dark };
}

// 4. SAVE: Store complete theme to DB
brandKit.tokensJson = JSON.stringify(expanded);
await brandKit.save();

// 5. CACHE: Invalidate KV cache, re-warm with fresh DB data
await warmBrandCache(env, { kitId });

// 6. RUNTIME: Read directly from DB (no resolution needed)
const tokens = JSON.parse(brandKit.tokensJson);
const colors = tokens.color[mode]; // 'light' or 'dark'

// 7. RENDER: Apply to document
applyBrandTheme({ colors, typography, ... });
```

**Key Benefits**:

- ✅ **Single Source of Truth**: Database contains complete theme
- ✅ **No Runtime Resolution**: No registry lookups, no theme merging
- ✅ **Atomic Updates**: What you save = what renders
- ✅ **Works in Cloudflare Workers**: No module-level state dependencies
- ✅ **Self-Contained Kits**: Each kit independent, no preset dependencies

**Old Architecture (Removed)**:

- ❌ Stored only `themePresetId` in DB
- ❌ Runtime registry lookup for preset colors
- ❌ Complex resolution pipeline
- ❌ Cloudflare Workers isolate state resets cleared registry
- ❌ Race conditions between theme registration and usage
