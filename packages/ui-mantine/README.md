# @ottabase/ui-mantine

Mantine UI components and providers for Ottabase applications. This package provides a comprehensive Mantine integration
with pre-built themes and configuration utilities.

## Features

- **ProviderUIMantine**: Main UI provider that wires Mantine, notifications, and modal support
- **Pre-built Themes**: Slate, Graphite, Azure, and Aurora presets
- **Theme Management**: Syncs with global theme state (themeAtom from @ottabase/state)
- **Theme Configuration**: Utilities for creating and validating custom themes

This is an optional adapter. `@ottabase/ui` is the default UI kit; mount Mantine only on the routes that use it
(otta-web wraps `/demo/mantine` in its own layout so nothing else pays for it).

## Installation

```bash
pnpm add @ottabase/ui-mantine @mantine/core @mantine/hooks @mantine/modals @mantine/notifications @mantine/carousel
```

Mantine's component CSS ships precompiled and the provider imports it. Add
[`postcss-preset-mantine`](https://mantine.dev/styles/postcss-preset/) to the app's PostCSS config only if the app
writes its own CSS with Mantine's mixins and functions (`rem()`, `light-dark()`, `@mixin smaller-than`).

## Usage

### Basic Setup

**Important:** The theme (light/dark mode) is controlled by the global `themeAtom` from `@ottabase/state`. You must pass
the theme value to this provider's `colorScheme` prop to keep it in sync.

```tsx
import { ProviderUIMantine, MANTINE_DEMO_THEME_COLORS, MANTINE_DEMO_COLOR_DEFAULT } from '@ottabase/ui-mantine';
import { useAtomValue } from 'jotai';
import { themeAtom } from '@/ottabase/state/appGlobalState'; // Adjust path as needed

function App({ children }) {
    const theme = useAtomValue(themeAtom);

    return (
        <ProviderUIMantine
            storagePrefix="ottabase"
            themeColors={MANTINE_DEMO_THEME_COLORS}
            primaryColor={MANTINE_DEMO_COLOR_DEFAULT}
            // Pass the global theme to the provider
            colorScheme={theme as 'light' | 'dark'}
        >
            {children}
        </ProviderUIMantine>
    );
}
```

### Syncing with Global State

This provider is a **controlled component**. It does not manage the theme state itself. Instead, you must provide the
current theme via the `colorScheme` prop. This ensures that Mantine is always in sync with your application's single
source of truth for theme state (e.g., a Jotai atom); no separate sync component is needed.

### Using Pre-built Themes

```tsx
import { ProviderUIMantine, mantineSlate, mantineGraphite, mantineAzure, mantineAurora } from '@ottabase/ui-mantine';
import { useAtomValue } from 'jotai';
import { themeAtom } from '@/ottabase/state/appGlobalState';

function App({ children }) {
    const theme = useAtomValue(themeAtom);

    return (
        <ProviderUIMantine themeOverride={mantineSlate} colorScheme={theme as 'light' | 'dark'}>
            {children}
        </ProviderUIMantine>
    );
}
```

### Creating Custom Themes

```tsx
import { ProviderUIMantine, createMantineTheme, mantineSlate, type MantineThemeConfig } from '@ottabase/ui-mantine';
import { useAtomValue } from 'jotai';
import { themeAtom } from '@/ottabase/state/appGlobalState';

const myThemeConfig: MantineThemeConfig = {
    baseTheme: 'mantine-slate',
    primaryColor: 'blue',
    primaryShade: 6,
    colors: {
        brand: [
            '#f0f9ff',
            '#e0f2fe',
            '#bae6fd',
            '#7dd3fc',
            '#38bdf8',
            '#0ea5e9',
            '#0284c7',
            '#0369a1',
            '#075985',
            '#0c4a6e',
        ],
    },
    components: {
        Button: {
            defaultProps: {
                radius: 'md',
            },
        },
    },
};

const customTheme = createMantineTheme(myThemeConfig, mantineSlate);

function App({ children }) {
    const theme = useAtomValue(themeAtom);

    return (
        <ProviderUIMantine themeOverride={customTheme} colorScheme={theme as 'light' | 'dark'}>
            {children}
        </ProviderUIMantine>
    );
}
```

## Available Themes

- **mantineSlate**: Neutral slate theme with minimal UI patterns
- **mantineGraphite**: High-contrast monochrome theme
- **mantineAzure**: Structured blue theme for dashboards
- **mantineAurora**: Luminous violet/blue theme with premium accents

## Theme System Architecture

This package is part of Ottabase's centralized theme system:

- **Global State**: Theme is stored in `themeAtom` (from @ottabase/state) with automatic localStorage persistence
- **Single Source of Truth**: All UI frameworks sync with global state
- **One-Way Sync**: Mantine reads from global state, theme changes go through global state

See `THEME_ARCHITECTURE.md` in your app for the complete theme system documentation.

## Dependencies

This package requires the following peer dependencies:

- `react` >= 18.0.0
- `react-dom` >= 18.0.0
- `@mantine/core` ^8.3.1
- `@mantine/hooks` ^8.3.1
- `@mantine/modals` ^8.3.1
- `@mantine/notifications` ^8.3.1
- `@mantine/carousel` ^8.3.1

The examples read the theme from `@ottabase/state`'s `themeAtom`, but the provider is controlled: pass `colorScheme`
from whatever holds your app's theme.

## Development

```bash
# Build the package
pnpm build

# Watch for changes
pnpm dev

# Clean build artifacts
pnpm clean
```

## Package Structure

```
ui-mantine/
├── src/
│   ├── index.ts         # Main entry point
│   └── themeConfig.ts   # Theme configuration utilities
├── provider/
│   └── ProviderUIMantine.tsx   # Mantine provider component
├── themes/
│   ├── mantine-slate.ts
│   ├── mantine-graphite.ts
│   ├── mantine-azure.ts
│   └── mantine-aurora.ts
└── package.json
```
