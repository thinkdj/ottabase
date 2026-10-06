// ---------------------------------------------------------------------------
// Ottamenu, Render types
// ---------------------------------------------------------------------------

import type { MenuItemDto } from '../types';

export type { MenuRenderType } from '../types';

export interface RenderMenuOptions {
    /** Filter out authRequired items when false */
    isAuthenticated?: boolean;
    /** Current pathname for active state */
    pathname?: string;
    /** Render all dropdowns expanded inline (useful for narrow preview panels) */
    expanded?: boolean;
}

/** Menu data shape for rendering (items array) */
export interface MenuForRender {
    items: MenuItemDto[];
}
