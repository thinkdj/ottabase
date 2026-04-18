// ---------------------------------------------------------------------------
// Ottamenu – MenuSlotRenderer: renders a menu in a named layout slot
// Uses resolved menu slot data from the brand API response.
// ---------------------------------------------------------------------------

import { useMemo } from 'react';
import type { MenuItemDto } from '../types';
import { MenuRenderer } from './index';
import type { MenuRenderType, RenderMenuOptions } from './types';

/** Shape of a resolved menu slot (matches brand API response) */
export interface ResolvedMenuSlotData {
    slotName: string;
    menuId: string;
    renderType: MenuRenderType;
    sortOrder: number;
    menu: {
        id: string;
        name: string;
        slug: string;
        type: string;
        items: MenuItemDto[];
    };
}

export interface MenuSlotRendererProps {
    /** Named slot to render (e.g. 'header-nav', 'sidebar-nav') */
    slot: string;
    /** Resolved menu slot data from brand API (Record<slotName, ResolvedMenuSlotData[]>) */
    menuSlots: Record<string, ResolvedMenuSlotData[]> | undefined | null;
    /** Render options (auth state, pathname, etc.) */
    options?: RenderMenuOptions;
    /** Override render type (uses slot assignment's renderType if not specified) */
    renderType?: MenuRenderType;
    /** Optional className wrapper */
    className?: string;
    /** Fallback content when no menu is assigned to this slot */
    fallback?: React.ReactNode;
}

/**
 * Renders the menu(s) assigned to a named layout slot.
 * Reads from resolved brand API data — no additional fetch needed.
 *
 * ```tsx
 * // In your layout:
 * <MenuSlotRenderer
 *   slot="header-nav"
 *   menuSlots={brandConfig.menuSlots}
 *   options={{ isAuthenticated: true, pathname: location.pathname }}
 * />
 * ```
 */
export function MenuSlotRenderer({
    slot,
    menuSlots,
    options = {},
    renderType: renderTypeOverride,
    className,
    fallback,
}: MenuSlotRendererProps) {
    const slotMenus = useMemo(() => menuSlots?.[slot] ?? [], [menuSlots, slot]);

    if (slotMenus.length === 0) {
        return fallback ? <>{fallback}</> : null;
    }

    const content = slotMenus.map((slotMenu) => (
        <MenuRenderer
            key={slotMenu.menuId}
            menu={{ items: slotMenu.menu.items }}
            type={renderTypeOverride ?? slotMenu.renderType}
            options={options}
        />
    ));

    if (className) {
        return <div className={className}>{content}</div>;
    }

    return <>{content}</>;
}
