// ---------------------------------------------------------------------------
// Ottamenu – Navbar (horizontal) menu renderer
// Horizontal nav bar with simple single-column dropdowns for nested items.
// Common pattern for site headers / top navigation.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildItemTree, type MenuItemTreeNode } from '../treeUtils';
import type { MenuItemDto } from '../types';
import { MenuItemLink } from './MenuItemLink';

export interface NavbarMenuRendererProps {
    items: MenuItemDto[];
    pathname: string;
    /** When true, renders all dropdowns expanded inline (no hover, no absolute). Useful for previews. */
    expanded?: boolean;
}

// ── Dropdown item with optional image ────────────────────────────────────
function NavbarDropdownItem({ item, pathname }: { item: MenuItemDto; pathname: string }) {
    return (
        <div className="flex items-center gap-2">
            {item.image && <img src={item.image} alt="" className="h-4 w-4 shrink-0 rounded object-cover" />}
            <MenuItemLink item={item} pathname={pathname} className="block w-full" />
        </div>
    );
}

// ── Single top-level nav item (with optional dropdown) ───────────────────
function NavbarItem({
    node,
    pathname,
    isOpen,
    onOpen,
    onClose,
}: {
    node: MenuItemTreeNode;
    pathname: string;
    isOpen: boolean;
    onOpen: (id: string) => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const handleOpen = useCallback(() => onOpen(node.item.id), [onOpen, node.item.id]);

    useEffect(() => {
        if (!isOpen) return;
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                onClose();
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isOpen, onClose]);

    const hasChildren = node.children.length > 0;

    // Leaf: plain link
    if (!hasChildren) {
        return <MenuItemLink item={node.item} pathname={pathname} className="whitespace-nowrap" />;
    }

    return (
        <div ref={ref} className="relative" onMouseEnter={handleOpen} onMouseLeave={onClose}>
            <button
                type="button"
                className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors ${
                    isOpen ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={isOpen ? onClose : handleOpen}
            >
                {node.item.image && (
                    <img src={node.item.image} alt="" className="mr-1.5 h-4 w-4 shrink-0 rounded object-cover" />
                )}
                {node.item.name}
                <svg
                    className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                >
                    <path
                        fillRule="evenodd"
                        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                        clipRule="evenodd"
                    />
                </svg>
            </button>

            {/* Simple single-column dropdown */}
            {isOpen && (
                <div className="absolute left-0 top-full z-50 pt-1">
                    <div className="min-w-[180px] rounded-lg border bg-popover p-1 shadow-md">
                        {node.children.map((child) => (
                            <NavbarDropdownItem key={child.item.id} item={child.item} pathname={pathname} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Renders a horizontal navigation bar. Top-level items are laid out inline;
 * items with children show a single-column dropdown on hover/click.
 * Supports images on both top-level and child items.
 */
export function NavbarMenuRenderer({ items, pathname, expanded = false }: NavbarMenuRendererProps) {
    const tree = useMemo(() => buildItemTree(items), [items]);
    const [openId, setOpenId] = useState<string | null>(null);

    const handleOpen = useCallback((id: string) => setOpenId(id), []);
    const handleClose = useCallback(() => setOpenId(null), []);

    // Expanded / static mode: render all dropdowns inline (for preview panels)
    if (expanded) {
        return (
            <nav className="flex flex-col gap-2">
                {tree.map((node) => (
                    <div key={node.item.id}>
                        <MenuItemLink item={node.item} pathname={pathname} className="font-medium" />
                        {node.children.length > 0 && (
                            <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-muted pl-2">
                                {node.children.map((child) => (
                                    <NavbarDropdownItem key={child.item.id} item={child.item} pathname={pathname} />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>
        );
    }

    return (
        <nav className="flex items-center gap-1">
            {tree.map((node) => (
                <NavbarItem
                    key={node.item.id}
                    node={node}
                    pathname={pathname}
                    isOpen={openId === node.item.id}
                    onOpen={handleOpen}
                    onClose={handleClose}
                />
            ))}
        </nav>
    );
}
