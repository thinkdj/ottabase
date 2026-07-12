# otta-landing — agent notes

Next.js 16 marketing/landing site with slot-based homepage sections, deployed to Cloudflare Workers via OpenNext. Full docs: ./README.md

## Use when

- Editing the public landing/homepage: hero/features/cta/navbar/footer/about slot variants, theme presets, or the Cloudflare deploy pipeline.
- NOT for the main product app (`otta-web`) or DB-driven brand config — theming here is config-first via `config/brand.config.ts`, no DB/API.

## Imports

Private app (no exports map); paths are app-internal:

```ts
import { SlotRenderer } from '../components/SlotRenderer';
import { SLOT_REGISTRY, SLOT_NAMES, getDefaultConfig, loadConfig, saveConfig } from '../lib/homepage-config';
import { useHomepageConfig } from '../lib/homepage-config-context';
import { generateBrandConfig } from '../lib/brand-server';
import { brandConfig, themePreset } from '../config/brand.config';
```

Barrel `components/index.ts` also exports `ConfigPanel`, `CTASection`, `FeatureItem`, `FeaturesGrid`, `Footer`, `Hero`, `Navbar`, `SlotRendererStatic`, `VARIANT_COMPONENTS`, `ThemePresetSwitcher`, `THEME_STORAGE_KEY`.

## Canonical usage

Render a section — data is defined once, active variant decides presentation (client component):

```tsx
'use client';
import { SlotRenderer } from '../components/SlotRenderer';

<SlotRenderer slot="hero" data={heroData} />; // heroData must be HeroData (variants/hero/types)
```

Change the theme preset (SSR-applied via `generateBrandConfig`):

```ts
// config/brand.config.ts
export const brandConfig: Partial<BrandTheme> = { name: 'artisan' };
export const themePreset = 'crisp'; // default | neo | crisp | funky | artisan | midnight | rose | verdant
```

Add a variant to a slot: create `components/variants/<slot>/MyVariant.tsx` matching the slot's `types.ts` data contract, export from the slot's `index.ts`, register in `VARIANT_COMPONENTS` (components/SlotRenderer.tsx) and `SLOT_REGISTRY` (lib/homepage-config.ts) under the same id.

Deploy (two builds — Next then OpenNext):

```sh
pnpm build && pnpm build:worker && wrangler deploy   # = pnpm deploy
```

## Gotchas

- Config-first theming: preset lives in `config/brand.config.ts`; keep `themePreset` in sync with otta-web. `@ottabase/brand-engine(-react)` is the theming layer here — not a homepage-contract package.
- `build:worker` runs `opennextjs-cloudflare build --skipBuild`; it needs `next build --webpack` first (webpack flag is deliberate).
- Slot selection persists in localStorage (`ottabase.homepage.slots-config`); `loadConfig()` validates variant ids and falls back to `SLOT_REGISTRY` defaults. Legacy components (`Hero`, `Navbar`, `Footer`, `CTASection`) are still exported but the slot system is canonical.
- Saved theme preset in localStorage (`THEME_STORAGE_KEY`) overrides the SSR default on the client (see `app/providers.tsx`).
- Edge runtime: no Node-only APIs. Internal deps use `workspace:*`; shared externals use `catalog:`.
