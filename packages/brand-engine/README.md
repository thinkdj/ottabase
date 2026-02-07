# @ottabase/brand-engine

The unified theme engine for Ottabase applications. This package provides the core logic and types for the design
system, including design tokens, theme resolution, and CSS variable management.

## Features

- **Design Tokens**: Typed schema for colors, typography, spacing, shadows, and motion.
- **Theme Resolution**: Logic to merge user overrides with default themes.
- **CSS Runtime**: Utilities to inject design tokens as CSS variables into the DOM.
- **Color Utilities**: Helpers for contrast calculation and palette generation.
- **Strict Accessors**: Type-safe methods to retrieve tokens.

## Usage

### Token Access

```typescript
import { getToken, DEFAULT_COLORS_LIGHT } from '@ottabase/brand-engine';

const primaryColor = getToken(DEFAULT_COLORS_LIGHT, 'colors.primary.500');
```

### Color Utilities

```typescript
import { calculateContrastRatio, generatePalette } from '@ottabase/brand-engine';

// Generate a 50-950 palette from a base color
const bluePalette = generatePalette(222, 47, 11); // HSL

// Check contrast
const ratio = calculateContrastRatio('#ffffff', '#000000'); // 21
```

### Creating a Theme

```typescript
import { BrandTheme } from '@ottabase/brand-engine';

const myTheme: BrandTheme = {
    name: 'my-theme',
    tokens: {
        // ... overrides
    },
    layout: {
        header: 'topbar',
        navigation: 'sidebar',
        contentWidth: 'fluid',
    },
};
```

### Theme Resolution & Registry

```typescript
import { registerTheme, resolveTheme, injectCSSVars } from '@ottabase/brand-engine';

// 1. Register available themes
registerTheme(myTheme);

// 2. Resolve a theme by name (merges with defaults)
const activeTheme = resolveTheme('my-theme');

// 3. Inject into DOM
injectCSSVars(activeTheme);
```
