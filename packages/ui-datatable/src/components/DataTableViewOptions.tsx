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
                    'inline-flex h-9 items-center gap-1.5 rounded-md bg-background px-3 text-sm font-medium ring-1 ring-border transition-colors duration-normal',
                    'hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    open && 'bg-muted/70 text-foreground',
                )}
            >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Columns</span>
            </button>

            {open && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-border/60 bg-popover p-2 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
                    <div className="px-2 py-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Toggle columns
                    </div>
                    <div className="-mx-1 my-1 h-px bg-border/60" />
                    {hideableColumns.map((column) => (
                        <label
                            key={column.id}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-normal hover:bg-muted/70"
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
