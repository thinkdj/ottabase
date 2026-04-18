# Ottabase Next.js Homepage Template

Next.js 16 homepage template deployed to Cloudflare Workers via OpenNext. Uses Brand Engine for theming with 8 presets
and live switching, plus an **extensible slot framework** for hot-swappable homepage sections.

> **Monorepo note:** The main Vite app (`otta-web`) drives its brand config from a D1 database, editable via the admin
> UI at `/admin/brand-engine`. This homepage is intentionally **config-first** — no DB, no API call; the preset is set
> in `config/brand.config.ts` and resolved at request time. Both apps use the same underlying `@ottabase/brand-engine`
> presets, so to keep them visually in sync just match `themePreset` here to whatever preset is active in the Vite app.
>
> `@ottabase/homepage-contract` is a separate package for homepage/page payload schemas. It is _not_ the theming layer
> for this app. Theme resolution here is handled directly by `@ottabase/brand-engine` and
> `@ottabase/brand-engine-react`.

## Quick Start

```bash
pnpm install
pnpm dev
# http://localhost:3000
```

## Structure

```text
app/
├── page.tsx                    # Homepage (uses SlotRenderer for each section)
├── about/page.tsx              # About
├── theme-demo/page.tsx         # Live theme switcher
├── homepage-config/page.tsx    # Slot variant config page
├── layout.tsx                  # Root layout (SSR critical CSS)
├── layout-shell.tsx            # Navbar + Footer wrapper (slot-driven)
├── providers.tsx               # Theme providers + HomepageConfigProvider
├── globals.css                 # Global styles
├── not-found.tsx               # 404
├── error.tsx                   # Error boundary
└── loading.tsx                 # Route spinner
components/
├── SlotRenderer.tsx            # Resolves slot → variant component at runtime
├── Navbar.tsx                  # Legacy navbar (still exported for direct use)
├── Footer.tsx                  # Legacy footer
├── Hero.tsx                    # Legacy hero
├── FeatureCard.tsx             # Legacy feature grid
├── CTASection.tsx              # Legacy CTA
├── ThemePresetSwitcher.tsx     # Theme preset picker
├── index.ts                    # Barrel exports
└── variants/                   # ← Slot variant components
    ├── hero/
    │   ├── types.ts            # HeroData contract
    │   ├── HeroCentered.tsx    # Large centred headline (default)
    │   ├── HeroSplit.tsx       # Text left + visual right
    │   └── HeroMinimal.tsx     # Compact headline
    ├── features/
    │   ├── types.ts            # FeaturesData contract
    │   ├── FeaturesGrid.tsx    # Two-column bordered list (default)
    │   ├── FeaturesCards.tsx    # Card layout with hover
    │   └── FeaturesList.tsx    # Vertical stacked list
    ├── cta/
    │   ├── types.ts            # CTAData contract
    │   ├── CTADefault.tsx      # Centred text + buttons (default)
    │   ├── CTABanner.tsx       # Full-width coloured banner
    │   └── CTAMinimal.tsx      # Compact inline
    ├── navbar/
    │   ├── types.ts            # NavbarData contract
    │   ├── NavbarDefault.tsx   # Logo left, links right (default)
    │   ├── NavbarCentered.tsx  # Centred links
    │   └── NavbarMinimal.tsx   # Logo + dark-mode only
    └── footer/
        ├── types.ts            # FooterData contract
        ├── FooterDefault.tsx   # Copyright + links row (default)
        ├── FooterMinimal.tsx   # Single-line copyright
        └── FooterColumns.tsx   # Multi-column with grouped links
lib/
├── brand-server.ts             # Server-side brand/theme utilities
├── homepage-config.ts          # Slot registry, types, localStorage persistence
└── homepage-config-context.tsx # React context + useHomepageConfig() hook
config/
└── brand.config.ts             # Theme preset + brand overrides
__tests__/                      # Vitest test suite (77 tests)
```

## Slot Framework

The homepage is built around an extensible **slot framework** that separates data from rendering. Each section of the
page (hero, features, CTA, navbar, footer) is a **slot** with multiple **variant** components. All variants for a slot
accept the same data props — you write your content data once and switch the visual presentation via config.

### Architecture

```text
                                ┌──────────────────────┐
   lib/homepage-config.ts ─────▶│    SLOT_REGISTRY     │
   (slot definitions,           │  navbar: 3 variants  │
    variant metadata,           │  hero:   3 variants  │
    localStorage persist)       │  features: 3 variants│
                                │  cta:    3 variants  │
                                │  footer: 3 variants  │
                                └──────────┬───────────┘
                                           │
   lib/homepage-config-context.tsx ────────▶│ React Context
   (useHomepageConfig hook)                │ (config state + setVariant)
                                           │
                                ┌──────────▼───────────┐
   components/SlotRenderer.tsx ▶│   VARIANT_COMPONENTS │
   (<SlotRenderer slot="hero"   │  Maps slot+variantId │
    data={heroData} />)         │  → React component   │
                                └──────────────────────┘
```

### How to use

```tsx
// In page.tsx — data is defined once, rendering driven by config
const HERO_DATA = {
    title: 'Welcome',
    subtitle: 'Build fast.',
    actions: [{ href: '/docs', label: 'Get Started' }],
};

export default function HomePage() {
    return <SlotRenderer slot="hero" data={HERO_DATA} />;
}
```

### Config page

Visit `/homepage-config` to switch variant for each slot. Changes are saved to `localStorage` and applied instantly — no
page reload needed. A "Reset to defaults" button restores the original configuration.

### Data Type Safety

**Each slot enforces its canonical data contract at compile time** via TypeScript discriminated unions. Passing
incorrect data to a slot will fail at type-check:

```tsx
// ✅ Correct: HeroData is required for slot="hero"
<SlotRenderer slot="hero" data={{ title: 'Welcome', subtitle: 'Build fast.' }} />

// ❌ Type error: FeaturesData is not compatible with slot="hero"
<SlotRenderer slot="hero" data={{ features: [...] }} />
```

### Rendering modes: Live switching vs. SSR-safe

`SlotRenderer` has two modes to balance live config switching with SSR performance:

#### 1. `SlotRenderer` (default) – Live switching, client component

Uses React context to fetch the user's variant selection from `localStorage` in real time. Enables the config page
(`/homepage-config`) to instantly switch variants without page reload.

**Tradeoff:** Pages using `SlotRenderer` must be marked `'use client'`, which means their initial render is client-side
(no SSR benefit for that route).

```tsx
'use client';
import { SlotRenderer } from '@/components';

export default function HomePage() {
    return <SlotRenderer slot="hero" data={HERO_DATA} />;
}
```

#### 2. `SlotRendererStatic` – SSR-safe, no context needed

Accepts an explicit `variantId` prop instead of reading from context. Allows pages to remain Server Components and be
fully SSR'd.

**Tradeoff:** Pages using `SlotRendererStatic` will always render the specified variant ID (usually the default) and
will NOT reflect live config changes from `/homepage-config`.

```tsx
// app/page.tsx (remains a Server Component)
import { SlotRendererStatic, SLOT_REGISTRY } from '@/components';

export default function HomePage() {
    const heroVariant = SLOT_REGISTRY.hero.defaultVariant;
    return <SlotRendererStatic slot="hero" variantId={heroVariant} data={HERO_DATA} />;
}
```

**Recommendation:** Use `SlotRenderer` (live) for the homepage where variant switching is a feature. Use
`SlotRendererStatic` (SSR-safe) for content pages that don't need live config and benefit from server rendering.

### Adding a new variant

1. Create a component in `components/variants/<slot>/` that accepts the slot's data type:

```tsx
// components/variants/hero/HeroGradient.tsx
import type { HeroData } from './types';

export function HeroGradient({ title, subtitle, actions }: HeroData) {
    return <section>/* your markup */</section>;
}
```

2. Register it in `components/SlotRenderer.tsx` (`VARIANT_COMPONENTS`):

```tsx
hero: {
    centered: HeroCentered,
    split: HeroSplit,
    minimal: HeroMinimal,
    gradient: HeroGradient,  // ← add here
},
```

3. Add metadata to `lib/homepage-config.ts` (`SLOT_REGISTRY`):

```tsx
hero: {
    variants: [
        // ...existing...
        { id: 'gradient', label: 'Gradient', description: 'Bold gradient background hero.' },
    ],
},
```

The new variant immediately appears in the config page and can be selected.

## Brand Engine Integration

This app is fully wired to `@ottabase/brand-engine` for SSR-safe theming without a database or API call.

`@ottabase/homepage-contract` is adjacent to this architecture, not part of the theme runtime. Use it for validating
homepage or page payloads; use brand-engine for tokens, CSS variables, and `BrandProvider`-driven theme behavior.

### How it works (end-to-end)

```
config/brand.config.ts          ← 1. Define your preset name + optional overrides
        ↓
lib/brand-server.ts             ← 2. Server resolves light + dark themes at request time
        ↓
app/layout.tsx (Server Component)
  - generateBrandConfig()       ← 3. Builds FullBrandConfig (both color modes)
  - buildCriticalCSS(theme)     ← 4. Injects CSS variables into <head> (prevents FOUC)
  - font <link> tags            ← 5. Loads preset fonts (only if the theme defines URLs)
        ↓
app/providers.tsx (Client Component)
  - BrandProvider               ← 6. Makes brand config available via useBrand()
  - ThemeProvider (next-themes) ← 7. Manages light/dark class on <html>
  - MutationObserver            ← 8. Watches dark class changes → calls applyBrandTheme()
  - localStorage restore        ← 9. Restores a user-saved preset on hydration
```

### Customising the brand

Edit `config/brand.config.ts`:

```typescript
import type { BrandTheme } from '@ottabase/brand-engine';

// Pick one of the 8 built-in presets
export const themePreset = 'crisp'; // default | neo | crisp | funky | artisan | midnight | rose | verdant

// Optionally override individual tokens — merged on top of the preset
export const brandConfig: Partial<BrandTheme> = {
    name: 'my-brand',
    // primaryColor, fontHeading, spacing, etc.
};
```

Changes take effect on the next server render — no migration or API call needed.

### Live preset switching

`ThemePresetSwitcher` (`components/ThemePresetSwitcher.tsx`) applies a new preset instantly via `applyBrandTheme()` and
persists the choice to `localStorage` (`ottabase.homepage.theme-preset`). On the next page load `providers.tsx` reads
this key and re-applies the preset before paint.

Visit `/theme-demo` to try all 8 presets live.

### Dark mode

`next-themes` adds/removes the `dark` class on `<html>`. `providers.tsx` observes that class and calls
`applyBrandTheme()` with the correct `darkTheme` or `theme` from the resolved brand config, so CSS variables flip
instantly without a full render.

## Scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `pnpm dev`           | Dev server                           |
| `pnpm build`         | Production Next.js build             |
| `pnpm build:worker`  | Build OpenNext Cloudflare worker     |
| `pnpm start`         | Start production server locally      |
| `pnpm preview`       | Build + run on local `workerd`       |
| `pnpm deploy`        | Build + deploy to Cloudflare Workers |
| `pnpm lint`          | ESLint                               |
| `pnpm type-check`    | TypeScript validation                |
| `pnpm test`          | Run tests                            |
| `pnpm test:coverage` | Run tests with coverage              |

## Deployment

```bash
pnpm deploy
```

CI/CD is handled by the shared `.github/workflows/deploy.yml` — deploys on push to `main` with smart change detection
(only re-deploys when this app or shared packages change).

**Config-driven - no yml editing needed when renaming the app:**

1. Update `cloudflare-config.json` `workerName` and `wrangler.jsonc` `name` to match your new app name.
2. Set the `APPS_TO_DEPLOY` GitHub secret to a comma-separated list of app folder names, e.g. `main-app,homepage-app`.
3. Set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` GitHub secrets.

The workflow reads `cloudflare-config.json` from each app folder to determine app type (`nextjs`), build commands,
output paths and wrangler config — no hardcoded names in yml.
