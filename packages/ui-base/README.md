# @ottabase/ui-base

Base UI styles and utilities for Ottabase applications. This package contains framework-agnostic CSS reset, animations, and base styles.

## Features

- **CSS Reset**: Modern CSS reset for consistent cross-browser styling
- **Animations**: Reusable animation utilities
- **Base Styles**: Foundation styles for Ottabase applications
- **Framework-Agnostic**: No React, Mantine, or other framework dependencies

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
  return (
    <ProviderUIBase>
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
│   └── styles.ts      # Style exports
├── styles/
│   ├── index.css      # Main styles aggregator
│   ├── reset.css      # CSS reset
│   ├── ottabase.css   # Ottabase utilities
│   └── animations.css # Animation utilities
└── package.json
```
