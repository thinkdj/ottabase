// ---------------------------------------------------------------------------
// Ottamenu – Render types
// ---------------------------------------------------------------------------

import type { MenuItemDto } from '../persistence/types';

export type MenuRenderType = 'sidebar' | 'flyout' | 'mega' | 'navbar' | 'dropdown' | 'footer';

export interface RenderMenuOptions {
    /** Filter out authRequired items when false */
    isAuthenticated?: boolean;
    /** Current pathname for active state */
    pathname?: string;
    /** Optional width class for sidebar (w-48, w-56, w-64, w-80) */
    widthClass?: string;
    /** Render all dropdowns expanded inline (useful for narrow preview panels) */
    expanded?: boolean;
}

/** Menu data shape for rendering (items array) */
export interface MenuForRender {
    items: MenuItemDto[];
}
