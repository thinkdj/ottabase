# @ottabase/ottalayout

Layout system for Ottabase — types, presets, path resolver, validators, utility classes, and React slots.

## Install

```bash
pnpm add @ottabase/ottalayout
```

## Exports

| Entry point                  | Description                                             |
| ---------------------------- | ------------------------------------------------------- |
| `@ottabase/ottalayout`       | Pure logic: types, presets, resolver, validators, utils |
| `@ottabase/ottalayout/react` | React API: slots, layout meta context                   |

## Quick Start

### Layout Config

Every layout is described by a single `LayoutConfig` object:

```typescript
import type { LayoutConfig } from '@ottabase/ottalayout';

const myLayout: LayoutConfig = {
    header: 'topbar',
    navigation: 'sidebar',
    contentWidth: 'lg',
    footer: true,
    density: 'comfy',
    // Optional extended fields:
    headerSticky: true,
    sidebarWidth: 'standard',
    sidebarPosition: 'left',
    containerPadding: 'md',
    centerContent: false,
};
```

### Built-in Presets

10 ready-made configs for common page types:

```typescript
import { LAYOUT_PRESETS, APP_SHELL_LAYOUT, DOCS_LAYOUT } from '@ottabase/ottalayout';

// All presets: homepage, app-shell, docs, minimal, auth, landing,
//              dashboard, settings, marketing, fullscreen

const config = APP_SHELL_LAYOUT.config;
// → { header: 'topbar', navigation: 'sidebar', contentWidth: 'fluid', ... }
```

### Path Resolver

Match URL paths to layouts using wildcard patterns (`*` = one segment, `**` = any depth):

```typescript
import { resolveLayoutForPath } from '@ottabase/ottalayout';
import type { RouteMapping } from '@ottabase/ottalayout';

const mappings: RouteMapping[] = [
    { pathPattern: '/admin/**', layoutPresetId: 'app-shell', priority: 10 },
    { pathPattern: '/docs/**', layoutPresetId: 'docs', priority: 10 },
    { pathPattern: '/**', layoutPresetId: 'homepage', priority: 0 },
];

const config = resolveLayoutForPath('/admin/users', mappings);
// → APP_SHELL_LAYOUT.config
```

### Validators & Merge

Safely merge partial/untrusted configs with defaults:

```typescript
import { mergeLayoutConfig, isValidLayoutConfig, isValidPathPattern } from '@ottabase/ottalayout';

const safe = mergeLayoutConfig({ header: 'topbar', contentWidth: 'invalid' as any });
// → fills valid fields, defaults invalid ones

isValidLayoutConfig(safe); // true
isValidPathPattern('/blog/**'); // true
```

### Utility Classes

Tailwind-friendly class helpers for layout dimensions:

```typescript
import { contentWidthClass, densityPadding, sidebarWidthClass } from '@ottabase/ottalayout';

contentWidthClass('lg'); // 'max-w-screen-lg'
densityPadding('compact'); // 'p-2'
sidebarWidthClass('wide'); // 'w-72'
```

### React: Slots

Named slots let pages inject content into layout regions (header actions, sidebar widgets, etc.):

```tsx
import { LayoutSlotsProvider, LayoutSlot, SlotContent } from '@ottabase/ottalayout/react';

// In your layout shell:
function AppLayout({ children }) {
    return (
        <LayoutSlotsProvider>
            <header>
                <LayoutSlot name="header-actions" />
            </header>
            <main>{children}</main>
        </LayoutSlotsProvider>
    );
}

// In any page:
function DashboardPage() {
    return (
        <>
            <SlotContent name="header-actions">
                <button>Export</button>
            </SlotContent>
            <h1>Dashboard</h1>
        </>
    );
}
```

### React: Layout Meta

Pages can declare layout hints (title, breadcrumbs) via context:

```tsx
import { LayoutMetaProvider, useLayoutMeta } from '@ottabase/ottalayout/react';

// Wrap your app:
<LayoutMetaProvider>
    <App />
</LayoutMetaProvider>;

// In a page — set meta:
const { setMeta } = useLayoutMeta();
setMeta({ title: 'Settings', breadcrumbs: ['Home', 'Settings'] });

// In the layout shell — read meta:
const { meta } = useLayoutMeta();
// → { title: 'Settings', breadcrumbs: ['Home', 'Settings'] }
```

### Menu Slots

Named positions in the layout where menus can be dynamically bound. Slot assignments are stored in the database via
`@ottabase/brand-engine` and returned in the `GET /api/brand` response.

6 built-in slot names:

| Slot          | Description                    |
| ------------- | ------------------------------ |
| `header-nav`  | Main navigation in the header  |
| `sidebar-nav` | Sidebar navigation             |
| `footer-nav`  | Footer links                   |
| `mobile-nav`  | Mobile drawer / hamburger menu |
| `user-menu`   | User account dropdown          |
| `admin-nav`   | Admin-only navigation          |

Custom slot names (any string) are also supported for app-specific zones.

```typescript
import { BUILT_IN_MENU_SLOTS, type BuiltInMenuSlotName, type MenuSlotConfig } from '@ottabase/ottalayout';

// Enumerate all built-in slots
BUILT_IN_MENU_SLOTS.forEach((slot) => console.log(slot));

// Describe a slot assignment
const config: MenuSlotConfig = {
    slotName: 'header-nav',
    menuId: 'menu-abc-123',
    renderType: 'mega',
    sortOrder: 0,
};
```

To render menus in slots, use `<MenuSlotRenderer>` from `@ottabase/ottamenu` (see
[ottamenu README](../ottamenu/README.md#menu-slot-renderer)).

## Integration

`@ottabase/ottalayout` provides the **pure logic**. For runtime layout rendering, use with:

- **`@ottabase/brand-engine`** — stores route mappings, layout templates, and **menu slot assignments** per app/tenant
- **`@ottabase/brand-engine-react`** — `<LayoutResolver>` component that reads mappings and renders the active layout
- **`@ottabase/ottamenu`** — `<MenuSlotRenderer>` component that renders menus assigned to layout slots
