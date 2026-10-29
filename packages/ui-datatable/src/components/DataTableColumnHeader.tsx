// ============================================================
// @ottabase/ui-datatable - DataTableColumnHeader
// ============================================================
// Column header with a small menu: sort ascending / descending
// (choosing the active one clears sorting) and hide column.
// ============================================================

import type { Column } from '@tanstack/react-table';
import { clsx } from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown, Check, EyeOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface DataTableColumnHeaderProps<TData, TValue> {
    column: Column<TData, TValue>;
    title: string;
    className?: string;
}

/**
 * Sortable column header. A click opens the menu; the current sort shows as an arrow in the
 * primary colour. Columns that can neither sort nor hide render as plain text.
 */
export function DataTableColumnHeader<TData, TValue>({
    column,
    title,
    className,
}: DataTableColumnHeaderProps<TData, TValue>) {
    const meta = column.columnDef.meta as Record<string, unknown> | undefined;
    const headerClassName = (meta?.headerClassName as string) ?? '';
    const canSort = column.getCanSort();
    const canHide = column.getCanHide();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (!canSort && !canHide) {
        return <div className={clsx('flex items-center', headerClassName, className)}>{title}</div>;
    }

    const sorted = column.getIsSorted();
    // Choosing the active direction again clears the sort.
    const sort = (direction: 'asc' | 'desc') => {
        if (sorted === direction) column.clearSorting();
        else column.toggleSorting(direction === 'desc');
        setOpen(false);
    };

    const itemClass =
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm normal-case tracking-normal text-foreground transition-colors duration-normal hover:bg-muted/70 focus-visible:outline-hidden focus-visible:bg-muted/70';

    return (
        <div ref={ref} className="relative inline-block">
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                className={clsx(
                    'group -ml-2 flex items-center gap-1 rounded-md px-2 py-1 transition-colors duration-normal hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring',
                    open && 'text-foreground',
                    headerClassName,
                    className,
                )}
                onClick={() => setOpen((o) => !o)}
            >
                {title}
                {canSort &&
                    (sorted === 'asc' ? (
                        <ArrowUp className="h-3 w-3 text-primary" />
                    ) : sorted === 'desc' ? (
                        <ArrowDown className="h-3 w-3 text-primary" />
                    ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-40 transition-opacity duration-normal group-hover:opacity-70" />
                    ))}
            </button>

            {open && (
                <div
                    role="menu"
                    className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-border/60 bg-popover p-1 text-popover-foreground shadow-md"
                >
                    {canSort && (
                        <>
                            <button type="button" role="menuitem" className={itemClass} onClick={() => sort('asc')}>
                                <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="flex-1">Ascending</span>
                                <span className="text-[0.6875rem] text-muted-foreground">smallest first</span>
                                {sorted === 'asc' && <Check className="h-3.5 w-3.5 text-primary" />}
                            </button>
                            <button type="button" role="menuitem" className={itemClass} onClick={() => sort('desc')}>
                                <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="flex-1">Descending</span>
                                <span className="text-[0.6875rem] text-muted-foreground">largest first</span>
                                {sorted === 'desc' && <Check className="h-3.5 w-3.5 text-primary" />}
                            </button>
                        </>
                    )}
                    {canSort && canHide && <div className="-mx-1 my-1 h-px bg-border/60" />}
                    {canHide && (
                        <button
                            type="button"
                            role="menuitem"
                            className={itemClass}
                            onClick={() => {
                                column.toggleVisibility(false);
                                setOpen(false);
                            }}
                        >
                            <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                            Hide column
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
