// ---------------------------------------------------------------------------
// Ottamenu – Single menu item link (internal, used by renderers)
// ---------------------------------------------------------------------------

import { Link } from '@tanstack/react-router';
import type { MenuItemDto } from '../persistence/types';

export interface MenuItemLinkProps {
    item: MenuItemDto;
    pathname: string;
    /** Additional classes for the link (e.g. block for flyout) */
    className?: string;
    /** Custom children to render inside the link instead of just item.name */
    renderChildren?: React.ReactNode;
}

/**
 * Renders a single menu item as Link or external anchor.
 * Handles active state, newTab, tooltip.
 */
export function MenuItemLink({ item, pathname, className = '', renderChildren }: MenuItemLinkProps) {
    // Hash-only or empty links (used as parent-only placeholders) are never active
    const isActive =
        item.link !== '#' &&
        item.link !== '' &&
        (pathname === item.link || (item.link !== '/' && pathname.startsWith(item.link + '/')));
    const baseClass = 'px-3 py-2 text-sm rounded-md transition-colors ' + className;
    const linkClass = `${baseClass} ${
        isActive
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
    }`;

    if (item.newTab) {
        return (
            <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
                title={item.tooltip ?? undefined}
            >
                {renderChildren ?? item.name}
            </a>
        );
    }

    return (
        <Link to={item.link} className={linkClass} title={item.tooltip ?? undefined}>
            {renderChildren ?? item.name}
        </Link>
    );
}
