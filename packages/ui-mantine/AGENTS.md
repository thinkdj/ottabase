# @ottabase/ui-mantine — agent notes

Mantine v8 provider, prebuilt theme presets, and theme-config utilities for Ottabase apps. Full docs: ./README.md

## Use when

- Wiring Mantine (MantineProvider + notifications + modals) into an Ottabase React app.
- Picking a theme preset or building a custom Mantine theme from a `MantineThemeConfig`.
- NOT for apps without Mantine; theme (light/dark) state lives in `@ottabase/state` (`themeAtom`), not here.

## Imports

```ts
import {
    ProviderUIMantine,
    createMantineTheme, // (config: MantineThemeConfig, base: MantineThemeOverride) => MantineThemeOverride
    validateMantineThemeConfig, // (config) => string[] errors, [] = valid
    MANTINE_DEMO_THEME_COLORS, MANTINE_DEMO_COLOR_DEFAULT,
    mantineSlate, mantineGraphite, mantineAzure, mantineAurora, mantineArtisan,
    type ThemeColors, type MantineThemePreset, type MantineThemeConfig,
} from '@ottabase/ui-mantine';
import { ProviderUIMantine } from '@ottabase/ui-mantine/provider'; // lighter entry (provider + types only)
```

Root also re-exports common Mantine components (`Button`, `Card`, ...), hooks (`useDisclosure`, ...), and types (`MantineTheme`, `MantineColorScheme`, ...).

## Canonical usage

```tsx
const theme = useAtomValue(themeAtom); // from @ottabase/state — provider is controlled
<ProviderUIBase>
    <ProviderUIMantine baseTheme='mantine-slate' primaryColor='blue' colorScheme={theme as 'light' | 'dark'}>
        {children}
    </ProviderUIMantine>
</ProviderUIBase>;
// Custom theme: <ProviderUIMantine themeOverride={createMantineTheme(config, mantineSlate)} ... />
```

## Gotchas

- Controlled component: pass `colorScheme` from `themeAtom` yourself; it does not manage or persist theme state.
- Requires `@ottabase/ui-base` (wrap in `ProviderUIBase`) and `@ottabase/state`, but neither is in peerDependencies.
- Only `.` and `./provider` subpaths exist in the exports map; import themeConfig utilities from the root.
- `themeOverride` replaces the base theme entirely (baseTheme/themeColors/primaryColor/scale are ignored).
- `mantineArtisan` preset exists but is absent from the README.
- Provider imports Mantine CSS (core, notifications, carousel) and is `'use client'` — client-side only.
