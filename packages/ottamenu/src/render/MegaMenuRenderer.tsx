// ---------------------------------------------------------------------------
// Ottamenu – Mega menu renderer
// Multi-column dropdown panel. Top-level items become column headers;
// children are links beneath. Supports images + descriptions on items.
// Inspired by Anthropic / GitHub / Notion style mega-menus.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildItemTree, type MenuItemTreeNode } from '../treeUtils';
import type { MenuItemDto } from '../types';
import { MenuItemLink } from './MenuItemLink';

export interface MegaMenuRendererProps {
    items: MenuItemDto[];
    pathname: string;
    /** When true, renders all panels expanded inline (no hover, no absolute). Useful for previews. */
    expanded?: boolean;
}

// ── Column item (child link with optional image + description) ───────────
function MegaMenuItem({ item, pathname }: { item: MenuItemDto; pathname: string }) {
    const hasImage = !!item.image;
    const hasDescription = !!item.description;

    return (
        <div className="group/mega-item">
            <MenuItemLink
                item={item}
                pathname={pathname}
                className={`flex items-start gap-3 rounded-md px-3 py-2 ${hasImage || hasDescription ? '!py-2.5' : ''}`}
                renderChildren={
                    <>
                        {/* Image thumbnail (left of text) rendered via slot */}
                        {hasImage && (
                            <img src={item.image!} alt="" className="mt-0.5 h-5 w-5 shrink-0 rounded object-cover" />
                        )}
                        <span className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1.5 text-sm font-medium leading-tight">
                                {item.name}
                                {/* External link icon for newTab items */}
                                {item.newTab && (
                                    <svg
                                        className="h-3 w-3 shrink-0 opacity-50"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 16 16"
                                        fill="currentColor"
                                    >
                                        <path d="M3.75 2a.75.75 0 0 0 0 1.5h6.69L2.72 11.22a.75.75 0 1 0 1.06 1.06L11.5 4.56v6.69a.75.75 0 0 0 1.5 0V2.75a.75.75 0 0 0-.75-.75H3.75Z" />
                                    </svg>
                                )}
                            </span>
                            {hasDescription && (
                                <span className="text-xs leading-snug text-muted-foreground">{item.description}</span>
                            )}
                        </span>
                    </>
                }
            />
        </div>
    );
}

// ── Column (one group: header + child links) ─────────────────────────────
function MegaMenuColumn({ node, pathname }: { node: MenuItemTreeNode; pathname: string }) {
    const hasImage = !!node.item.image;

    return (
        <div className="flex flex-col gap-1">
            {/* Column header – optionally with image */}
            <div className="flex items-center gap-2 px-3 pb-1">
                {hasImage && <img src={node.item.image!} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />}
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {node.item.name}
                </span>
            </div>

            {/* Child items */}
            <div className="flex flex-col">
                {node.children.map((child) => (
                    <MegaMenuItem key={child.item.id} item={child.item} pathname={pathname} />
                ))}
            </div>
        </div>
    );
}

// ── Panel (the dropdown content) ─────────────────────────────────────────
function MegaMenuPanel({ columns, pathname }: { columns: MenuItemTreeNode[]; pathname: string }) {
    return (
        <div className="rounded-lg border bg-popover p-4 shadow-lg">
            <div className="flex gap-8">
                {columns.map((col) => (
                    <MegaMenuColumn key={col.item.id} node={col} pathname={pathname} />
                ))}
            </div>
        </div>
    );
}

// ── Trigger item in the top bar ──────────────────────────────────────────
function MegaMenuTrigger({
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

    // Close on click outside
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

    // Leaf item (no children) – render as plain link
    if (!hasChildren) {
        return (
            <div className="relative">
                <MenuItemLink item={node.item} pathname={pathname} className="whitespace-nowrap" />
            </div>
        );
    }

    return (
        <div ref={ref} className="relative" onMouseEnter={handleOpen} onMouseLeave={onClose}>
            {/* Trigger button with chevron */}
            <button
                type="button"
                className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm transition-colors ${
                    isOpen ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={isOpen ? onClose : handleOpen}
            >
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

            {/* Dropdown panel – absolutely positioned */}
            {isOpen && (
                <div className="absolute left-0 top-full z-50 pt-2">
                    <MegaMenuPanel columns={node.children} pathname={pathname} />
                </div>
            )}
        </div>
    );
}

/**
 * Renders a mega menu: horizontal top-level items with multi-column dropdown panels.
 *
 * Data shape:
 * - Level 0: top bar items (triggers) — e.g. "Platform", "Solutions"
 * - Level 1: column headers within dropdown — e.g. "Products", "Features"
 * - Level 2: links within columns — e.g. "Claude", "Claude Code"
 *
 * Items with images show them as thumbnails. Items with `newTab` get an external-link icon.
 */
export function MegaMenuRenderer({ items, pathname, expanded = false }: MegaMenuRendererProps) {
    const tree = useMemo(() => buildItemTree(items), [items]);
    const [openId, setOpenId] = useState<string | null>(null);

    const handleOpen = useCallback((id: string) => setOpenId(id), []);
    const handleClose = useCallback(() => setOpenId(null), []);

    // Expanded / static mode: render all panels inline (for preview panels)
    if (expanded) {
        return (
            <nav className="flex flex-col gap-4">
                {tree.map((node) =>
                    node.children.length > 0 ? (
                        <div key={node.item.id}>
                            <div className="mb-1 px-1 text-sm font-medium text-foreground">{node.item.name}</div>
                            <MegaMenuPanel columns={node.children} pathname={pathname} />
                        </div>
                    ) : (
                        <MenuItemLink key={node.item.id} item={node.item} pathname={pathname} />
                    ),
                )}
            </nav>
        );
    }

    return (
        <nav className="flex items-center gap-1">
            {tree.map((node) => (
                <MegaMenuTrigger
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
