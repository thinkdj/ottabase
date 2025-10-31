# @ottabase/ui-icons

Unified icon system for Ottabase applications, providing a consistent API for Lucide, Tabler, and custom icons.

## Features

- 🎨 **Unified API** - Consistent interface across different icon libraries
- 📦 **Two Icon Libraries** - Access to both Lucide (simpler, ~1400 icons) and Tabler (comprehensive, 5000+ icons)
- 🔧 **Custom Icon Support** - Register and use your own custom SVG icons
- 📘 **TypeScript First** - Full TypeScript support with type safety
- ⚡ **Tree Shakeable** - Import only the icons you need
- 🎯 **Opinionated Defaults** - Curated icon set combining the best from both libraries

## Installation

```bash
pnpm add @ottabase/ui-icons
```

## Usage

### Basic Usage (Recommended)

The simplest way to use icons is through the unified `Icon` export:

```tsx
import { Icon } from '@ottabase/ui-icons';

function MyComponent() {
  return (
    <div>
      <Icon.Home size={24} />
      <Icon.Search size={20} color="blue" />
      <Icon.Settings strokeWidth={1.5} />
    </div>
  );
}
```

### Using Lucide Icons

Import icons directly from Lucide:

```tsx
import { Icons } from '@ottabase/ui-icons';
// or
import { Home, Search, Settings } from '@ottabase/ui-icons/lucide';

function MyComponent() {
  return (
    <div>
      <Icons.Home size={24} />
      <Home size={24} color="currentColor" />
    </div>
  );
}
```

### Using Tabler Icons

Import icons directly from Tabler:

```tsx
import { TablerIconSet } from '@ottabase/ui-icons';
// or
import { IconHome, IconSearch } from '@ottabase/ui-icons/tabler';

function MyComponent() {
  return (
    <div>
      <TablerIconSet.Home size={24} />
      <IconHome size={24} stroke={1.5} />
    </div>
  );
}
```

### Custom Icons

Register and use your own custom icons:

```tsx
import { registerCustomIcon, Icon, createSvgIcon } from '@ottabase/ui-icons';
import type { IconProps } from '@ottabase/ui-icons';

// Method 1: Register a custom component
const MyCustomIcon = (props: IconProps) => (
  <svg {...props} viewBox="0 0 24 24">
    <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" />
  </svg>
);

registerCustomIcon('my-icon', MyCustomIcon, {
  tags: ['custom', 'brand'],
});

// Method 2: Use the helper to create an SVG icon
const AnotherIcon = createSvgIcon(
  <path d="M12 2L2 7l10 5 10-5-10-5z" />,
  'AnotherIcon'
);

registerCustomIcon('another-icon', AnotherIcon);

// Use your custom icons
function MyComponent() {
  const CustomIcon = Icon['my-icon']; // or use getIcon('my-icon')
  return <CustomIcon size={24} />;
}
```

### Dynamic Icon Loading

Get icons dynamically by name:

```tsx
import { getIcon, hasIcon } from '@ottabase/ui-icons';

function DynamicIcon({ name }: { name: string }) {
  if (!hasIcon(name)) {
    return <span>Icon not found</span>;
  }

  const IconComponent = getIcon(name);
  return IconComponent ? <IconComponent size={24} /> : null;
}
```

## API Reference

### Icon Props

All icons accept the following props:

```typescript
interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;      // Size in pixels or CSS value (default: 24)
  color?: string;               // Icon color (default: "currentColor")
  strokeWidth?: number;         // Stroke width (default: 2 for Lucide, 1.5 for Tabler)
  className?: string;           // CSS class name
  style?: React.CSSProperties;  // Inline styles
  // ...all other SVG props
}
```

### Functions

#### `getIcon(name: string): IconComponent | undefined`

Get an icon from any source by name. Searches in order: Custom → Lucide → Tabler.

```tsx
const HomeIcon = getIcon('Home');
```

#### `hasIcon(name: string): boolean`

Check if an icon exists in any registry.

```tsx
if (hasIcon('Home')) {
  // Icon exists
}
```

#### `registerCustomIcon(name, component, options?)`

Register a custom icon component.

```tsx
registerCustomIcon('my-icon', MyIconComponent, {
  tags: ['custom'],
  originalName: 'MyIcon'
});
```

#### `getCustomIcon(name: string): IconComponent | undefined`

Get a custom icon by name.

#### `createSvgIcon(children, displayName?): IconComponent`

Helper to create a simple SVG icon component.

```tsx
const MyIcon = createSvgIcon(
  <path d="M12 2L2 7l10 5 10-5-10-5z" />,
  'MyIcon'
);
```

## Package Structure

```
@ottabase/ui-icons/
├── index.ts          # Main entry - unified Icon export
├── lucide.ts         # Lucide icons
├── tabler.ts         # Tabler icons
├── custom.ts         # Custom icon support
├── types.ts          # TypeScript types
└── utils.ts          # Utility functions
```

## Icon Libraries

### Lucide Icons

- **Count**: ~1,400 icons
- **Style**: Clean, minimal, consistent
- **Best for**: Common UI elements, general purpose
- **Docs**: https://lucide.dev

### Tabler Icons

- **Count**: 5,000+ icons
- **Style**: Comprehensive, detailed
- **Best for**: Specialized icons, extensive coverage
- **Docs**: https://tabler.io/icons

## Best Practices

1. **Use the unified `Icon` export** for most cases:
   ```tsx
   import { Icon } from '@ottabase/ui-icons';
   ```

2. **Import specific icons** for better tree-shaking:
   ```tsx
   import { Home, Search } from '@ottabase/ui-icons/lucide';
   ```

3. **Use `currentColor`** for dynamic theming:
   ```tsx
   <Icon.Home color="currentColor" />
   ```

4. **Register custom icons once** at app initialization:
   ```tsx
   // In your app's entry point
   registerCustomIcon('logo', LogoIcon);
   ```

5. **Prefer Lucide for common icons**, fall back to Tabler for specialized ones

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Watch mode for development
pnpm dev

# Type checking
pnpm type-check

# Linting
pnpm lint
```

## Examples

### Dark Mode Toggle

```tsx
import { Icon } from '@ottabase/ui-icons';

function DarkModeToggle({ isDark, toggle }: Props) {
  return (
    <button onClick={toggle}>
      {isDark ? <Icon.Sun size={20} /> : <Icon.Moon size={20} />}
    </button>
  );
}
```

### Loading Spinner

```tsx
import { Icon } from '@ottabase/ui-icons';

function LoadingSpinner() {
  return (
    <Icon.Loader2
      size={24}
      className="animate-spin"
      color="currentColor"
    />
  );
}
```

### Navigation Menu

```tsx
import { Icon } from '@ottabase/ui-icons';

const menuItems = [
  { icon: Icon.Home, label: 'Home', href: '/' },
  { icon: Icon.Search, label: 'Search', href: '/search' },
  { icon: Icon.Settings, label: 'Settings', href: '/settings' },
];

function NavMenu() {
  return (
    <nav>
      {menuItems.map(({ icon: IconComponent, label, href }) => (
        <a key={href} href={href}>
          <IconComponent size={20} />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
```

## License

MIT
