# @ottabase/ui-components

Shared UI components for Ottabase applications.

## Components

### DarkModeToggle

A versatile component that provides both toggle switch and button interfaces for switching between light and dark
themes. It integrates with both Mantine's color scheme and next-themes for Tailwind CSS.

#### Props

- `type`: `'toggle-switch' | 'button'` - The visual type of the toggle
- `title?: string` - Tooltip text for the button type (default: "Toggle color scheme")

#### Usage

```tsx
// Import from main entry (all components)
import { DarkModeToggle } from '@ottabase/ui-components';

// Import atomically (better for tree shaking)
import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';

// Toggle switch variant
<DarkModeToggle type="toggle-switch" />

// Button variant
<DarkModeToggle type="button" title="Switch theme" />
```

#### Dependencies

This component requires:

- `@mantine/core` - For UI components and color scheme management
- `@tabler/icons-react` - For sun and moon icons
- `next-themes` - For Tailwind CSS theme synchronization

### Logo

A flexible logo component that can display app name, logo image, optional dark mode toggle, and can be wrapped with a
link. Uses the @ottabase/config package for default values.

#### Props

- `size?: number` - Logo image size in pixels (default: 32)
- `darkModeSwitcher?: boolean` - Whether to show dark mode toggle (default: false)
- `logoUrl?: string` - URL/path to logo image (falls back to config.meta.logoUrl)
- `appName?: string` - Application name to display (falls back to config.meta.appName)
- `linkUrl?: string` - Optional URL to wrap logo as link
- `appConfig?: AppConfig` - Optional app config object (creates default if not provided)

#### Usage

```tsx
import { Logo } from '@ottabase/ui-components/logo';
import { createAppConfig } from '@ottabase/config';

// Simple logo with app name (uses default config)
<Logo appName="My App" />

// Logo with image and dark mode toggle
<Logo
  logoUrl="/logo.png"
  appName="My App"
  darkModeSwitcher={true}
  size={40}
/>

// Logo as link
<Logo
  appName="My App"
  linkUrl="/"
/>

// Logo with custom config
const config = createAppConfig({
  appName: 'My Custom App',
  defaults: {
    meta: {
      logoUrl: '/custom-logo.png'
    }
  }
});

<Logo appConfig={config} darkModeSwitcher={true} />
```

#### Dependencies

This component requires:

- `@mantine/core` - For UI components and layout
- `@ottabase/config` - For configuration management
- `next/link` - For optional link functionality (**Next.js only**; if using TanStack Router or another framework, wrap
  the Logo in your router's `<Link>` component instead and omit `linkUrl`)
- Internal DarkModeToggle component (if darkModeSwitcher is true)

## Tree Shaking

This package supports atomic imports for optimal tree shaking. Each component can be imported individually:

```tsx
// ✅ Tree-shakeable - only bundles DarkModeToggle
import { DarkModeToggle } from '@ottabase/ui-components/dark-mode-toggle';

// ❌ Imports all components (less optimal)
import { DarkModeToggle } from '@ottabase/ui-components';
```

## Available Atomic Imports

- `@ottabase/ui-components/dark-mode-toggle` - DarkModeToggle component
- `@ottabase/ui-components/logo` - Logo component

## Installation

```bash
pnpm add @ottabase/ui-components
```

For monorepo workspaces, use `workspace:*`:

```json
{ "dependencies": { "@ottabase/ui-components": "workspace:*" } }
```
