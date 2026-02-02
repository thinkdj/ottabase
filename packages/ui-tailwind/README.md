# @ottabase/ui-tailwind

Shared Tailwind CSS configuration and utilities for Ottabase applications. Provides a consistent, extensible design
system with theme variables, animations, and component utilities.

## Features

- **Tailwind v4 Compatible** - Latest Tailwind CSS with modern utilities
- **CSS-in-HSL Variables** - Semantic color system with light/dark mode support
- **Brand Colors** - Pre-configured brand palette (teal-based)
- **Animations** - Accordion, smooth transitions, and custom keyframes
- **Typography Plugin** - Professional prose styling via `@tailwindcss/typography`
- **Form Utilities** - Styled form inputs via `@tailwindcss/forms`
- **Animations Plugin** - Smooth transitions and keyframe utilities
- **Zero Configuration** - Drop-in configuration for any app

## Installation

```bash
pnpm add @ottabase/ui-tailwind
```

## Setup

### 1. Configure Tailwind

In your `tailwind.config.js` or `tailwind.config.ts`:

```javascript
import baseConfig from '@ottabase/ui-tailwind';

export default {
    ...baseConfig,
    content: ['./src/**/*.{js,ts,jsx,tsx}'],
    // Override any settings as needed
};
```

### 2. Add CSS Variables

Define CSS variables in your root CSS file (`globals.css`):

```css
@layer base {
    :root {
        --background: 0 0% 100%;
        --foreground: 0 0% 3%;
        --card: 0 0% 100%;
        --card-foreground: 0 0% 3%;
        --primary: 0 0% 9%;
        --primary-foreground: 0 0% 100%;
        --secondary: 0 0% 96.1%;
        --secondary-foreground: 0 0% 9%;
        --muted: 0 0% 96.1%;
        --muted-foreground: 0 0% 45.1%;
        --accent: 0 84.6% 53.3%;
        --accent-foreground: 0 0% 100%;
        --destructive: 0 84.6% 60.2%;
        --destructive-foreground: 0 0% 100%;
        --border: 0 0% 89.8%;
        --input: 0 0% 89.8%;
        --ring: 0 0% 3%;
        --radius: 0.5rem;
    }

    @media (prefers-color-scheme: dark) {
        :root {
            --background: 0 0% 3.6%;
            --foreground: 0 0% 98%;
            --card: 0 0% 3.6%;
            --card-foreground: 0 0% 98%;
            --primary: 0 0% 98%;
            --primary-foreground: 0 0% 9%;
            --secondary: 0 0% 14.9%;
            --secondary-foreground: 0 0% 98%;
            --muted: 0 0% 14.9%;
            --muted-foreground: 0 0% 63.9%;
            --accent: 0 84.6% 53.3%;
            --accent-foreground: 0 0% 9%;
            --destructive: 0 62.8% 30.6%;
            --destructive-foreground: 0 0% 98%;
            --border: 0 0% 14.9%;
            --input: 0 0% 14.9%;
            --ring: 0 0% 83.1%;
        }
    }
}
```

### 3. Import in Your App

```typescript
// pages/_app.tsx or main entry point
import '@ottabase/ui-tailwind/styles'; // If exporting styles
```

## Color Palette

The configuration includes semantic colors that work with both light and dark modes:

### Base Colors

- **background** - Page background
- **foreground** - Text color
- **card** - Card/container background
- **primary** - Primary action color
- **secondary** - Secondary elements
- **destructive** - Danger/delete actions
- **muted** - Disabled/inactive elements
- **accent** - Highlights and accents
- **border** - Border color
- **input** - Form input backgrounds

### Brand Colors

Pre-configured teal brand palette:

```css
bg-brand-50   /* #f5fbff - Lightest */
bg-brand-500  /* #0ea5a5 - Primary */
bg-brand-700  /* #0b7b7b - Dark */
```

## Usage Examples

### Semantic Colors

```tsx
function Card() {
    return (
        <div className="bg-card text-card-foreground border border-border rounded-lg p-4">
            <h2 className="text-foreground font-semibold">Card Title</h2>
            <p className="text-muted-foreground">Muted text</p>
            <button className="bg-primary text-primary-foreground hover:bg-primary/90">Action</button>
        </div>
    );
}
```

### Dark Mode

Colors automatically adapt to `prefers-color-scheme` or `dark:` class:

```tsx
function Toggle() {
    return <button className="bg-white dark:bg-gray-900 text-black dark:text-white">Toggle Dark Mode</button>;
}
```

### Brand Colors

```tsx
function BrandButton() {
    return <button className="bg-brand-500 hover:bg-brand-700 text-white">Brand Button</button>;
}
```

### Animations

Built-in accordion animations:

```tsx
function Accordion() {
    return (
        <div className="overflow-hidden">
            <div
                className="origin-top animate-accordion-down"
                style={
                    {
                        '--radix-accordion-content-height': '200px',
                    } as React.CSSProperties
                }
            >
                Content
            </div>
        </div>
    );
}
```

### Typography

Use the `@tailwindcss/typography` plugin for prose:

```tsx
function Article() {
    return (
        <article className="prose dark:prose-invert">
            <h1>Article Title</h1>
            <p>Article content...</p>
            <code>code block</code>
        </article>
    );
}
```

### Form Styling

Forms are automatically styled via `@tailwindcss/forms`:

```tsx
function Form() {
    return (
        <form>
            <input type="text" placeholder="Name" className="w-full" />
            <input type="email" placeholder="Email" className="w-full" />
            <select>
                <option>Option 1</option>
                <option>Option 2</option>
            </select>
        </form>
    );
}
```

## Customization

### Override Configuration

```javascript
import baseConfig from '@ottabase/ui-tailwind';

export default {
    ...baseConfig,
    theme: {
        extend: {
            ...baseConfig.theme?.extend,
            colors: {
                // Add custom colors
                custom: '#your-color',
            },
            // Override other theme values
        },
    },
};
```

### Custom CSS Variables

Add custom variables in your CSS:

```css
:root {
    --custom: 200 50% 50%;
    --custom-foreground: 0 0% 100%;
}
```

Then use in Tailwind:

```javascript
theme: {
  extend: {
    colors: {
      custom: 'hsl(var(--custom))',
      'custom-foreground': 'hsl(var(--custom-foreground))',
    },
  },
}
```

## Fonts

The configuration sets `Inter` as the default sans font. Ensure it's loaded:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

Or use any other font by overriding the `fontFamily` theme:

```javascript
theme: {
  extend: {
    fontFamily: {
      sans: ['Your Font', ...defaultTheme.fontFamily.sans],
    },
  },
}
```

## Included Plugins

- `@tailwindcss/forms` - Professional form styling
- `@tailwindcss/typography` - Beautiful prose styling
- `tailwindcss-animate` - Smooth animations and transitions
- `postcss-preset-mantine` - Mantine integration (optional)

## Browser Support

Supports all modern browsers with CSS custom properties and CSS Grid support:

- Chrome 90+
- Firefox 88+
- Safari 14.1+
- Edge 90+

## Performance Notes

- **Tree-shakeable** - Only included utilities are bundled
- **Utility-first** - Minimal CSS output
- **CSS variables** - Enables dynamic theme switching at runtime

## License

MIT
