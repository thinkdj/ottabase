// ============================================================
// @ottabase/ui-datatable - DataTablePagination
// ============================================================
// Pagination controls with page size selector
// ============================================================

import type { Table } from '@tanstack/react-table';
import { clsx } from 'clsx';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { DataTablePaginationState } from '../types';

interface DataTablePaginationProps<TData> {
    table: Table<TData>;
    /** Server-side pagination state (if provided, uses this instead of table state) */
    pagination?: DataTablePaginationState;
    /** Server-side pagination change handler */
    onPaginationChange?: (pagination: DataTablePaginationState) => void;
    /** Page size options */
    pageSizeOptions?: number[];
    /** Selected row count (for display) */
    selectedCount?: number;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

/**
 * Pagination controls — shows current page, page size selector, and
 * first/prev/next/last navigation buttons.
 *
 * Works with both client-side (table state) and server-side pagination.
 */
export function DataTablePagination<TData>({
    table,
    pagination,
    onPaginationChange,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
    selectedCount = 0,
}: DataTablePaginationProps<TData>) {
    // ── Determine pagination source ──────────────────────────
    const isServerSide = !!pagination;

    const currentPage = isServerSide ? pagination.page : table.getState().pagination.pageIndex + 1;
    const pageSize = isServerSide ? pagination.perPage : table.getState().pagination.pageSize;
    const totalRows = isServerSide ? pagination.total : table.getFilteredRowModel().rows.length;
    const totalPages = isServerSide ? Math.ceil(pagination.total / pagination.perPage) : table.getPageCount();

    const canPreviousPage = isServerSide ? currentPage > 1 : table.getCanPreviousPage();
    const canNextPage = isServerSide ? currentPage < totalPages : table.getCanNextPage();

    // ── Handlers ─────────────────────────────────────────────

    const goToPage = (page: number) => {
        if (isServerSide && onPaginationChange) {
            onPaginationChange({ ...pagination!, page });
        } else {
            table.setPageIndex(page - 1);
        }
    };

    const setPageSize = (size: number) => {
        if (isServerSide && onPaginationChange) {
            onPaginationChange({ ...pagination!, perPage: size, page: 1 });
        } else {
            table.setPageSize(size);
        }
    };

    // Range display
    const startRow = (currentPage - 1) * pageSize + 1;
    const endRow = Math.min(currentPage * pageSize, totalRows);

    const btnBase = clsx(
        'inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors duration-normal',
        'hover:bg-muted/70 hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
    );

    return (
        <div className="flex items-center justify-between gap-4 px-1 py-2">
            {/* Left: row count + selection info */}
            <div className="flex items-center gap-4 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                {selectedCount > 0 && (
                    <span>
                        {selectedCount} of {totalRows} row(s) selected
                    </span>
                )}
                {selectedCount === 0 && totalRows > 0 && (
                    <span>
                        {startRow}–{endRow} of {totalRows}
                    </span>
                )}
            </div>

            {/* Right: page size + navigation */}
            <div className="flex items-center gap-4">
                {/* Page size selector */}
                <div className="flex items-center gap-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    <span className="whitespace-nowrap">Rows</span>
                    <div className="relative flex items-center">
                        <select
                            aria-label="Rows per page"
                            value={pageSize}
                            onChange={(e) => setPageSize(Number(e.target.value))}
                            className="h-9 appearance-none rounded-md bg-background py-0 pl-2.5 pr-7 text-sm text-foreground ring-1 ring-border transition-colors duration-normal focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {pageSizeOptions.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </div>
                </div>

                {/* Page indicator */}
                <span className="whitespace-nowrap text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    Page {currentPage} of {totalPages || 1}
                </span>

                {/* Navigation buttons */}
                <div className="flex items-center gap-1">
                    <button
                        className={btnBase}
                        onClick={() => goToPage(1)}
                        disabled={!canPreviousPage}
                        aria-label="First page"
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </button>
                    <button
                        className={btnBase}
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={!canPreviousPage}
                        aria-label="Previous page"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                        className={btnBase}
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={!canNextPage}
                        aria-label="Next page"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                        className={btnBase}
                        onClick={() => goToPage(totalPages)}
                        disabled={!canNextPage}
                        aria-label="Last page"
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
