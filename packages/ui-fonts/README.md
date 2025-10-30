# @ottabase/ui-fonts

Centralized font management for Ottabase applications. This package provides type-safe font configuration, CSS custom properties, and pre-configured Google Fonts for consistent typography across your application.

## Features

- 🎨 **Pre-configured Google Fonts** - Inter, Work Sans, JetBrains Mono, Patrick Hand, Geist, and more
- 🔒 **Type-safe** - Full TypeScript support with comprehensive type definitions
- 🎯 **CSS Custom Properties** - Easy theme integration with CSS variables
- ⚡ **Performance** - Optimized font loading with Next.js font optimization
- 🔧 **Flexible** - Use defaults or create custom configurations
- 📦 **Zero Config** - Works out of the box with sensible defaults

## Installation

This package is part of the Ottabase monorepo and is automatically available to all apps.

```bash
pnpm add @ottabase/ui-fonts
```

## Quick Start

### 1. Basic Usage

Wrap your application with `ProviderFont`:

```tsx
import { ProviderFont, defaultFontsConfig } from '@ottabase/ui-fonts';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ProviderFont fonts={defaultFontsConfig}>
          {children}
        </ProviderFont>
      </body>
    </html>
  );
}
```

### 2. Extract Font Families for Theme Integration

```tsx
import { extractFontFamilies, defaultFontsConfig } from '@ottabase/ui-fonts';

const fontFamilies = extractFontFamilies(defaultFontsConfig);

// Use in Mantine theme
<MantineProvider theme={{
  fontFamily: fontFamilies.primary,
  headings: { fontFamily: fontFamilies.heading },
  fontFamilyMonospace: fontFamilies.monospace,
}}>
  {children}
</MantineProvider>

// Use in Tailwind config
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-family-primary)'],
        heading: ['var(--font-family-heading)'],
        mono: ['var(--font-family-monospace)'],
      },
    },
  },
};
```

## Font Configurations

### Default Configuration

Uses Inter (primary), Work Sans (heading), JetBrains Mono (monospace), and Patrick Hand (handwriting):

```tsx
import { defaultFontsConfig } from '@ottabase/ui-fonts';

<ProviderFont fonts={defaultFontsConfig}>
  {children}
</ProviderFont>
```

### Vercel-Style Configuration

Uses Geist fonts for a Vercel-like aesthetic:

```tsx
import { vercelFontsConfig } from '@ottabase/ui-fonts';

<ProviderFont fonts={vercelFontsConfig}>
  {children}
</ProviderFont>
```

### System Fonts Configuration

Uses system fonts for maximum performance (no external font loading):

```tsx
import { systemFontsConfig } from '@ottabase/ui-fonts';

<ProviderFont fonts={systemFontsConfig}>
  {children}
</ProviderFont>
```

## Custom Font Configuration

Create your own font configuration:

```tsx
import { Roboto, Lato, Fira_Code } from 'next/font/google';
import type { FontsConfig } from '@ottabase/ui-fonts';

const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-family-primary',
});

const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-family-heading',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-family-monospace',
});

export const customFontsConfig: FontsConfig = {
  primary: {
    role: 'primary',
    name: 'Roboto',
    font: roboto,
    cssVariable: '--font-family-primary',
    targetClasses: ['.font-family-primary'],
    fallback: 'sans-serif',
  },
  heading: {
    role: 'heading',
    name: 'Lato',
    font: lato,
    cssVariable: '--font-family-heading',
    targetClasses: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', '.font-family-heading'],
    fallback: 'sans-serif',
  },
  monospace: {
    role: 'monospace',
    name: 'Fira Code',
    font: firaCode,
    cssVariable: '--font-family-monospace',
    targetClasses: ['code', 'pre', 'kbd', '.font-family-mono'],
    fallback: 'monospace',
  },
};
```

## CSS Custom Properties

The following CSS custom properties are automatically injected:

- `--font-family-primary` - Primary/body font
- `--font-family-heading` - Heading font
- `--font-family-monospace` - Monospace/code font
- `--font-family-handwriting` - Handwriting/cursive font (optional)

Use them in your CSS:

```css
body {
  font-family: var(--font-family-primary);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-family-heading);
}

code, pre {
  font-family: var(--font-family-monospace);
}
```

## CSS Classes

The following utility classes are available:

- `.font-family-primary` - Apply primary font
- `.font-family-heading` - Apply heading font
- `.font-family-mono` / `.font-family-monospace` - Apply monospace font
- `.font-family-handwriting` / `.font-family-cursive` - Apply handwriting font

## API Reference

### Types

#### `FontRole`

```typescript
type FontRole = 'primary' | 'heading' | 'monospace' | 'handwriting';
```

#### `FontConfig`

```typescript
interface FontConfig {
  role: FontRole;
  name: string;
  font: NextFont;
  cssVariable: string;
  targetClasses?: string[];
  fallback?: string;
}
```

#### `FontsConfig`

```typescript
interface FontsConfig {
  primary: FontConfig;
  heading: FontConfig;
  monospace: FontConfig;
  handwriting?: FontConfig;
}
```

#### `FontFamilies`

```typescript
interface FontFamilies {
  primary: string;
  heading: string;
  monospace: string;
  handwriting?: string;
}
```

### Components

#### `ProviderFont`

```typescript
interface ProviderFontProps {
  children: ReactNode;
  fonts: FontsConfig;
  enforceWithImportant?: boolean; // default: true
  applyToBody?: boolean; // default: true
}
```

### Functions

#### `extractFontFamilies(fonts: FontsConfig): FontFamilies`

Extract font family strings for theme integration.

#### `generateCSSVariables(fonts: FontsConfig): Record<string, string>`

Generate CSS custom properties object.

#### `generateFontCSS(fonts: FontsConfig, enforceWithImportant?: boolean): string`

Generate CSS string with font-family rules.

#### `getAllFontClassNames(fonts: FontsConfig): string`

Get all font class names for applying to root elements.

## Pre-configured Fonts

### Available Fonts

- `inter` - Inter (sans-serif)
- `workSans` - Work Sans (sans-serif, geometric)
- `jetBrainsMono` - JetBrains Mono (monospace)
- `patrickHand` - Patrick Hand (handwriting)
- `geist` - Geist (Vercel's sans-serif)
- `geistMono` - Geist Mono (Vercel's monospace)

### System Font Fallbacks

```typescript
const SYSTEM_FONT_FALLBACKS = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  handwriting: 'cursive, "Comic Sans MS", "Apple Chancery", "Brush Script MT"',
};
```

## Integration Examples

### With Mantine

```tsx
import { ProviderFont, defaultFontsConfig, extractFontFamilies } from '@ottabase/ui-fonts';
import { MantineProvider } from '@mantine/core';

const fontFamilies = extractFontFamilies(defaultFontsConfig);

<ProviderFont fonts={defaultFontsConfig}>
  <MantineProvider theme={{
    fontFamily: fontFamilies.primary,
    headings: { fontFamily: fontFamilies.heading },
    fontFamilyMonospace: fontFamilies.monospace,
  }}>
    {children}
  </MantineProvider>
</ProviderFont>
```

### With Tailwind CSS

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-family-primary)', 'sans-serif'],
        heading: ['var(--font-family-heading)', 'sans-serif'],
        mono: ['var(--font-family-monospace)', 'monospace'],
      },
    },
  },
};
```

## Performance Tips

1. **Use `display: swap`** - Already configured in pre-configured fonts
2. **Preload critical fonts** - Next.js handles this automatically
3. **Limit font weights** - Only load weights you actually use
4. **Use system fonts for body text** - Consider `systemFontsConfig` for maximum performance
5. **Subset fonts** - Pre-configured fonts only load Latin subset

## Migration Guide

If you're migrating from a previous font setup:

### Before

```tsx
import { Inter, Work_Sans } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });
const workSans = Work_Sans({ subsets: ['latin'] });

<div className={inter.className}>
  {children}
</div>
```

### After

```tsx
import { ProviderFont, defaultFontsConfig } from '@ottabase/ui-fonts';

<ProviderFont fonts={defaultFontsConfig}>
  {children}
</ProviderFont>
```

## License

MIT
