// ---------------------------------------------------------------------------
// Ottamenu – renderMenu(menu, type) + MenuRenderer component
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import { DropdownMenuRenderer } from './DropdownMenuRenderer';
import { FlyoutMenuRenderer } from './FlyoutMenuRenderer';
import { FooterMenuRenderer } from './FooterMenuRenderer';
import { MegaMenuRenderer } from './MegaMenuRenderer';
import { NavbarMenuRenderer } from './NavbarMenuRenderer';
import { SidebarMenuRenderer } from './SidebarMenuRenderer';
import type { MenuForRender, MenuRenderType, RenderMenuOptions } from './types';

export { DropdownMenuRenderer } from './DropdownMenuRenderer';
export { FlyoutMenuRenderer } from './FlyoutMenuRenderer';
export { FooterMenuRenderer } from './FooterMenuRenderer';
export { MegaMenuRenderer } from './MegaMenuRenderer';
export { MenuItemLink } from './MenuItemLink';
export { NavbarMenuRenderer } from './NavbarMenuRenderer';
export { SidebarMenuRenderer } from './SidebarMenuRenderer';
export type { MenuForRender, MenuRenderType, RenderMenuOptions } from './types';

export interface MenuRendererProps {
    menu: MenuForRender | null;
    type: MenuRenderType;
    options?: RenderMenuOptions;
}

/**
 * Component form of renderMenu. Uses useMemo for filtered items to avoid
 * unnecessary re-renders when menu/auth state is unchanged.
 */
export function MenuRenderer({ menu, type, options = {} }: MenuRendererProps) {
    const { isAuthenticated = false, pathname = '', expanded = false } = options;
    const items = useMemo(
        () => (menu ? menu.items.filter((item) => !item.authRequired || isAuthenticated) : []),
        [menu, isAuthenticated],
    );

    if (!menu) return null;
    if (items.length === 0) return null;

    switch (type) {
        case 'sidebar':
            return <SidebarMenuRenderer items={items} pathname={pathname} />;
        case 'flyout':
            return <FlyoutMenuRenderer items={items} pathname={pathname} />;
        case 'mega':
            return <MegaMenuRenderer items={items} pathname={pathname} expanded={expanded} />;
        case 'navbar':
            return <NavbarMenuRenderer items={items} pathname={pathname} expanded={expanded} />;
        case 'dropdown':
            return <DropdownMenuRenderer items={items} pathname={pathname} />;
        case 'footer':
            return <FooterMenuRenderer items={items} pathname={pathname} />;
        default:
            return null;
    }
}

/**
 * Render menu by type. Returns React nodes for the given menu and render type.
 * When menu is null, returns null (caller should use fallback e.g. NAV_LINKS_ALL).
 * Delegates to MenuRenderer for proper memoization.
 */
export function renderMenu(
    menu: MenuForRender | null,
    type: MenuRenderType,
    options: RenderMenuOptions = {},
): React.ReactNode {
    return <MenuRenderer menu={menu} type={type} options={options} />;
}
