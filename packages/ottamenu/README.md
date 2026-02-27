# @ottabase/ottamenu

Menu management for Ottabase – define and render navigation menus with 6 built-in render types.

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

- **DB-backed menus**: `menus` + `menu_items` tables (OttaORM models)
- **Nested items**: Multi-level nesting via `parentId`, auto-built into tree
- **Images & descriptions**: Items support `image`, `description`, `tooltip`, `newTab`
- **Auth filtering**: `authRequired` items hidden when user is not authenticated
- **Active state**: Automatic active-link highlighting via pathname matching

## Quick Start

```tsx
import { renderMenu, getMenuBySlug } from '@ottabase/ottamenu';

// Server: resolve menu by slug
const menu = await getMenuBySlug('header', appId);

// Client: render as mega menu
const nav = renderMenu(menu, 'mega', {
    isAuthenticated: true,
    pathname: '/products',
});
```

Or use the component form:

```tsx
import { MenuRenderer } from '@ottabase/ottamenu';

<MenuRenderer menu={menu} type="mega" options={{ isAuthenticated: true, pathname: '/products' }} />;
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

// Pass pre-filtered items directly
<MegaMenuRenderer items={items} pathname="/products" />
<FooterMenuRenderer items={footerItems} pathname="/" />
```

## Mega Menu Data Shape

The mega menu uses a 3-level hierarchy:

```
Level 0 → Top bar triggers (e.g. "Platform", "Solutions")
Level 1 → Column headers in dropdown (e.g. "Products", "Features")
Level 2 → Links within columns (e.g. "Claude", "Claude Code")
```

Items with `image` show a thumbnail. Items with `newTab: true` get an external-link icon. Items with `description` show
it as secondary text below the name.

```ts
const items: MenuItemDto[] = [
    { id: 'platform', name: 'Platform', link: '#', menuId: 'm1' },
    { id: 'products', name: 'Products', link: '#', menuId: 'm1', parentId: 'platform' },
    {
        id: 'claude',
        name: 'Claude',
        link: '/claude',
        menuId: 'm1',
        parentId: 'products',
        image: '/icons/claude.svg',
        description: 'AI assistant',
    },
    { id: 'code', name: 'Claude Code', link: '/code', menuId: 'm1', parentId: 'products' },
];
```

## Footer Menu Data Shape

The footer renderer uses a 2-level hierarchy:

```
Level 0 → Column headers (e.g. "Company", "Product", "Resources")
Level 1 → Links under each column
```

Top-level items without children render as standalone links.

## API

| Method | Endpoint                      | Description                   |
| ------ | ----------------------------- | ----------------------------- |
| GET    | `/api/menus/sidebar`          | Public: resolved sidebar menu |
| GET    | `/api/ottaorm/menus`          | List menus (admin)            |
| POST   | `/api/ottaorm/menus`          | Create menu                   |
| PATCH  | `/api/ottaorm/menus/:id`      | Update menu                   |
| DELETE | `/api/ottaorm/menus/:id`      | Delete menu                   |
| POST   | `/api/ottaorm/menu_items`     | Create item                   |
| PATCH  | `/api/ottaorm/menu_items/:id` | Update item                   |
| DELETE | `/api/ottaorm/menu_items/:id` | Delete item                   |

## Schema

- **menus**: id, appId, name, slug, type (`sidebar|flyout|mega|navbar|dropdown|footer`), isDefault
- **menu_items**: id, menuId, parentId, appId, name, link, newTab, authRequired, description, image, tooltip, sortOrder
