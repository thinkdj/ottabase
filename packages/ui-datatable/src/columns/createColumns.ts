// ============================================================
// @ottabase/ui-datatable - Column Definition Helpers
// ============================================================
// Declarative column creation from simple config objects
// ============================================================

import type { CellContext, ColumnDef } from '@tanstack/react-table';
import React from 'react';
import type { DataTableAction, DataTableColumnDef } from '../types';
import { formatCellValue, truncateText } from '../utils/formatters';

/**
 * Create TanStack Table column definitions from a simplified config array.
 *
 * @example
 * ```tsx
 * const columns = createColumns<TodoType>([
 *     { key: 'title', header: 'Title', sortable: true },
 *     { key: 'completed', header: 'Done', format: 'boolean' },
 *     { key: 'createdAt', header: 'Created', format: 'datetime', sortable: true },
 * ]);
 * ```
 */
export function createColumns<TData extends Record<string, unknown>>(
    defs: DataTableColumnDef<TData>[],
): ColumnDef<TData, unknown>[] {
    return defs.map((def) => {
        const column: ColumnDef<TData, unknown> = {
            // Use the key as accessor
            accessorKey: def.key as string,
            id: def.key as string,

            // Header
            header: def.header,

            // Cell rendering
            cell: (info: CellContext<TData, unknown>) => {
                const value = info.getValue();
                const row = info.row.original;

                // Custom cell renderer takes priority
                if (def.cell) {
                    return def.cell({ row, value: value as TData[keyof TData] });
                }

                // Named format
                if (def.format) {
                    return formatCellValue(value, def.format);
                }

                // Null values
                if (value === null || value === undefined) {
                    return React.createElement('span', { className: 'text-muted-foreground' }, '—');
                }

                // Truncate long strings
                const str = String(value);
                if (def.truncate || def.maxLength) {
                    const maxLen = def.maxLength ?? 80;
                    return truncateText(str, maxLen);
                }

                return str;
            },

            // Sorting
            enableSorting: def.sortable ?? false,

            // Column visibility
            enableHiding: def.visible !== false,

            // Size
            size: typeof def.width === 'number' ? def.width : undefined,
            minSize: def.minWidth,
            maxSize: def.maxWidth,

            // Meta for our components
            meta: {
                align: def.align,
                className: def.className,
                headerClassName: def.headerClassName,
                editable: def.editable,
                onEdit: def.onEdit,
                filterable: def.filterable,
            },
        };

        return column;
    });
}

/**
 * Create a selection checkbox column (place first in columns array).
 *
 * @example
 * ```tsx
 * const columns = [selectColumn<TodoType>(), ...createColumns<TodoType>([...])];
 * ```
 */
export function selectColumn<TData>(): ColumnDef<TData, unknown> {
    return {
        id: '_select',
        header: ({ table }) =>
            React.createElement('input', {
                type: 'checkbox',
                checked: table.getIsAllPageRowsSelected(),
                onChange: table.getToggleAllPageRowsSelectedHandler(),
                'aria-label': 'Select all',
                className: 'h-4 w-4 rounded border-input bg-background text-primary focus:ring-ring',
            }),
        cell: ({ row }) =>
            React.createElement('input', {
                type: 'checkbox',
                checked: row.getIsSelected(),
                disabled: !row.getCanSelect(),
                onChange: row.getToggleSelectedHandler(),
                'aria-label': 'Select row',
                className: 'h-4 w-4 rounded border-input bg-background text-primary focus:ring-ring',
                onClick: (e: React.MouseEvent) => e.stopPropagation(),
            }),
        enableSorting: false,
        enableHiding: false,
        size: 40,
    };
}

/**
 * Create a row actions column (place last in columns array).
 *
 * Renders a dropdown menu with action items. Each action receives the row data.
 *
 * @example
 * ```tsx
 * const columns = [
 *     ...createColumns<TodoType>([...]),
 *     actionsColumn<TodoType>([
 *         { label: 'Edit', onClick: (row) => openEdit(row) },
 *         { label: 'Delete', variant: 'destructive', onClick: (row) => remove(row.id) },
 *     ]),
 * ];
 * ```
 */
export function actionsColumn<TData>(
    actions: DataTableAction<TData>[],
    options?: {
        /** Column header (defaults to empty) */
        header?: string;
        /** Column ID (defaults to '_actions') */
        id?: string;
    },
): ColumnDef<TData, unknown> {
    return {
        id: options?.id ?? '_actions',
        header: options?.header ?? '',
        enableSorting: false,
        enableHiding: false,
        size: 60,
        cell: ({ row }) => {
            const data = row.original;
            const visibleActions = actions.filter((a) => !a.hidden?.(data));

            if (visibleActions.length === 0) return null;

            // Render inline buttons for 1-2 actions, dropdown for more
            if (visibleActions.length <= 2) {
                return React.createElement(
                    'div',
                    {
                        className: 'flex items-center justify-end gap-1',
                        onClick: (e: React.MouseEvent) => e.stopPropagation(),
                    },
                    ...visibleActions.map((action, i) =>
                        React.createElement(
                            'button',
                            {
                                key: i,
                                onClick: () => action.onClick(data),
                                disabled: action.disabled?.(data),
                                className: `inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                                    action.variant === 'destructive'
                                        ? 'text-destructive hover:bg-destructive/10'
                                        : 'text-foreground hover:bg-accent'
                                } disabled:pointer-events-none disabled:opacity-50`,
                                title: action.label,
                            },
                            action.icon ? React.createElement(action.icon, { className: 'h-3.5 w-3.5' }) : null,
                            React.createElement('span', null, action.label),
                        ),
                    ),
                );
            }

            // For 3+ actions, render a dropdown trigger (the DataTable component handles
            // wrapping this in a proper DropdownMenu). We use a data attribute to pass
            // actions through to the component layer.
            return React.createElement(
                'div',
                {
                    className: 'flex items-center justify-end',
                    onClick: (e: React.MouseEvent) => e.stopPropagation(),
                    'data-actions': 'true',
                },
                React.createElement(ActionsDropdown as React.FC<{ actions: DataTableAction<TData>[]; data: TData }>, {
                    actions: visibleActions,
                    data,
                }),
            );
        },
    };
}

/**
 * Simple actions dropdown component (self-contained, no shadcn dependency).
 * Uses fixed positioning to escape overflow-hidden table containers.
 */
function ActionsDropdown<TData>({ actions, data }: { actions: DataTableAction<TData>[]; data: TData }) {
    const [open, setOpen] = React.useState(false);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);
    const [pos, setPos] = React.useState({ top: 0, right: 0 });

    // Compute dropdown position from the trigger button's viewport rect
    React.useEffect(() => {
        if (!open || !triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setPos({
            top: rect.bottom + 4,
            right: window.innerWidth - rect.right,
        });
    }, [open]);

    // Close on outside click
    React.useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                triggerRef.current &&
                !triggerRef.current.contains(target) &&
                menuRef.current &&
                !menuRef.current.contains(target)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Close on scroll so the menu doesn't float in the wrong spot
    React.useEffect(() => {
        if (!open) return;
        const handler = () => setOpen(false);
        window.addEventListener('scroll', handler, true);
        return () => window.removeEventListener('scroll', handler, true);
    }, [open]);

    // Close on Escape key
    React.useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open]);

    return React.createElement(
        React.Fragment,
        null,
        // Trigger button
        React.createElement(
            'button',
            {
                ref: triggerRef,
                onClick: () => setOpen(!open),
                className:
                    'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
                'aria-label': 'Row actions',
            },
            React.createElement(
                'svg',
                {
                    className: 'h-4 w-4',
                    fill: 'none',
                    stroke: 'currentColor',
                    viewBox: '0 0 24 24',
                    strokeWidth: 2,
                },
                React.createElement('circle', { cx: 12, cy: 5, r: 1 }),
                React.createElement('circle', { cx: 12, cy: 12, r: 1 }),
                React.createElement('circle', { cx: 12, cy: 19, r: 1 }),
            ),
        ),
        // Dropdown menu — rendered with fixed positioning to escape overflow-hidden ancestors
        open &&
            React.createElement(
                'div',
                {
                    ref: menuRef,
                    className:
                        'fixed z-50 min-w-[140px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
                    style: { top: `${pos.top}px`, right: `${pos.right}px` },
                },
                ...actions.map((action, i) => {
                    const items: React.ReactNode[] = [];

                    // Separator
                    if (action.separator && i > 0) {
                        items.push(
                            React.createElement('div', {
                                key: `sep-${i}`,
                                className: '-mx-1 my-1 h-px bg-border',
                            }),
                        );
                    }

                    items.push(
                        React.createElement(
                            'button',
                            {
                                key: i,
                                onClick: () => {
                                    action.onClick(data);
                                    setOpen(false);
                                },
                                disabled: action.disabled?.(data),
                                className: `flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors ${
                                    action.variant === 'destructive'
                                        ? 'text-destructive focus:bg-destructive/10'
                                        : 'text-foreground focus:bg-accent'
                                } hover:bg-accent disabled:pointer-events-none disabled:opacity-50`,
                            },
                            action.icon ? React.createElement(action.icon, { className: 'h-4 w-4' }) : null,
                            action.label,
                        ),
                    );

                    return React.createElement(React.Fragment, { key: i }, ...items);
                }),
            ),
    );
}
