# @ottabase/ottalayout

Standalone layout component for Ottabase applications that mimics Mantine's AppShell functionality. Built with CSS Grid and React, providing flexible layout management with smooth transitions - no external UI library dependencies required.

## Features

- **Standalone implementation** - No Mantine or other UI library dependencies
- **CSS Grid-based layout** - Modern, flexible layout system
- **Smooth CSS transitions** - When switching between layouts or collapsing sections
- **Flexible component composition** - Header, Footer, Navbar, Aside, and Main content areas
- **Responsive behavior** - Mobile-friendly with automatic breakpoints
- **TypeScript support** - Full type definitions included
- **Custom hook** - `useOttaLayout` for managing layout state
- **Preset configurations** - 13 ready-to-use layout patterns
- **Customizable transitions** - Control timing and easing functions
- **Theme support** - Light/dark themes with CSS variables
- **Accessibility** - Semantic HTML elements and reduced motion support

## Installation

```bash
pnpm add @ottabase/ottalayout
```

**Peer Dependencies:**
- `react` >= 18.0.0
- `react-dom` >= 18.0.0

## Basic Usage

```tsx
import { OttaLayout } from "@ottabase/ottalayout";
import "@ottabase/ottalayout/styles";

function App() {
  return (
    <OttaLayout
      header={{
        height: 60,
        children: <div>Header Content</div>,
      }}
      navbar={{
        width: 300,
        children: <div>Navbar Content</div>,
      }}
      footer={{
        height: 60,
        children: <div>Footer Content</div>,
      }}
    >
      <div>Main Content</div>
    </OttaLayout>
  );
}
```

## Using the Layout Hook

```tsx
import { OttaLayout, useOttaLayout } from "@ottabase/ottalayout";

function App() {
  const layout = useOttaLayout({
    initialNavbarOpened: true,
    initialAsideOpened: false,
  });

  return (
    <OttaLayout
      header={{
        height: 60,
        children: (
          <div>
            <button onClick={layout.toggleNavbar}>Toggle Navbar</button>
            <button onClick={layout.toggleAside}>Toggle Aside</button>
          </div>
        ),
      }}
      navbar={{
        width: 300,
        collapsed: !layout.navbarOpened,
        children: <div>Navbar Content</div>,
      }}
      aside={{
        width: 300,
        collapsed: !layout.asideOpened,
        children: <div>Aside Content</div>,
      }}
    >
      <div>Main Content</div>
    </OttaLayout>
  );
}
```

## Layout Presets

```tsx
import { OttaLayout, getLayoutPreset, layoutPresets } from "@ottabase/ottalayout";

// Use a preset
const preset = getLayoutPreset("fullLayout");

// Or list all available presets
const presetNames = Object.keys(layoutPresets);
// ['default', 'headerOnly', 'headerFooter', 'fullLayout', ...]
```

## API

### OttaLayout Props

| Prop                       | Type                    | Default   | Description                          |
| -------------------------- | ----------------------- | --------- | ------------------------------------ |
| `header`                   | `OttaLayoutSection`     | -         | Header section configuration         |
| `footer`                   | `OttaLayoutSection`     | -         | Footer section configuration         |
| `navbar`                   | `OttaLayoutSection`     | -         | Left navbar section configuration    |
| `aside`                    | `OttaLayoutSection`     | -         | Right aside section configuration    |
| `children`                 | `ReactNode`             | Required  | Main content area                    |
| `layout`                   | `'default' \| 'alt'`    | `default` | Layout configuration (navbar/aside position swap) |
| `padding`                  | `number \| string`      | `'md'`    | Padding for main content (xs/sm/md/lg/xl or custom) |
| `disableTransitions`       | `boolean`               | `false`   | Whether to disable transitions       |
| `transitionDuration`       | `number`                | `200`     | Transition duration in milliseconds  |
| `transitionTimingFunction` | `string`                | `'ease'`  | Transition timing function           |
| `className`                | `string`                | -         | Custom className for root container  |
| `style`                    | `React.CSSProperties`   | -         | Custom styles for root container     |
| `mainClassName`            | `string`                | -         | Custom className for main content    |
| `mainStyle`                | `React.CSSProperties`   | -         | Custom styles for main content       |

### OttaLayoutSection

| Prop       | Type                   | Description                           |
| ---------- | ---------------------- | ------------------------------------- |
| `children` | `ReactNode`            | Content to render in the section      |
| `height`   | `number \| string`     | Height (for Header/Footer)            |
| `width`    | `number \| string`     | Width (for Navbar/Aside)              |
| `collapsed`| `boolean`              | Whether the section is collapsed      |
| `zIndex`   | `number`               | z-index of the section                |
| `className`| `string`               | Custom className                      |
| `style`    | `React.CSSProperties`  | Custom styles                         |
| `offset`   | `boolean`              | Whether to offset main content area   |
| `breakpoint` | `number`             | Breakpoint for responsive behavior (px) |

### useOttaLayout Hook

Returns an object with the following properties and methods:

```typescript
interface UseOttaLayoutReturn {
  // State
  navbarOpened: boolean;
  asideOpened: boolean;
  headerVisible: boolean;
  footerVisible: boolean;

  // Navbar controls
  toggleNavbar: () => void;
  openNavbar: () => void;
  closeNavbar: () => void;

  // Aside controls
  toggleAside: () => void;
  openAside: () => void;
  closeAside: () => void;

  // Header controls
  toggleHeader: () => void;
  showHeader: () => void;
  hideHeader: () => void;

  // Footer controls
  toggleFooter: () => void;
  showFooter: () => void;
  hideFooter: () => void;

  // Reset
  reset: () => void;
}
```

## Layout Presets

Available presets:

- `default` - Header with navbar sidebar
- `headerOnly` - Simple header layout
- `headerFooter` - Header and footer layout
- `navbarOnly` - Left sidebar navigation
- `fullLayout` - Header, footer, navbar, and aside
- `asideOnly` - Right sidebar only
- `doubleNavbar` - Left navbar and right aside
- `headerNavbar` - Header with left sidebar
- `headerAside` - Header with right sidebar
- `headerNavbarFooter` - Header, footer with left sidebar
- `headerAsideFooter` - Header, footer with right sidebar
- `navbarFooter` - Left sidebar with footer
- `asideFooter` - Right sidebar with footer

## Customization

### Custom Transitions

```tsx
<OttaLayout
  transitionDuration={300}
  transitionTimingFunction="cubic-bezier(0.4, 0, 0.2, 1)"
  // ... other props
>
  {children}
</OttaLayout>
```

### Disable Transitions

```tsx
<OttaLayout disableTransitions>
  {children}
</OttaLayout>
```

### Theme Customization

The layout supports theming through CSS custom properties:

```css
.otta-layout {
  --otta-header-bg: #ffffff;
  --otta-footer-bg: #ffffff;
  --otta-navbar-bg: #f5f5f5;
  --otta-aside-bg: #f5f5f5;
  --otta-main-bg: #ffffff;
  --otta-border-color: #e0e0e0;
  --otta-scrollbar-thumb: rgba(0, 0, 0, 0.2);
  --otta-scrollbar-thumb-hover: rgba(0, 0, 0, 0.3);
}
```

### Utility Classes

- `otta-layout-bordered` - Add thicker borders
- `otta-layout-shadow` - Add shadows instead of borders
- `otta-layout-dark` / `otta-layout-light` - Force theme

## How It Works

OttaLayout uses CSS Grid to create a flexible layout system:

- **Grid Layout**: 3 columns × 3 rows grid structure
- **Automatic Sizing**: Sections collapse to 0px when not in use
- **Smooth Transitions**: All size changes animated
- **Transform-based Animations**: Collapsed sections slide out of view
- **Responsive**: Adapts to mobile screens automatically

## Migration from Mantine AppShell

If you're migrating from Mantine's AppShell, OttaLayout provides similar functionality:

```diff
- import { AppShell } from '@mantine/core';
+ import { OttaLayout } from '@ottabase/ottalayout';
+ import '@ottabase/ottalayout/styles';

  <OttaLayout
    header={{
-     height: { base: 60, md: 70 },
+     height: 60,
      children: <Header />
    }}
    // ... other props remain similar
  />
```

Key differences:
- No Mantine dependency required
- Simplified responsive props (use CSS media queries for complex responsive behavior)
- CSS Grid-based instead of Flexbox
- CSS custom properties for theming

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- CSS Grid support required
- CSS custom properties support required

## Examples

Check the `examples/` directory for complete working examples:

- `BasicExample.tsx` - Simple header + navbar layout
- `FullLayoutExample.tsx` - All sections with toggle controls
- `PresetExample.tsx` - Switcher between preset configurations

## License

MIT
