// ============================================================
// @ottabase/ui-datatable - DataTableColumnHeader
// ============================================================
// Sortable column header with direction indicators
// ============================================================

import type { Column } from '@tanstack/react-table';
import { clsx } from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

interface DataTableColumnHeaderProps<TData, TValue> {
    column: Column<TData, TValue>;
    title: string;
    className?: string;
}

/**
 * Sortable column header — renders sort direction indicators and handles
 * click-to-sort. Reads sortable state from the column definition.
 */
export function DataTableColumnHeader<TData, TValue>({
    column,
    title,
    className,
}: DataTableColumnHeaderProps<TData, TValue>) {
    const meta = column.columnDef.meta as Record<string, unknown> | undefined;
    const headerClassName = (meta?.headerClassName as string) ?? '';

    if (!column.getCanSort()) {
        return <div className={clsx('flex items-center', headerClassName, className)}>{title}</div>;
    }

    const sorted = column.getIsSorted();

    return (
        <button
            className={clsx(
                'group -ml-2 flex items-center gap-1 rounded-md px-2 py-1 transition-colors duration-normal hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                headerClassName,
                className,
            )}
            onClick={() => column.toggleSorting(sorted === 'asc')}
        >
            {title}
            {sorted === 'asc' ? (
                <ArrowUp className="h-3 w-3 transition-transform duration-normal group-hover:-translate-y-0.5" />
            ) : sorted === 'desc' ? (
                <ArrowDown className="h-3 w-3 transition-transform duration-normal group-hover:translate-y-0.5" />
            ) : (
                <ArrowUpDown className="h-3 w-3 opacity-40 transition-opacity duration-normal group-hover:opacity-70" />
            )}
        </button>
    );
}
