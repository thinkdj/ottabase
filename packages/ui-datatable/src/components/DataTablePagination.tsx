// ============================================================
// @ottabase/ui-datatable - DataTablePagination
// ============================================================
// Row count, page size and page controls, read from the table
// instance so client and server paging look the same.
// ============================================================

import type { Table } from '@tanstack/react-table';
import { clsx } from 'clsx';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface DataTablePaginationProps<TData> {
    table: Table<TData>;
    /** Page size options; one option hides the selector */
    pageSizeOptions?: number[];
    /** Selected row count (for display) */
    selectedCount?: number;
}

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

const LABEL = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';

/**
 * Pagination controls. The row count always shows; the page size selector and
 * the page buttons appear once there is more than one page's worth of rows.
 */
export function DataTablePagination<TData>({
    table,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    selectedCount = 0,
}: DataTablePaginationProps<TData>) {
    const { pageIndex, pageSize } = table.getState().pagination;
    const page = pageIndex + 1;
    const totalRows = table.getRowCount();
    const totalPages = Math.max(1, table.getPageCount());
    if (totalRows === 0) return null;

    const startRow = pageIndex * pageSize + 1;
    const endRow = Math.min(page * pageSize, totalRows);
    const hasPages = totalPages > 1 || totalRows > Math.min(...pageSizeOptions);
    const sizes = pageSizeOptions.includes(pageSize)
        ? pageSizeOptions
        : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

    const btnBase = clsx(
        'inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-normal',
        'hover:bg-muted/70 hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
    );

    return (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 py-2">
            <span className={LABEL}>
                {selectedCount > 0
                    ? `${selectedCount} of ${totalRows.toLocaleString()} selected`
                    : `${startRow.toLocaleString()} to ${endRow.toLocaleString()} of ${totalRows.toLocaleString()}`}
            </span>

            {hasPages && (
                <div className="flex items-center gap-4">
                    {sizes.length > 1 && (
                        <label className={clsx('flex items-center gap-2', LABEL)}>
                            <span className="whitespace-nowrap">Rows</span>
                            <span className="relative flex items-center">
                                <select
                                    aria-label="Rows per page"
                                    value={pageSize}
                                    onChange={(e) => table.setPageSize(Number(e.target.value))}
                                    className="h-9 appearance-none rounded-md bg-background py-0 pl-2.5 pr-7 text-sm text-foreground ring-1 ring-border transition-colors duration-normal focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {sizes.map((size) => (
                                        <option key={size} value={size}>
                                            {size}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </span>
                        </label>
                    )}

                    <span className={clsx('whitespace-nowrap', LABEL)}>
                        Page {page} of {totalPages}
                    </span>

                    <div className="flex items-center gap-1">
                        <button
                            className={btnBase}
                            onClick={() => table.setPageIndex(0)}
                            disabled={!table.getCanPreviousPage()}
                            aria-label="First page"
                        >
                            <ChevronsLeft className="h-4 w-4" />
                        </button>
                        <button
                            className={btnBase}
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            aria-label="Previous page"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                            className={btnBase}
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                            aria-label="Next page"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                        <button
                            className={btnBase}
                            onClick={() => table.setPageIndex(totalPages - 1)}
                            disabled={!table.getCanNextPage()}
                            aria-label="Last page"
                        >
                            <ChevronsRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
