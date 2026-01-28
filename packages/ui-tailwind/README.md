# @ottabase/ui-tailwind

Shared Tailwind CSS configuration for Ottabase apps.

## Usage

Extend in your app's `tailwind.config.cjs`:

```javascript
const baseConfig = require("@ottabase/ui-tailwind/tailwind.base.cjs");

/** @type {import('tailwindcss').Config} */
module.exports = {
  ...baseConfig,
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./app/**/*.{js,ts,jsx,tsx}",
    // Include package sources
    "../../packages/ui-shadcn/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui-components/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ottaselect/src/**/*.{js,ts,jsx,tsx}",
  ],
};
```

## Base Styles

Import base styles in your CSS:

```css
@import "@ottabase/ui-tailwind/styles/tailwind.base.css";
```

## Included Features

### Dark Mode

```javascript
darkMode: ["class"]  // Toggle via "dark" class on html/body
```

### Color System (CSS Variables)

shadcn/ui compatible color system:

```javascript
colors: {
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  primary: { DEFAULT: "hsl(var(--primary))", foreground: "..." },
  secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "..." },
  destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "..." },
  muted: { DEFAULT: "hsl(var(--muted))", foreground: "..." },
  accent: { DEFAULT: "hsl(var(--accent))", foreground: "..." },
  card: { DEFAULT: "hsl(var(--card))", foreground: "..." },
  popover: { DEFAULT: "hsl(var(--popover))", foreground: "..." },
  border: "hsl(var(--border))",
  input: "hsl(var(--input))",
  ring: "hsl(var(--ring))",
}
```

### Bundled Plugins

- `@tailwindcss/forms` - Form element styling
- `@tailwindcss/typography` - Prose content styling
- `tailwindcss-animate` - Animation utilities

### Typography

Inter font as default sans-serif.

### Animations

Accordion animations for Radix UI components.

## Peer Dependencies

```json
{
  "tailwindcss": ">=3.4.17 <4",
  "tailwindcss-animate": ">=1.0.7",
  "@tailwindcss/forms": ">=0.5.10",
  "@tailwindcss/typography": ">=0.5.16"
}
```
