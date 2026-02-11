# @ottabase/brand-engine

Unified theme engine for Ottabase: design tokens, theme resolution, layout per path, BrandBoxes, and brand persistence.

## Features

- **Design Tokens** – Typed schema for colors, typography, spacing, shadows, motion
- **Theme Resolution** – Merge user overrides with default themes
- **CSS Runtime** – Inject design tokens as CSS variables into the DOM
- **Layout System** – Per-path layouts via templates and route mappings
- **BrandBoxes** – One-click presets (layout + theme + logos)
- **Email Branding** – Replace placeholders in email HTML with brand values
- **Favicon Helper** – Best URL for favicon from config
- **Audit** – Integrates with @ottabase/audit for brand.update, brand.apply, brand.logo.upload

## Usage

### Token Access

```typescript
import { getToken, DEFAULT_COLORS_LIGHT } from '@ottabase/brand-engine';

const primaryColor = getToken(DEFAULT_COLORS_LIGHT, 'colors.primary.500');
```

### Theme Resolution & Registry

```typescript
import { registerTheme, resolveTheme, injectCSSVars } from '@ottabase/brand-engine';

registerTheme(myTheme);
const activeTheme = resolveTheme('my-theme');
injectCSSVars(activeTheme);
```

### Email Branding

```typescript
import { applyBrandToEmail } from '@ottabase/brand-engine';

// Placeholders: {{brandName}}, {{tagline}}, {{logoUrl}}, {{primaryColor}}, {{primaryColorHex}}
const html = '<img src="{{logoUrl}}" /><h1>{{brandName}}</h1><p>{{tagline}}</p>';
const branded = applyBrandToEmail(html, resolvedConfig);
```

### Favicon

```typescript
import { getFaviconUrl } from '@ottabase/brand-engine';

const faviconUrl = getFaviconUrl(config);
// Use in <link rel="icon" href={faviconUrl} />
```

## API Endpoints

Wire these in your Cloudflare Worker. Handlers: `@ottabase/brand-engine/handlers`.

| Method | Path                          | Description                                                                       |
| ------ | ----------------------------- | --------------------------------------------------------------------------------- |
| GET    | `/api/brand`                  | Get resolved brand config (?organizationId, ?appId, ?brandPreview, ?themeVariant) |
| PUT    | `/api/brand`                  | Update brand settings                                                             |
| POST   | `/api/brand/apply`            | Activate a BrandBox (`{ brandBoxId }`)                                            |
| POST   | `/api/brand/logo/:type`       | Upload logo (types: logo, logo-dark, icon, og-image, email-logo)                  |
| GET    | `/api/brand/layouts`          | List layout templates                                                             |
| PUT    | `/api/brand/layouts`          | Create/update layout template                                                     |
| GET    | `/api/brand/mappings`         | List route mappings                                                               |
| PUT    | `/api/brand/mappings`         | Replace route mappings                                                            |
| GET    | `/api/brand/themes`           | List theme variants                                                               |
| POST   | `/api/brand/themes`           | Create theme variant                                                              |
| PUT    | `/api/brand/themes/:id`       | Update theme variant                                                              |
| DELETE | `/api/brand/themes/:id`       | Delete theme variant                                                              |
| GET    | `/api/brandbox`               | List BrandBoxes                                                                   |
| POST   | `/api/brandbox`               | Create BrandBox                                                                   |
| PUT    | `/api/brandbox/:id`           | Update BrandBox                                                                   |
| DELETE | `/api/brandbox/:id`           | Delete BrandBox                                                                   |
| POST   | `/api/brandbox/:id/duplicate` | Duplicate BrandBox                                                                |

## Creating Layout Components

Layout templates use `componentKey` (homepage, app-shell, docs, minimal). Apps register components via
`@ottabase/brand-engine-react`:

```typescript
import { registerLayoutComponent } from '@ottabase/brand-engine-react';
import type { LayoutConfig } from '@ottabase/brand-engine';

// Your layout receives config from the API
function MyLayout({ config, children }: { config: LayoutConfig; children: React.ReactNode }) {
  return (
    <div>
      <header>{/* use config.header, config.navigation */}</header>
      <main>{children}</main>
    </div>
  );
}

// Register before render (e.g. in app init)
registerLayoutComponent('app-shell', MyLayout);
```

Built-in keys: `homepage`, `app-shell`, `docs`, `minimal`. To add a custom key, extend `LayoutComponentKey` in
`@ottabase/brand-engine/layouts` and register your component.
