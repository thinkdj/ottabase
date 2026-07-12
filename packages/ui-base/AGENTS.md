# @ottabase/ui-base — agent notes

Base CSS (reset, ottabase utilities, animations) + React FOUC/font provider. Full docs: ./README.md

## Use when
- Bootstrapping an app's styling foundation: base CSS + `ProviderUIBase` at the tree root (sole consumer: apps/otta-web). Add via `workspace:*`.
- NOT for components or theming — no widgets, only reset/animation CSS and one provider.

## Imports
    import { ProviderUIBase, type ProviderUIBaseFontFamilies } from '@ottabase/ui-base';
    import '@ottabase/ui-base/styles'; // reset.css + ottabase.css + animations.css (individually via /styles/*)

## Canonical usage
    <ProviderUIBase preventFOUC fontFamilies={{ primary, heading, monospace }} fontVarsFromRoot>{children}</ProviderUIBase>

## Gotchas
- `ProviderUIBase` already imports styles/index.css; a separate `/styles` import is redundant with it.
- `fontFamilies` keys are `primary`/`heading`/`monospace` — other keys (e.g. `sans`, `mono`) are silently ignored.
- `preventFOUC` renders children `visibility: hidden`; skipped inside iframes unless `preventFOUCInsideIframe`.
- `fontVarsFromRoot` skips `--font-heading` on the wrapper so Brand Engine sets fonts on `:root` (still sets `--font-monospace`).
