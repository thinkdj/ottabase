// ============================================================
// @ottabase/ui-datatable - DataTableViewOptions
// ============================================================
// Column visibility toggle dropdown
// ============================================================

import type { Table } from '@tanstack/react-table';
import { clsx } from 'clsx';
import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface DataTableViewOptionsProps<TData> {
    table: Table<TData>;
}

/**
 * Column visibility toggle — dropdown listing all hideable columns
 * with checkboxes to show/hide them.
 */
export function DataTableViewOptions<TData>({ table }: DataTableViewOptionsProps<TData>) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const hideableColumns = table.getAllColumns().filter((column) => column.getCanHide());

    if (hideableColumns.length === 0) return null;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className={clsx(
                    'inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    open && 'bg-accent text-accent-foreground',
                )}
            >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Columns</span>
            </button>

            {open && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-md border bg-popover p-2 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Toggle columns</div>
                    <div className="-mx-1 my-1 h-px bg-border" />
                    {hideableColumns.map((column) => (
                        <label
                            key={column.id}
                            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                        >
                            <input
                                type="checkbox"
                                checked={column.getIsVisible()}
                                onChange={(e) => column.toggleVisibility(e.target.checked)}
                                className="h-4 w-4 rounded border-input bg-background text-primary focus:ring-ring"
                            />
                            <span className="capitalize">
                                {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
                            </span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
}
