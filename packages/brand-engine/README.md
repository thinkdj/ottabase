# @ottabase/brand-engine

Unified theme engine for Ottabase — design tokens, preset template expansion, CSS variable injection, email branding,
and brand persistence via D1.

## Features

- **Design Tokens** — Typed schema for colors, typography, spacing, shadows, motion, cursors — plus the v2 categories
  below for full design-system fidelity
- **Preset Templates** — Theme presets expanded and saved to database (no runtime resolution needed)
- **CSS Runtime** — Inject design tokens as CSS custom properties; auto-load Google Fonts
- **Critical CSS** — Server-rendered dual-mode (light + dark) style tags for zero-FOUC
- **Effects Stylesheet** — Generated `@font-face`/`@keyframes`/text styles/link contract/theme CSS (`#brand-effects`)
- **Email Branding** — Replace `{{brandName}}`, `{{logoUrl}}`, etc. in email HTML
- **Favicon** — Resolve best favicon URL from brand config
- **Built-in Presets** — Default, Neo, Crisp, Funky, Artisan, Midnight, Rose, Verdant, plus two full 1:1 design-system
  ports used as fidelity references: Visited (the90s.page) and Marquee (uppcoming)
- **Fonts & Cursors** — Google Fonts catalog, custom cursor SVG registry

## v2 Token Categories (design-system fidelity)

Two families of categories:

- **Defaulted** (`color`, `typography`, `spacing`, `radius`, `shadow`, `motion`) — engine defaults are merged under
  theme values; their vars are always emitted.
- **Sparse** (everything below) — emitted **only when the theme defines them**. Fallbacks live in the consumers
  (`tailwind.base.cjs` utilities + static rules in `ui-shadcn/styles/shadcn.css`), so a theme that defines none of them
  renders pixel-identical to a pre-v2 app. That is the **fallback-chain law**: every consumer reads
  `var(--specific, var(--global, <today's literal>))`.

| Category      | Shape (in `tokensJson`)                                                     | Emission                                                                      |
| ------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `palette`     | `{ "link": "#2323E8", "glow": "color-mix(in srgb, var(--link) 36%, …)" }`   | `--{name}` **verbatim** — one-knob `color-mix()` ramps live here              |
| `typography`  | open roles: `heading/body/handwriting/mono` + any (`label`, `ticker`, …)    | `--font-{role}`, `--typography-{role}-{weight,line-height,spacing,transform}` |
| `typeScale`   | `{ "sm": { "size": "14px", "lineHeight": "1.55" }, … }`                     | `--text-{step}(-lh/-ls/-weight)` → every Tailwind `text-{step}`               |
| `radius`      | scalar **or** `{ base, sm, md, lg, xl, 2xl, full }`                         | `--radius`, `--radius-{size}` (set `full: 2px` to ban pills)                  |
| `shadow`      | open record: `xs..xl` + named extras (`glow`, …); `"none"` allowed          | `--shadow-{name}`                                                             |
| `border`      | `{ width, widthStrong, style }`                                             | `--border-width(-strong)`, `--border-style`                                   |
| `motion`      | + `easingSpring`, `durations`/`easings` records, `keyframes` (registry: ok) | `--ease-spring`, `--duration-{name}`, `@keyframes` in effects                 |
| `focus`       | `{ width, style, color, offset }`                                           | `--focus-ring-*` → ONE global `:focus-visible` rule                           |
| `interaction` | `{ hoverTransform, hoverFilter, activeTransform, activeShadow, … }`         | `--hover-*` / `--press-*` — press physics on `[data-slot]`                    |
| `links`       | `{ color, hoverColor, visitedColor, activeColor, underline, thickness, … }` | `--link-*` + generated anchor contract (incl. real `:visited`)                |
| `selection`   | `{ background, foreground }`                                                | `::selection` via `--selection-bg/fg`                                         |
| `scrollbar`   | `{ width, thumb, track }` (define thumb+track together)                     | `scrollbar-width/color` on `:root`                                            |
| `native`      | `{ colorScheme: 'auto', accentColor, caretColor, tapHighlight }`            | native controls/scrollbars/autofill follow the theme                          |
| `zIndex`      | `{ header: 40, modal: 50, toast: 100, … }`                                  | `--z-{name}` + Tailwind `z-{name}` utilities                                  |
| `textStyles`  | `{ "kicker": { fontRole, size, tracking, transform, … } }`                  | generated `.ts-{name}` voice classes                                          |
| `fontFaces`   | `[{ family, src, weight: '100 900', stretch, display }]`                    | generated `@font-face` (self-hosted/variable fonts)                           |
| `effects`     | `{ utilities: { fx: 'registry:scanlines' }, css: '…raw theme css…' }`       | generated utility classes + verbatim theme CSS (sanitized)                    |
| `scopes`      | `{ "afterdark": { color: {…}, palette: {…}, focus: {…} } }`                 | `[data-brand-scope="afterdark"] { --vars }` token **rooms**                   |
| `surface`     | `{ backdrop: 'radial-gradient(…)' }`                                        | `--bg-backdrop` body background layer                                         |
| `aliases`     | `{ "brand": "primary" }`                                                    | alias color entries (active in every pipeline)                                |

Notes:

- Every mode-aware category accepts the `{ light, dark }` `ModeValue` split; a flat value applies to both modes.
- `TOKEN_CATEGORY_KEYS` (tokens.ts) is the single source of truth — preset expansion, the legacy adapter and preview all
  iterate it, so **adding a category = type + default + resolver in `resolve-core.ts` + emitter**.
- Resolution is shared: `resolve-core.ts` backs `resolveTheme`, `brandKitToTheme` and `buildPreviewTheme` (previously
  three drifting copies).
- **Three stylesheets**, all edge-injected and client-replaced by id: `#brand-critical` (vars + scope rooms),
  `#brand-effects` (generated rules), `#brand-custom-css` (kit escape hatch). The client applies themes by replacing
  stylesheet text (`applyBrandTheme(light, dark)`) — never inline styles — so `.dark`/scope re-binding is pure CSS
  cascade.

### Component hooks (ui-shadcn)

Injected theme CSS comes after the bundled CSS, so equal-specificity selectors win: every ui-shadcn primitive stamps
`data-slot` (CVA components also stamp `data-variant`/`data-size`), which makes
`[data-slot='button'][data-variant='outline']:hover { … }` the component restyling API. Button/Card also ship an empty
`[data-decor]` span (hidden by default) for shine/ornament layers. For components whose **DOM** must differ, register a
React override: `<BrandComponentsProvider overrides={{ button: UppButton }}>` (Tier-2 escape hatch — prefer CSS).

### Porting a design system (checklist)

See `themes/visited.json` — a complete 1:1 port of "Visited" (the90s.page). Recipe: semantic HSL palettes per room →
`colors` (+ `scopes` for in-page rooms like `afterdark`); brand-knob derivations → `palette` with `color-mix()`; type
ramp → `typeScale`; chrome laws → `radius`/`shadow`/`border`/`focus`/`links`/`selection`/`native`; press feel →
`interaction` (+ `motion.durations`); named voices → `textStyles`; bespoke recipes → `effects.utilities` +
`effects.css`. Anything still missing belongs in kit `customCss` (now edge-injected, zero FOUC) or a Tier-2 component
override.

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

// Custom color overrides are merged; cursors (not in presets) are preserved
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
| GET    | `/api/brand/menu-slots`     | Resolved menu slot assignments (with menus)   |
| GET    | `/api/brand/menu-slots/raw` | Raw slot assignments (admin editing)          |
| PUT    | `/api/brand/menu-slots`     | Replace all slot assignments                  |

### Menu Slot Endpoints

Menu slots map named layout positions (e.g. `header-nav`, `sidebar-nav`) to specific menus with a render type. The
resolved data is also included in the `GET /api/brand` response so clients get everything in one fetch.

**GET /api/brand/menu-slots** — Returns resolved slot assignments grouped by slot name, including full menu + items:

```json
{
    "header-nav": [
        {
            "slotName": "header-nav",
            "menuId": "menu-abc",
            "renderType": "mega",
            "sortOrder": 0,
            "menu": { "id": "menu-abc", "name": "Main Nav", "slug": "main-nav", "type": "mega", "items": [...] }
        }
    ],
    "footer-nav": [...]
}
```

**PUT /api/brand/menu-slots** — Replace all assignments for the app:

```json
{
    "slots": [
        { "slotName": "header-nav", "menuId": "menu-abc", "renderType": "mega", "sortOrder": 0 },
        { "slotName": "sidebar-nav", "menuId": "menu-def", "renderType": "sidebar", "sortOrder": 0 },
        { "slotName": "footer-nav", "menuId": "menu-ghi", "renderType": "footer", "sortOrder": 0 }
    ]
}
```

Valid `renderType` values: `sidebar`, `flyout`, `mega`, `navbar`, `dropdown`, `footer`.

## Architecture

### Package Structure

```
@ottabase/brand-engine        ← tokens, themes, CSS, persistence (menus + brand kits), handlers (no React)
@ottabase/brand-engine-react  ← BrandProvider, LayoutResolver, useBrand()
@ottabase/ottalayout          ← LayoutConfig types, presets, resolver, validators, React slots (pure)
@ottabase/ottamenu            ← Menu types (MenuItemDto), renderers, MenuSlotRenderer (pure)
```

- **brand-engine** owns theme tokens, brand persistence (D1), Menu/MenuItem models, menu slot assignments, and all API
  handlers
- **ottalayout** owns layout types and route resolution (pure — no persistence)
- **ottamenu** owns menu type definitions and React renderers (pure — no persistence)
- **brand-engine-react** wires them together at runtime with `<BrandProvider>` and `<LayoutResolver>`

**Dependency flow**: brand-engine → ottalayout (types), ottamenu (types). No circular dependencies.

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
// User-configured cursors (not in presets) are preserved during expansion

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

- **Single Source of Truth**: Database contains complete theme
- **No Runtime Resolution**: No registry lookups, no theme merging
- **Cursors Preserved**: User-configured cursors persist when switching presets (not in preset templates)
- **Atomic Updates**: What you save = what renders
- **Works in Cloudflare Workers**: No module-level state dependencies
- **Self-Contained Kits**: Each kit independent, no preset dependencies
