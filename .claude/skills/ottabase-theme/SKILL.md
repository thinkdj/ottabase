---
name: ottabase-theme
description:
    The Ottabase way to theme an app — Brand Engine design tokens → CSS variables, brand kits, per-route overrides, dark
    mode. Use for "change the theme", "brand colors", "design tokens", "white-label", "tenant branding", "dark mode",
    "customize a component's look". Encodes the token contract and where a running app's brand actually lives.
---

# Theming the Ottabase way (Brand Engine)

`@ottabase/brand-engine` is **core — always enabled** (not a toggleable package). Theming is token-driven: a
`DesignTokens` object becomes CSS custom properties written into a single `<style>` block; dark mode is a pure CSS
`html.dark` swap.

## Tokens are the contract

`DesignTokens` (`brand-engine/src/tokens.ts`) — `color` is the only required category; the other 22 are optional
(`typography`, `spacing`, `radius`, `shadow`, `motion`, `focus`, `interaction`, `links`, `zIndex`, `scopes`, `surface`,
…). Read with a typed dot-path:

```ts
import { getToken, createTokenAccessor } from '@ottabase/brand-engine';
getToken(tokens, 'color.light.primary'); // typed path, undefined if missing
```

Tokens emit as CSS vars: `--primary`, `--radius` / `--radius-{size}`, `--shadow-{level}`, `--text-{step}`,
`--focus-ring-*`, `--hover-*` / `--press-*`, `--z-{name}`, etc. **Note: unprefixed** (shadcn/Tailwind convention), not
`--otta-*`. Prefer these vars over hardcoded colors/sizes — that's what makes white-label, dark mode, and tenant
branding work.

## Where a brand lives

- **Static presets**: `brand-engine/src/presets.ts` (`PRESET_MAP` from `themes/*.json`: default, neo, crisp, midnight,
  rose, …).
- **A running app's brand kits are DB rows** (`brandKitsTable`, app-scoped), seeded by `ensureAppBrandDefaults()` →
  `BrandKit.getOrCreateDefault()`; edited through the admin brand API, not code.

## Applying & overriding

- Wrap the app in `<BrandProvider apiEndpoint="/api/brand" appId={…} initialConfig={…}>`
  (`@ottabase/brand-engine-react`). It resolves the path-scoped theme and `applyBrandTheme()` writes the critical CSS.
- **Per-route override**: a `RouteMapping.tokenOverridesJson` (JSON, `deepMerge`d onto the kit; malformed JSON silently
  falls back).
- **Per-subtree override**: `<BrandScope name="…">` re-binds `scopes.{name}` vars for a subtree (e.g. an always-dark
  hero) without `dark:` classes.
- **Per-component look**: target `[data-slot="…"]` in theme CSS (Tier 1); see `ottabase-component` for replacing a
  component's DOM (Tier 2).

## Gotchas

- SSR is designed here: the edge injects the resolved config + critical CSS and the client reuses it (`initialConfig`)
  to avoid a flash — keep the edge/client resolution in parity, it's a tested contract. Don't `window.location.reload()`
  to apply a theme.
- Cursors live at the `tokensJson` root, not inside `DesignTokens`.

## Authoritative sources

`packages/brand-engine/README.md`, `brand-engine/src/{tokens,accessors,emit-vars,presets}.ts`,
`brand-engine-react/src/BrandProvider.tsx`. Full docs: `/llms-full.txt`.
