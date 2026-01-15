# @ottabase/ui-tailwind

Shared Tailwind CSS configuration and utilities for Ottabase applications.

## Features

- Pre-configured Tailwind setup for Ottabase apps
- Custom design tokens and theme
- Utility classes and plugins
- Dark mode support
- Responsive design utilities

## Installation

```bash
pnpm add @ottabase/ui-tailwind tailwindcss
```

## Quick Start

### Extend Tailwind Config

```javascript
// tailwind.config.js
import { ottabaseTailwindConfig } from '@ottabase/ui-tailwind';

export default {
  ...ottabaseTailwindConfig,
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './node_modules/@ottabase/ui-tailwind/**/*.{js,jsx,ts,tsx}',
  ],
};
```

### Import Base Styles

```css
/* app/globals.css */
@import "@ottabase/ui-tailwind/styles.css";

@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Custom Theme

```javascript
// tailwind.config.js
import { ottabaseTailwindConfig } from '@ottabase/ui-tailwind';

export default {
  ...ottabaseTailwindConfig,
  theme: {
    ...ottabaseTailwindConfig.theme,
    extend: {
      ...ottabaseTailwindConfig.theme.extend,
      colors: {
        ...ottabaseTailwindConfig.theme.extend.colors,
        brand: {
          50: '#f0f9ff',
          // ... your custom colors
        },
      },
    },
  },
};
```

## Usage

### Dark Mode

```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <h1 className="text-2xl font-bold">Hello World</h1>
</div>
```

### Responsive Design

```tsx
<div className="container mx-auto px-4 sm:px-6 lg:px-8">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {/* Grid items */}
  </div>
</div>
```

## License

MIT
