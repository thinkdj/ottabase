# @ottabase/ui-base

Base UI styles and utilities for Ottabase applications. This package contains a CSS reset, animations,
and base styles, plus a React provider that wires them up.

## Features

- **CSS Reset**: Modern CSS reset for consistent cross-browser styling
- **Animations**: Reusable animation utilities
- **Base Styles**: Foundation styles for Ottabase applications
- **Framework-Agnostic CSS**: The styles themselves have no React, Mantine, or other framework dependencies and can be imported directly into any project
- **FOUC Prevention & Font Configuration**: The `ProviderUIBase` React component optionally prevents flash-of-unstyled-content and configures font-family CSS variables, cooperating with brand-engine theming when present

Note: while the CSS is framework-agnostic, the package as a whole is not — it declares `react` and `react-dom` as peer dependencies for the `ProviderUIBase` component described below.

## Installation

```bash
npm install @ottabase/ui-base
# or
pnpm add @ottabase/ui-base
```

## Usage

### Use the Provider (Recommended)

```tsx
import { ProviderUIBase } from '@ottabase/ui-base';

function App({ children }) {
    return <ProviderUIBase>{children}</ProviderUIBase>;
}
```

The ProviderUIBase component automatically imports all base styles:

- CSS reset (reset.css)
- Ottabase-specific utilities (ottabase.css)
- Animation utilities (animations.css)

It also handles FOUC (flash-of-unstyled-content) prevention and font family configuration:

- `preventFOUC` / `preventFOUCInsideIframe`: hide content until styles are ready, with separate control over whether that applies inside iframes
- `fontFamilies`: override the primary/heading/monospace font stacks
- `fontVarsFromRoot`: skip setting `--font-heading` on the wrapper when the brand-engine already sets it on `:root` (the primary/body font-family is always applied to the wrapper regardless of this flag)

By default, font families fall back to the brand-engine CSS variables (`--font-body`, `--font-heading`, `--font-mono`) when present, and to static font stacks otherwise, so the provider cooperates with brand-engine theming out of the box.

### Direct Style Import (Alternative)

If you prefer not to use the provider, you can import styles directly:

```tsx
import '@ottabase/ui-base/styles';
```

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
ui-base/
├── src/
│   ├── index.ts         # Main entry point
│   └── ProviderBase.tsx # ProviderUIBase React component
├── styles/
│   ├── index.css      # Main styles aggregator
│   ├── reset.css      # CSS reset
│   ├── ottabase.css   # Ottabase utilities
│   └── animations.css # Animation utilities
└── package.json
```
