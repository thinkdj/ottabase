# @ottabase/ottalayout

Core layout component for Ottabase applications, built on top of Mantine's AppShell component with enhanced features and smooth transitions.

## Features

- Built on Mantine AppShell for robust layout management
- Smooth CSS transitions when switching between layouts
- Flexible component composition (Header, Footer, Navbar, Aside, Body)
- Responsive behavior out of the box
- TypeScript support with full type definitions
- Custom hook for managing layout state
- Preset layout configurations
- Customizable transition timing and easing
- Support for both light and dark themes

## Installation

```bash
pnpm add @ottabase/ottalayout
```

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
| `layout`                   | `'default' \| 'alt'`    | `default` | Layout configuration                 |
| `padding`                  | `number \| string`      | `'md'`    | Padding for main content area        |
| `disableTransitions`       | `boolean`               | `false`   | Whether to disable transitions       |
| `transitionDuration`       | `number`                | `200`     | Transition duration in milliseconds  |
| `transitionTimingFunction` | `string`                | `'ease'`  | Transition timing function           |
| `appShellProps`            | `Partial<AppShellProps>`| `{}`      | Additional AppShell props            |
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
| `offset`   | `number`               | Offset for fixed positioning          |

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

## License

MIT
