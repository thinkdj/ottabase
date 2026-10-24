'use client';

import * as React from 'react';
import { useControllableState } from '@radix-ui/react-use-controllable-state';
import { ChevronRight } from 'lucide-react';

import { cn } from '@ottabase/ui/lib/utils';

/*
 * A tree of nested items: menus, folders, a permission set. It is the
 * WAI-ARIA tree pattern, rendered flat: every visible item is a treeitem in
 * one list carrying aria-level/-setsize/-posinset, so each row is its own
 * focus target and the focus ring hugs the row, not its subtree.
 *
 * Keyboard: one tab stop (roving tabindex). Up/Down move, Right opens a
 * branch or steps into it, Left closes it or steps out to the parent,
 * Home/End jump, Enter selects (and opens or closes a branch), Space selects,
 * and typing a few letters jumps to the next item that starts with them.
 * The pointer: a click selects, the chevron or a double click opens.
 *
 * Indent guides are a hairline per ancestor, drawn inside each row so they
 * stay continuous down a branch, as the Design System's `.tree` does with
 * its left border. Theming hooks: data-slot on the tree and each part,
 * data-state="selected" on the selected item.
 */

export interface TreeNode {
    id: string;
    label: React.ReactNode;
    /** The text type-ahead matches; needed when `label` is not a string. */
    textValue?: string;
    icon?: React.ReactNode;
    children?: TreeNode[];
    /** Focusable, but it can be neither selected nor opened. */
    disabled?: boolean;
}

export interface TreeItemState {
    level: number;
    isBranch: boolean;
    expanded: boolean;
    selected: boolean;
    disabled: boolean;
}

export interface TreeViewProps<T extends TreeNode = TreeNode> extends Omit<
    React.HTMLAttributes<HTMLUListElement>,
    'children' | 'onSelect' | 'defaultValue'
> {
    items: T[];
    /** Ids of the open branches. */
    expanded?: string[];
    defaultExpanded?: string[];
    onExpandedChange?: (expanded: string[]) => void;
    selected?: string | null;
    defaultSelected?: string | null;
    onSelectedChange?: (id: string | null, node: T | null) => void;
    /** Off for a tree that is only for reading and opening (no selected item). */
    selectable?: boolean;
    /** Replaces the label: add a count, a badge or an action beside it. */
    renderItem?: (node: T, state: TreeItemState) => React.ReactNode;
    ref?: React.Ref<HTMLUListElement>;
}

interface Row<T extends TreeNode> {
    node: T;
    level: number;
    posinset: number;
    setsize: number;
    parentId: string | null;
    isBranch: boolean;
}

const isBranchNode = (node: TreeNode) => Array.isArray(node.children) && node.children.length > 0;
const textOf = (node: TreeNode) => (node.textValue ?? (typeof node.label === 'string' ? node.label : '')).toLowerCase();

/** The rows a person can see: each item, then its children when it is open. */
function visibleRows<T extends TreeNode>(
    items: T[],
    open: ReadonlySet<string>,
    level = 1,
    parentId: string | null = null,
    out: Row<T>[] = [],
): Row<T>[] {
    items.forEach((node, index) => {
        const isBranch = isBranchNode(node);
        out.push({ node, level, posinset: index + 1, setsize: items.length, parentId, isBranch });
        if (isBranch && open.has(node.id)) visibleRows(node.children as T[], open, level + 1, node.id, out);
    });
    return out;
}

function indexNodes<T extends TreeNode>(items: T[], map = new Map<string, T>()): Map<string, T> {
    for (const node of items) {
        map.set(node.id, node);
        if (node.children) indexNodes(node.children as T[], map);
    }
    return map;
}

const TYPEAHEAD_RESET_MS = 500;

function TreeView<T extends TreeNode = TreeNode>({
    items,
    expanded: expandedProp,
    defaultExpanded,
    onExpandedChange,
    selected: selectedProp,
    defaultSelected,
    onSelectedChange,
    selectable = true,
    renderItem,
    className,
    ...props
}: TreeViewProps<T>) {
    const nodes = React.useMemo(() => indexNodes(items), [items]);

    const [expanded = [], setExpanded] = useControllableState<string[]>({
        prop: expandedProp,
        defaultProp: defaultExpanded ?? [],
        onChange: onExpandedChange,
    });
    const [selected = null, setSelected] = useControllableState<string | null>({
        prop: selectedProp,
        defaultProp: defaultSelected ?? null,
        onChange: (id) => onSelectedChange?.(id, id ? (nodes.get(id) ?? null) : null),
    });

    const open = React.useMemo(() => new Set(expanded), [expanded]);
    const rows = React.useMemo(() => visibleRows(items, open), [items, open]);

    const [focusedId, setFocusedId] = React.useState<string | null>(null);
    const itemRefs = React.useRef(new Map<string, HTMLLIElement>());
    const typeahead = React.useRef<{ query: string; timer?: ReturnType<typeof setTimeout> }>({ query: '' });
    React.useEffect(() => () => clearTimeout(typeahead.current.timer), []);

    // The one tab stop: the focused item while it is visible, else the selected one, else the first
    const isVisible = (id: string | null): id is string => !!id && rows.some((row) => row.node.id === id);
    const tabStop = isVisible(focusedId) ? focusedId : isVisible(selected) ? selected : rows[0]?.node.id;

    const focusItem = (id: string | undefined) => {
        if (!id) return;
        setFocusedId(id);
        itemRefs.current.get(id)?.focus();
    };

    const setOpen = (id: string, next: boolean) => {
        if (open.has(id) === next) return;
        setExpanded(next ? [...expanded, id] : expanded.filter((openId) => openId !== id));
    };

    const select = (node: T) => {
        if (selectable && !node.disabled) setSelected(node.id);
    };

    const toggle = (row: Row<T>) => {
        if (row.isBranch && !row.node.disabled) setOpen(row.node.id, !open.has(row.node.id));
    };

    const jumpByText = (key: string, from: number) => {
        const state = typeahead.current;
        clearTimeout(state.timer);
        state.query += key.toLowerCase();
        state.timer = setTimeout(() => (state.query = ''), TYPEAHEAD_RESET_MS);

        // One letter, or the same letter pressed again, cycles through the items that start with it;
        // different letters refine the match from the current item
        const repeated = [...state.query].every((char) => char === state.query[0]);
        const search = repeated ? state.query[0] : state.query;
        const start = repeated ? from + 1 : from;
        for (let offset = 0; offset < rows.length; offset++) {
            const row = rows[(start + offset) % rows.length];
            if (textOf(row.node).startsWith(search)) return focusItem(row.node.id);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLLIElement>, index: number) => {
        const row = rows[index];
        const { node } = row;
        let handled = true;

        switch (event.key) {
            case 'ArrowDown':
                focusItem(rows[index + 1]?.node.id);
                break;
            case 'ArrowUp':
                focusItem(rows[index - 1]?.node.id);
                break;
            case 'ArrowRight':
                if (row.isBranch && !node.disabled && !open.has(node.id)) setOpen(node.id, true);
                else if (row.isBranch && open.has(node.id)) focusItem(rows[index + 1]?.node.id);
                break;
            case 'ArrowLeft':
                if (row.isBranch && open.has(node.id)) setOpen(node.id, false);
                else focusItem(row.parentId ?? undefined);
                break;
            case 'Home':
                focusItem(rows[0]?.node.id);
                break;
            case 'End':
                focusItem(rows[rows.length - 1]?.node.id);
                break;
            case 'Enter':
                select(node);
                toggle(row);
                break;
            case ' ':
                select(node);
                break;
            default:
                handled = false;
                if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
                    jumpByText(event.key, index);
                    handled = true;
                }
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    return (
        <ul role="tree" data-slot="tree-view" className={cn('flex flex-col text-sm', className)} {...props}>
            {rows.map((row, index) => {
                const { node, level, isBranch } = row;
                const isOpen = isBranch && open.has(node.id);
                const isSelected = selectable && selected === node.id;
                const disabled = !!node.disabled;

                return (
                    <li
                        key={node.id}
                        ref={(element) => {
                            if (element) itemRefs.current.set(node.id, element);
                            else itemRefs.current.delete(node.id);
                        }}
                        role="treeitem"
                        aria-level={level}
                        aria-setsize={row.setsize}
                        aria-posinset={row.posinset}
                        aria-expanded={isBranch ? isOpen : undefined}
                        aria-selected={selectable ? isSelected : undefined}
                        aria-disabled={disabled || undefined}
                        tabIndex={node.id === tabStop ? 0 : -1}
                        data-slot="tree-item"
                        data-state={isSelected ? 'selected' : undefined}
                        className={cn(
                            'group/tree-item flex h-8 cursor-default select-none items-center gap-1.5 rounded-md pl-1.5 pr-2 text-subtle-foreground transition duration-fast ease-theme focus-visible:-outline-offset-2',
                            isSelected
                                ? 'bg-accent font-medium text-accent-foreground'
                                : 'hover:bg-muted hover:text-foreground',
                            disabled && 'opacity-50',
                        )}
                        onFocus={(event) => {
                            if (event.target === event.currentTarget) setFocusedId(node.id);
                        }}
                        onClick={() => select(node)}
                        onDoubleClick={() => toggle(row)}
                        onKeyDown={(event) => handleKeyDown(event, index)}
                    >
                        {Array.from({ length: level - 1 }, (_, depth) => (
                            <span
                                key={depth}
                                aria-hidden="true"
                                data-slot="tree-guide"
                                className="relative w-4 shrink-0 self-stretch before:absolute before:inset-y-0 before:left-1/2 before:w-px before:bg-border"
                            />
                        ))}
                        {isBranch ? (
                            <span
                                aria-hidden="true"
                                data-slot="tree-toggle"
                                className="grid size-4 shrink-0 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:text-foreground"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    toggle(row);
                                }}
                                onDoubleClick={(event) => event.stopPropagation()}
                            >
                                <ChevronRight className="size-3.5 transition-transform duration-fast ease-theme group-aria-expanded/tree-item:rotate-90" />
                            </span>
                        ) : (
                            <span aria-hidden="true" className="size-4 shrink-0" />
                        )}
                        {node.icon ? (
                            <span
                                aria-hidden="true"
                                data-slot="tree-icon"
                                className={cn(
                                    'flex shrink-0 [&_svg]:size-4',
                                    isSelected ? 'text-accent-foreground' : 'text-muted-foreground',
                                )}
                            >
                                {node.icon}
                            </span>
                        ) : null}
                        <span data-slot="tree-label" className="min-w-0 flex-1 truncate">
                            {renderItem
                                ? renderItem(node, {
                                      level,
                                      isBranch,
                                      expanded: isOpen,
                                      selected: isSelected,
                                      disabled,
                                  })
                                : node.label}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}
TreeView.displayName = 'TreeView';

export { TreeView };
