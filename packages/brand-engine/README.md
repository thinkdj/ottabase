# @ottabase/brand-engine

Unified theme engine for Ottabase — design tokens, theme resolution, CSS variable injection, BrandBoxes, email branding,
and brand persistence via D1.

## Features

- **Design Tokens** — Typed schema for colors, typography, spacing, shadows, motion, cursors
- **Theme Resolution** — Merge user overrides with defaults; named theme registry
- **CSS Runtime** — Inject design tokens as CSS custom properties; auto-load Google Fonts
- **Critical CSS** — Server-rendered dual-mode (light + dark) style tags for zero-FOUC
- **BrandBoxes** — One-click theme + logo presets
- **Email Branding** — Replace `{{brandName}}`, `{{logoUrl}}`, etc. in email HTML
- **Favicon** — Resolve best favicon URL from brand config
- **Built-in Themes** — Ship with default themes, register custom ones
- **Fonts & Cursors** — Google Fonts catalog, custom cursor SVG registry

> **Layout types & presets** live in [`@ottabase/ottalayout`](../ottalayout/README.md). **React bindings**
> (`BrandProvider`, `LayoutResolver`) live in [`@ottabase/brand-engine-react`](../brand-engine-react/README.md).

## Quick Start

### Design Tokens & Access

```typescript
import { getToken, DEFAULT_COLORS_LIGHT } from '@ottabase/brand-engine';

const primary = getToken(DEFAULT_COLORS_LIGHT, 'colors.primary.500');
```

### Theme Registry

```typescript
import { registerTheme, resolveTheme, injectCSSVars } from '@ottabase/brand-engine';

registerTheme(myTheme);
const theme = resolveTheme('my-theme');
injectCSSVars(theme); // sets CSS vars on :root
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

| Method | Path                          | Description                                   |
| ------ | ----------------------------- | --------------------------------------------- |
| GET    | `/api/brand`                  | Resolved brand config (light + dark tokens)   |
| GET    | `/api/brand/settings`         | Raw settings for admin editing                |
| PUT    | `/api/brand`                  | Update brand settings                         |
| POST   | `/api/brand/apply`            | Activate a BrandBox                           |
| POST   | `/api/brand/logo/:type`       | Upload logo (logo, logo-dark, icon, og-image) |
| GET    | `/api/brand/layouts`          | List layout templates                         |
| PUT    | `/api/brand/layouts`          | Create/update layout template                 |
| GET    | `/api/brand/mappings`         | List route mappings                           |
| PUT    | `/api/brand/mappings`         | Replace route mappings                        |
| GET    | `/api/brandbox`               | List BrandBoxes                               |
| POST   | `/api/brandbox`               | Create BrandBox                               |
| PUT    | `/api/brandbox/:id`           | Update BrandBox                               |
| DELETE | `/api/brandbox/:id`           | Delete BrandBox                               |
| POST   | `/api/brandbox/:id/duplicate` | Duplicate BrandBox                            |

## Architecture

```
@ottabase/brand-engine        ← tokens, themes, CSS, persistence, handlers (no React)
@ottabase/brand-engine-react  ← BrandProvider, LayoutResolver, useBrand()
@ottabase/ottalayout          ← LayoutConfig types, presets, resolver, validators, React slots
```

- **brand-engine** owns theme tokens, brand persistence (D1), and API handlers
- **ottalayout** owns layout types and route resolution (pure logic)
- **brand-engine-react** wires them together at runtime with `<BrandProvider>` and `<LayoutResolver>`
