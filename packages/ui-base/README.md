# @ottabase/ui-base

Base UI styles and utilities for Ottabase applications. Foundation styles, CSS reset, animations, and utilities for
consistent cross-browser styling across all projects.

## Features

- **CSS Reset** - Modern, normalized CSS reset for consistency
- **Base Styles** - Semantic HTML element styling
- **Animations** - Smooth transitions, fades, and entrance animations
- **Color System** - Semantic color utilities
- **Typography** - Base font and text styles
- **Framework-Agnostic** - No React, Mantine, or framework dependencies
- **Light & Dark Mode** - Automatic theme support

## Installation

```bash
pnpm add @ottabase/ui-base
```

## Quick Start

### Option 1: Use Provider (Recommended)

The provider automatically injects all base styles:

```tsx
import { ProviderUIBase } from '@ottabase/ui-base';

export default function App({ children }) {
    return <ProviderUIBase>{children}</ProviderUIBase>;
}
```

### Option 2: Direct Import

Import styles directly in your CSS or JS:

```tsx
import '@ottabase/ui-base/styles';
```

## Included Styles

The provider loads three style sheets automatically:

### 1. CSS Reset (`reset.css`)

Modern CSS reset that:

- Normalizes all browsers
- Removes default margins and padding
- Sets semantic font sizes
- Configures outline styles

```css
/* Applied to all elements */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}
```

### 2. Ottabase Utilities (`ottabase.css`)

Semantic color and utility classes:

```tsx
// Semantic colors
<div className="text-foreground bg-background">Content</div>
<div className="text-muted-foreground">Muted text</div>

// Backgrounds
<div className="bg-primary">Primary section</div>
<div className="bg-secondary">Secondary section</div>

// Borders
<div className="border border-default">Bordered</div>
```

### 3. Animations (`animations.css`)

Pre-built smooth animations:

```tsx
<div className="animate-fade-in">Fades in</div>
<div className="animate-slide-down">Slides down</div>
<div className="animate-pulse">Pulses</div>
```

## Usage Examples

### Basic Page Layout

```tsx
import { ProviderUIBase } from '@ottabase/ui-base';

export default function App() {
    return (
        <ProviderUIBase>
            <div className="bg-background text-foreground">
                <header className="border-b border-default">
                    <h1>My App</h1>
                </header>

                <main className="container mx-auto py-8">
                    <article className="prose">
                        <h2>Article Title</h2>
                        <p>Content here...</p>
                    </article>
                </main>

                <footer className="border-t border-default mt-8 pt-8">
                    <p className="text-muted-foreground">© 2024</p>
                </footer>
            </div>
        </ProviderUIBase>
    );
}
```

### With Animations

```tsx
function AnimatedCard() {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className={`p-6 rounded-lg border border-default ${isVisible ? 'animate-fade-in' : 'opacity-0'}`}>
            <h3>Animated Card</h3>
            <p>This card fades in smoothly</p>
        </div>
    );
}
```

### Form Styling

```tsx
function ContactForm() {
    return (
        <form className="max-w-md space-y-4">
            <input type="text" placeholder="Name" className="w-full px-4 py-2 border border-default rounded" />
            <input type="email" placeholder="Email" className="w-full px-4 py-2 border border-default rounded" />
            <textarea placeholder="Message" className="w-full px-4 py-2 border border-default rounded" rows={4} />
            <button className="w-full bg-primary text-white py-2 rounded hover:opacity-90">Send</button>
        </form>
    );
}
```

## Semantic Colors

Available color classes for text and backgrounds:

```css
/* Foreground Colors (text) */
.text-foreground /* Primary text */
.text-muted-foreground /* Muted/secondary text */

/* Background Colors */
.bg-background /* Page background */
.bg-card /* Card/container background */
.bg-primary /* Primary action background */
.bg-secondary /* Secondary background */

/* Borders */
.border-default /* Default border color */
```

## Light & Dark Mode

Automatically adapts to system or user preference:

```tsx
// Automatically works in both light and dark mode
<div className="bg-background text-foreground">Adapts to current theme</div>
```

Enable dark mode manually with the `dark` class:

```tsx
<div className="dark">
    <div className="bg-background">Always dark mode</div>
</div>
```

## Customization

Override default styles by importing your own CSS after the provider:

```tsx
import { ProviderUIBase } from '@ottabase/ui-base';
import './custom-styles.css'; // Your overrides

export default function App() {
    return <ProviderUIBase>...</ProviderUIBase>;
}
```

```css
/* custom-styles.css */
:root {
    --color-primary: #3b82f6;
    --color-secondary: #8b5cf6;
    --color-accent: #ec4899;
}
```

## Browser Support

Works in all modern browsers:

- Chrome 88+
- Firefox 87+
- Safari 14+
- Edge 88+

## Performance Notes

- **Minimal Size** - Only essential reset and base styles (~8KB)
- **No JavaScript** - Pure CSS for zero runtime overhead
- **No Build Step** - Works with any build tool

## Package Structure

```
ui-base/
├── src/
│   ├── index.ts       # React provider
│   └── styles.ts      # Style path exports
├── styles/
│   ├── reset.css      # CSS reset
│   ├── ottabase.css   # Utilities and colors
│   ├── animations.css # Animation keyframes
│   └── index.css      # Aggregator
└── package.json
```

## License

MIT
