# @ottabase/ottamenu — agent notes

Pure menu types, tree utilities, and six React menu renderers. Full docs: ./README.md

## Use when

- Rendering navigation menus in React from `MenuItemDto` data, or menus assigned to layout slots.
- Building a nested tree from flat menu items (`buildItemTree`).
- NOT for menu persistence, schema, or CRUD — those live in `@ottabase/brand-engine`.

## Imports

    import { renderMenu, MenuRenderer, MenuSlotRenderer, buildItemTree } from '@ottabase/ottamenu';
    import type { MenuItemDto, MenuRenderType, MenuWithItemsDto, MenuItemTreeNode, MenuForRender, RenderMenuOptions, ResolvedMenuSlotData } from '@ottabase/ottamenu';
    import { SidebarMenuRenderer, FlyoutMenuRenderer, MegaMenuRenderer, NavbarMenuRenderer, DropdownMenuRenderer, FooterMenuRenderer, MenuItemLink } from '@ottabase/ottamenu/render';

## Canonical usage

Render a menu by type (component form preferred; `renderMenu(menu, type, options)` wraps it):

    <MenuRenderer
        menu={{ items: menuItemDtos }}
        type='navbar'
        options={{ isAuthenticated, pathname: location.pathname }}
    />

Render whatever menu is assigned to a named layout slot (data from brand API response):

    <MenuSlotRenderer
        slot='header-nav'
        menuSlots={brandConfig.menuSlots}
        options={{ isAuthenticated: true, pathname: location.pathname }}
        fallback={<StaticNav />}
    />

Build a nested tree from flat items (siblings sorted by `sortOrder`, then name):

    const tree: MenuItemTreeNode[] = buildItemTree(items); // orphans/cycles become roots

## Gotchas

- Peer deps: consumer must install both `react` and `@tanstack/react-router` (use `catalog:`).
- `authRequired` items are silently hidden unless `options.isAuthenticated` is true.
- Active-link highlighting only works if you pass `options.pathname`.
- `MenuRenderer` returns null for a null menu or zero visible items — provide your own fallback (`MenuSlotRenderer` has a `fallback` prop).
- `MenuRenderType` is `'sidebar' | 'flyout' | 'mega' | 'navbar' | 'dropdown' | 'footer'`.
