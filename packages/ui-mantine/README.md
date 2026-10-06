# @ottabase/ui-mantine

An optional adapter that puts [Mantine](https://mantine.dev) on top of Ottabase's theme state. The template app
(`apps/otta-web`) does not use it: the app ships shadcn/ui on Tailwind and carries no Mantine dependency. Keep this
package when you want Mantine in an app of your own; delete it when you do not. Nothing else in the monorepo depends on
it.

## What is in it

- `ProviderUIMantine`: wires `MantineProvider`, notifications and modals, and takes the colour scheme as a prop, so the
  global `themeAtom` from `@ottabase/state` stays the single source of truth
- Theme presets: `mantineSlate`, `mantineGraphite`, `mantineAzure`, `mantineAurora` and `mantineArtisan`
- `createMantineTheme` and `validateMantineThemeConfig` for a typed theme on top of a preset
- Re-exports of the Mantine components, hooks and types an app usually starts with

## Wiring it into an app

1. Add the adapter, the Mantine packages it expects as peers, and the PostCSS preset Mantine's styles need:

    ```bash
    pnpm add @ottabase/ui-mantine @mantine/core @mantine/hooks @mantine/modals @mantine/notifications @mantine/carousel
    pnpm add -D postcss-preset-mantine
    ```

2. Register the preset in the app's PostCSS config, after Tailwind:

    ```js
    // postcss.config.cjs
    module.exports = {
        plugins: {
            tailwindcss: {},
            autoprefixer: {},
            'postcss-preset-mantine': { autoRem: false },
        },
    };
    ```

3. Mount the provider under `ProviderUIBase` and hand it the global theme. The provider imports Mantine's CSS itself.

    ```tsx
    import { ProviderUIBase } from '@ottabase/ui-base';
    import { MANTINE_DEMO_COLOR_DEFAULT, MANTINE_DEMO_THEME_COLORS, ProviderUIMantine } from '@ottabase/ui-mantine';
    import { useAtomValue } from 'jotai';
    import { themeAtom } from '@/ottabase/state/appState';

    function App({ children }) {
        const theme = useAtomValue(themeAtom);

        return (
            <ProviderUIBase>
                <ProviderUIMantine
                    storagePrefix="ottabase"
                    themeColors={MANTINE_DEMO_THEME_COLORS}
                    primaryColor={MANTINE_DEMO_COLOR_DEFAULT}
                    colorScheme={theme as 'light' | 'dark'}
                >
                    {children}
                </ProviderUIMantine>
            </ProviderUIBase>
        );
    }
    ```

The provider is controlled: it never stores the colour scheme itself. Theme changes go through `themeAtom`, and Mantine
follows. See `packages/state/THEME_SYSTEM.md` for the whole theme system.

## Presets and custom themes

Pass a preset as `themeOverride`, or build on one:

```tsx
import { createMantineTheme, mantineSlate, ProviderUIMantine, type MantineThemeConfig } from '@ottabase/ui-mantine';

const config: MantineThemeConfig = {
    baseTheme: 'mantine-slate',
    primaryColor: 'blue',
    primaryShade: 6,
    components: { Button: { defaultProps: { radius: 'md' } } },
};
const theme = createMantineTheme(config, mantineSlate);

<ProviderUIMantine themeOverride={theme} colorScheme="light">
    {children}
</ProviderUIMantine>;
```

- `mantineSlate`: neutral slate, minimal
- `mantineGraphite`: high-contrast monochrome
- `mantineAzure`: structured blue for dashboards
- `mantineAurora`: violet and blue with premium accents
- `mantineArtisan`: warm, editorial

## Development

```bash
pnpm build        # tsup: src/index.ts, src/provider.ts, src/themeConfig.ts
pnpm dev          # watch
pnpm test         # vitest
pnpm type-check
```

The Mantine packages are dev dependencies here, so the package builds and tests on its own; consumers install them as
peers.

## Structure

```
ui-mantine/
├── src/
│   ├── index.ts         # Entry point: provider, presets, config helpers, re-exports
│   ├── provider.ts      # Provider-only entry (@ottabase/ui-mantine/provider)
│   └── themeConfig.ts   # createMantineTheme, validateMantineThemeConfig
├── provider/
│   └── ProviderUI.tsx   # ProviderUIMantine
└── themes/              # mantine-slate, graphite, azure, aurora, artisan
```
