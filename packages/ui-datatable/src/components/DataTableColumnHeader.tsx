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

    return (
        <button
            className={clsx(
                'flex items-center gap-1 font-medium transition-colors hover:text-foreground -ml-2 px-2 py-1 rounded-md hover:bg-accent',
                headerClassName,
                className,
            )}
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
            {title}
            {column.getIsSorted() === 'asc' ? (
                <ArrowUp className="h-3.5 w-3.5" />
            ) : column.getIsSorted() === 'desc' ? (
                <ArrowDown className="h-3.5 w-3.5" />
            ) : (
                <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
            )}
        </button>
    );
}
