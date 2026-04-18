// ---------------------------------------------------------------------------
// Ottamenu – Flyout menu renderer
// Modern flyout menu: top-level horizontal nav with nested flyout panels.
// ---------------------------------------------------------------------------

import { useMemo, useState } from 'react';
import { buildItemTree, type MenuItemTreeNode } from '../treeUtils';
import type { MenuItemDto } from '../types';
import { MenuItemLink } from './MenuItemLink';

export interface FlyoutMenuRendererProps {
    items: MenuItemDto[];
    pathname: string;
}

function FlyoutChevron({ isOpen }: { isOpen: boolean }) {
    return (
        <svg
            className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
        >
            <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
            />
        </svg>
    );
}

/**
 * Single flyout node with nested flyout panels.
 */
function FlyoutNode({
    node,
    depth,
    pathname,
    openPath,
    onOpenAtDepth,
    onCloseFromDepth,
}: {
    node: MenuItemTreeNode;
    depth: number;
    pathname: string;
    openPath: string[];
    onOpenAtDepth: (depth: number, id: string) => void;
    onCloseFromDepth: (depth: number) => void;
}) {
    const isOpen = openPath[depth] === node.item.id;
    const hasChildren = node.children.length > 0;

    return (
        <div
            className="relative"
            onMouseEnter={() => hasChildren && onOpenAtDepth(depth, node.item.id)}
            onMouseLeave={() => hasChildren && onCloseFromDepth(depth + 1)}
        >
            {hasChildren ? (
                <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                        isOpen
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`}
                    onClick={() => (isOpen ? onCloseFromDepth(depth) : onOpenAtDepth(depth, node.item.id))}
                >
                    <span className="truncate">{node.item.name}</span>
                    <FlyoutChevron isOpen={isOpen} />
                </button>
            ) : (
                <MenuItemLink item={node.item} pathname={pathname} className="block" />
            )}

            {hasChildren && isOpen && (
                <div
                    className={
                        depth === 0 ? 'absolute left-0 top-full z-50 mt-2' : 'absolute left-full top-0 z-50 ml-2'
                    }
                    style={{ zIndex: 50 + depth }}
                >
                    <div className="min-w-[220px] rounded-xl border bg-popover p-1.5 shadow-xl">
                        {node.children.map((child) => (
                            <FlyoutNode
                                key={child.item.id}
                                node={child}
                                depth={depth + 1}
                                pathname={pathname}
                                openPath={openPath}
                                onOpenAtDepth={onOpenAtDepth}
                                onCloseFromDepth={onCloseFromDepth}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/**
 * Renders a modern flyout menu (Vercel-style): compact top-level nav with hoverable flyout panels.
 */
export function FlyoutMenuRenderer({ items, pathname }: FlyoutMenuRendererProps) {
    const tree = useMemo(() => buildItemTree(items), [items]);
    const [openPath, setOpenPath] = useState<string[]>([]);

    const onOpenAtDepth = (depth: number, id: string) => {
        setOpenPath((prev) => {
            const next = prev.slice(0, depth);
            next[depth] = id;
            return next;
        });
    };

    const onCloseFromDepth = (depth: number) => {
        setOpenPath((prev) => prev.slice(0, depth));
    };

    return (
        <nav className="flex items-center gap-1 rounded-lg">
            {tree.map((node) => (
                <FlyoutNode
                    key={node.item.id}
                    node={node}
                    depth={0}
                    pathname={pathname}
                    openPath={openPath}
                    onOpenAtDepth={onOpenAtDepth}
                    onCloseFromDepth={onCloseFromDepth}
                />
            ))}
        </nav>
    );
}
