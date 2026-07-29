# @ottabase/ottamenu

Pure menu types, renderers, and tree utilities for Ottabase — 6 built-in render types, zero persistence.

> **Architecture**: ottamenu is a pure package (no ORM, no database). Menu models, schema, and CRUD handlers live in
> `@ottabase/brand-engine`. The package root `@ottabase/ottamenu` is **headless** — it exports only framework-agnostic
> types (`MenuItemDto`, `MenuRenderType`, `MenuWithItemsDto`) and the pure `buildItemTree` tree utility, so it stays
> import-safe in non-React (edge/worker) contexts. Every rendered React component (`MenuRenderer`, `renderMenu`,
> `MenuSlotRenderer`, and the six standalone renderers) is isolated behind the `@ottabase/ottamenu/render` subpath, and
> `react` / `@tanstack/react-router` are **optional peer dependencies** needed only when you import from `/render`.

## Render Types

| Type       | Description                                      | Use Case                                |
| ---------- | ------------------------------------------------ | --------------------------------------- |
| `sidebar`  | Vertical link list with nested indentation       | App sidebars, settings nav              |
| `flyout`   | Compact popover-style dropdown                   | Context menus, quick actions            |
| `mega`     | Multi-column dropdown with images & descriptions | Site headers (Anthropic / GitHub style) |
| `navbar`   | Horizontal nav bar with single-column dropdowns  | Top navigation bars                     |
| `dropdown` | Simple single-column list with optional images   | Action menus, compact dropdowns         |
| `footer`   | Multi-column footer layout                       | Site footers                            |

## Features

- **6 renderers**: Sidebar, flyout, mega, navbar, dropdown, footer
- **Nested items**: Multi-level nesting via `parentId`, auto-built into tree with `buildItemTree()`
- **Images & descriptions**: Items support `image`, `description`, `tooltip`, `newTab`
- **Auth filtering**: `authRequired` items hidden when user is not authenticated
- **Active state**: Automatic active-link highlighting via pathname matching
- **Menu slots**: `MenuSlotRenderer` renders menus assigned to named layout slots via brand API data

## Quick Start

Renderers live on the `/render` subpath; the menu types stay on the headless root.

```tsx
import { renderMenu } from '@ottabase/ottamenu/render';
import type { MenuItemDto } from '@ottabase/ottamenu';

const items: MenuItemDto[] = [
    { id: '1', menuId: 'm1', name: 'Home', link: '/' },
    { id: '2', menuId: 'm1', name: 'About', link: '/about' },
];

// Render as mega menu
const nav = renderMenu({ items }, 'mega', {
    isAuthenticated: true,
    pathname: '/about',
});
```

Or use the component form:

```tsx
import { MenuRenderer } from '@ottabase/ottamenu/render';

<MenuRenderer menu={{ items }} type="mega" options={{ isAuthenticated: true, pathname: '/about' }} />;
```

## Individual Renderers

Each renderer is also exported standalone:

```tsx
import {
    SidebarMenuRenderer,
    FlyoutMenuRenderer,
    MegaMenuRenderer,
    NavbarMenuRenderer,
    DropdownMenuRenderer,
    FooterMenuRenderer,
} from '@ottabase/ottamenu/render';

<MegaMenuRenderer items={items} pathname="/products" />
<FooterMenuRenderer items={footerItems} pathname="/" />
```

## Tree Utilities

Build a nested tree from a flat `MenuItemDto[]` list:

```ts
import { buildItemTree } from '@ottabase/ottamenu';
import type { MenuItemTreeNode } from '@ottabase/ottamenu';

const tree: MenuItemTreeNode[] = buildItemTree(items);
// Each node has { ...item, children: MenuItemTreeNode[] }
```

## Menu Slot Renderer

Render menus assigned to named layout slots. Works with resolved data from the `GET /api/brand` response — no extra
fetch needed.

```tsx
import { MenuSlotRenderer } from '@ottabase/ottamenu/render';

<MenuSlotRenderer
    slot="header-nav"
    menuSlots={brandConfig.menuSlots}
    options={{ isAuthenticated: true, pathname: location.pathname }}
/>

// Override render type:
<MenuSlotRenderer slot="sidebar-nav" menuSlots={brandConfig.menuSlots} renderType="sidebar" />

// Fallback when no menu is assigned:
<MenuSlotRenderer slot="user-menu" menuSlots={brandConfig.menuSlots} fallback={<DefaultUserMenu />} />
```

| Prop         | Type                                     | Description                                      |
| ------------ | ---------------------------------------- | ------------------------------------------------ |
| `slot`       | `string`                                 | Slot name (e.g. `'header-nav'`, `'sidebar-nav'`) |
| `menuSlots`  | `Record<string, ResolvedMenuSlotData[]>` | From `brandConfig.menuSlots`                     |
| `options`    | `RenderMenuOptions`                      | Auth state, pathname for active highlighting     |
| `renderType` | `MenuRenderType`                         | Override the assignment's render type            |
| `className`  | `string`                                 | Wrapper div class (only added when set)          |
| `fallback`   | `ReactNode`                              | Shown when no menu assigned to this slot         |

## Exports

| Path                        | Contents                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@ottabase/ottamenu`        | **Headless** (no React): types (`MenuItemDto`, `MenuRenderType`, `MenuWithItemsDto`), `buildItemTree` + `MenuItemTreeNode`                                                                        |
| `@ottabase/ottamenu/render` | **All React UI**: `MenuRenderer`, `renderMenu`, `MenuSlotRenderer`, `MenuItemLink`, the six standalone renderers, and render types (`MenuForRender`, `RenderMenuOptions`, `ResolvedMenuSlotData`) |

`react` and `@tanstack/react-router` are optional peer dependencies — only required when importing from
`@ottabase/ottamenu/render`. Importing the headless root pulls in no framework.

Menu persistence (models, schema, CRUD handlers) is in `@ottabase/brand-engine`. See
[brand-engine README](../brand-engine/README.md).
