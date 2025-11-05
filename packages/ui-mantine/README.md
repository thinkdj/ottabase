# @ottabase/ui-mantine

Mantine UI components and providers for Ottabase applications. This package provides a comprehensive Mantine integration with pre-built themes and configuration utilities.

## Features

- **ProviderUIMantine**: Main UI provider that wires Mantine, notifications, and modal support
- **Pre-built Themes**: ShadCN, Vercel, Ant Design, and Stripe-inspired themes
- **Theme Management**: Syncs with global theme state (themeAtom from @ottabase/state)
- **Theme Configuration**: Utilities for creating and validating custom themes
- **FOUC Prevention**: Flash of unstyled content prevention helpers

## Installation

```bash
npm install @ottabase/ui-mantine @ottabase/ui-base @ottabase/state
# or
pnpm add @ottabase/ui-mantine @ottabase/ui-base @ottabase/state
```

## Usage

### Basic Setup

**Important:** The theme (light/dark mode) is controlled by the global `themeAtom` from `@ottabase/state`. You must pass the theme value to this provider's `colorScheme` prop to keep it in sync.

```tsx
import { ProviderUIMantineBase } from '@ottabase/ui-base';
import { ProviderUIMantine } from '@ottabase/ui-mantine';
import { useAtomValue } from 'jotai';
import { themeAtom } from '@/ottabase/state/appGlobalState'; // Adjust path as needed

function App({ children }) {
  const theme = useAtomValue(themeAtom);

  return (
    <ProviderUIMantineBase>
      <ProviderUIMantine
        storagePrefix="ottabase"
        themeColors={THEME_COLORS}
        primaryColor="blue"
        // Pass the global theme to the provider
        colorScheme={theme as 'light' | 'dark'}
      >
        {children}
      </ProviderUIMantine>
    </ProviderUIMantineBase>
  );
}
```

### Syncing with Global State

This provider is a **controlled component**. It does not manage the theme state itself. Instead, you must provide the current theme via the `colorScheme` prop. This ensures that Mantine is always in sync with your application's single source of truth for theme state (e.g., a Jotai atom). The `MantineThemeSync` component is no longer needed.

### Using Pre-built Themes

```tsx
import { ProviderUIMantineBase } from '@ottabase/ui-base';
import {
  ProviderUIMantine,
  mantineShadcn,
  mantineVercel,
  mantineAnt,
  mantineStripe
} from '@ottabase/ui-mantine';

function App({ children }) {
  return (
    <ProviderUIMantineBase>
      <ProviderUIMantine themeOverride={mantineShadcn}>
        <MantineThemeSync />
        {children}
      </ProviderUIMantine>
    </ProviderUIMantineBase>
  );
}
```

### Creating Custom Themes

```tsx
import { ProviderUIMantineBase } from '@ottabase/ui-base';
import {
  ProviderUIMantine,
  createMantineTheme,
  mantineShadcn,
  type MantineThemeConfig
} from '@ottabase/ui-mantine';

const myThemeConfig: MantineThemeConfig = {
  baseTheme: "mantine-shadcn",
  primaryColor: "blue",
  primaryShade: 6,
  colors: {
    brand: [
      "#f0f9ff",
      "#e0f2fe",
      "#bae6fd",
      "#7dd3fc",
      "#38bdf8",
      "#0ea5e9",
      "#0284c7",
      "#0369a1",
      "#075985",
      "#0c4a6e",
    ],
  },
  components: {
    Button: {
      defaultProps: {
        radius: "md",
      },
    },
  },
};

const customTheme = createMantineTheme(myThemeConfig, mantineShadcn);

function App({ children }) {
  return (
    <ProviderUIMantineBase>
      <ProviderUIMantine themeOverride={customTheme}>
        <MantineThemeSync />
        {children}
      </ProviderUIMantine>
    </ProviderUIMantineBase>
  );
}
```

## Available Themes

- **mantineShadcn**: ShadCN/UI inspired theme with neutral slate colors
- **mantineVercel**: Vercel-inspired clean and modern theme
- **mantineAnt**: Ant Design inspired theme
- **mantineStripe**: Stripe-inspired professional theme

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

**Note:** This package requires `@ottabase/ui-base` and `@ottabase/state` to be installed.

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
│   ├── mantine-shadcn.ts
│   ├── mantine-vercel.ts
│   ├── mantine-ant.ts
│   └── mantine-stripe.ts
└── package.json
```
