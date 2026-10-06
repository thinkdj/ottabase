# @ottabase/ui-base

Base UI styles and utilities for Ottabase applications. This package contains framework-agnostic CSS reset, animations,
and base styles.

## Features

- **CSS Reset**: Modern CSS reset for consistent cross-browser styling
- **Animations**: Reusable animation utilities
- **Base Styles**: Foundation styles for Ottabase applications
- **CSS first**: the stylesheets need no framework; `ProviderUIBase` is a thin React wrapper that sets the font
  variables

## Installation

```bash
pnpm add @ottabase/ui-base
```

## Usage

### Use the Provider (Recommended)

```tsx
import { ProviderUIBase } from '@ottabase/ui-base';

function App({ children }) {
    // fontFamilies is optional: primary, heading and monospace stacks, else the built-in defaults
    return (
        <ProviderUIBase fontFamilies={{ primary: 'Inter', heading: 'Work Sans', monospace: 'JetBrains Mono' }}>
            {children}
        </ProviderUIBase>
    );
}
```

The ProviderUIBase component automatically imports all base styles:

- CSS reset (reset.css)
- Ottabase-specific utilities (ottabase.css)
- Animation utilities (animations.css)

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
│   ├── index.ts       # Main entry point
│   └── ProviderBase.tsx  # ProviderUIBase (font variables, base styles import)
├── styles/
│   ├── index.css      # Main styles aggregator
│   ├── reset.css      # CSS reset
│   ├── ottabase.css   # Ottabase utilities
│   └── animations.css # Animation utilities
└── package.json
```
