// ============================================================
// @ottabase/ui-datatable - useDataTable Hook
// ============================================================
// Core hook that wraps TanStack Table with ergonomic defaults
// ============================================================

import type {
    ColumnFiltersState,
    PaginationState,
    RowSelectionState,
    SortingState,
    VisibilityState,
} from '@tanstack/react-table';
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { useCallback, useMemo, useState } from 'react';
import type { UseDataTableOptions, UseDataTableReturn } from '../types';

/**
 * Core data table hook — wraps TanStack Table with sensible defaults
 * and bridges server-side vs client-side state management.
 *
 * @example
 * ```tsx
 * const { table, getSelectedRows } = useDataTable({
 *     data: todos,
 *     columns,
 *     enableRowSelection: true,
 *     sorting: { column: 'createdAt', direction: 'desc' },
 *     onSortingChange: (s) => setSort(s),
 * });
 * ```
 */
export function useDataTable<TData extends Record<string, unknown>>(
    options: UseDataTableOptions<TData>,
): UseDataTableReturn<TData> {
    const {
        data,
        columns,
        getRowId = (row) => String((row as Record<string, unknown>).id ?? ''),
        enableRowSelection = false,
        enableMultiRowSelection = true,
        enableColumnVisibility = true,

        // Server-side state
        sorting: serverSorting,
        onSortingChange: onServerSortingChange,
        pagination: serverPagination,
        onPaginationChange: onServerPaginationChange,
        manualSorting = false,
        manualPagination = false,
        manualFiltering = false,
        rowCount,

        // Client-side defaults
        initialSorting = [],
        initialColumnVisibility = {},
        initialPageSize = 10,
        enablePagination = true,
        pageSizeOptions: _pageSizeOptions,
    } = options;

    // ── Internal state ───────────────────────────────────────

    const [clientSorting, setClientSorting] = useState<SortingState>(initialSorting);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(initialColumnVisibility);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

    // ── Sorting bridge ───────────────────────────────────────
    // Convert between our DataTableSortingState and TanStack's SortingState

    const sorting = useMemo<SortingState>(() => {
        if (manualSorting && serverSorting) {
            return [{ id: serverSorting.column, desc: serverSorting.direction === 'desc' }];
        }
        return clientSorting;
    }, [manualSorting, serverSorting, clientSorting]);

    const handleSortingChange = useCallback(
        (updater: SortingState | ((old: SortingState) => SortingState)) => {
            const newSorting = typeof updater === 'function' ? updater(sorting) : updater;

            if (manualSorting && onServerSortingChange) {
                if (newSorting.length === 0) {
                    onServerSortingChange(null);
                } else {
                    onServerSortingChange({
                        column: newSorting[0].id,
                        direction: newSorting[0].desc ? 'desc' : 'asc',
                    });
                }
            } else {
                setClientSorting(newSorting);
            }
        },
        [manualSorting, onServerSortingChange, sorting],
    );

    // ── Pagination bridge ────────────────────────────────────

    const paginationState = useMemo<PaginationState>(() => {
        if (manualPagination && serverPagination) {
            return {
                pageIndex: serverPagination.page - 1, // TanStack is 0-indexed
                pageSize: serverPagination.perPage,
            };
        }
        return { pageIndex: 0, pageSize: initialPageSize };
    }, [manualPagination, serverPagination, initialPageSize]);

    const handlePaginationChange = useCallback(
        (updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
            const newPagination = typeof updater === 'function' ? updater(paginationState) : updater;

            if (manualPagination && onServerPaginationChange && serverPagination) {
                onServerPaginationChange({
                    page: newPagination.pageIndex + 1, // Convert back to 1-indexed
                    perPage: newPagination.pageSize,
                    total: serverPagination.total,
                });
            }
        },
        [manualPagination, onServerPaginationChange, serverPagination, paginationState],
    );

    // ── Table instance ───────────────────────────────────────

    const table = useReactTable({
        data,
        columns,
        getRowId,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            ...(enablePagination || manualPagination ? { pagination: paginationState } : {}),
        },

        // Sorting
        onSortingChange: handleSortingChange as never,
        manualSorting,
        enableSorting: true,
        ...(manualSorting ? {} : { getSortedRowModel: getSortedRowModel() }),

        // Filtering
        onColumnFiltersChange: setColumnFilters,
        manualFiltering,
        ...(manualFiltering ? {} : { getFilteredRowModel: getFilteredRowModel() }),

        // Pagination
        ...(enablePagination || manualPagination
            ? {
                  onPaginationChange: handlePaginationChange as never,
                  manualPagination,
                  ...(manualPagination ? {} : { getPaginationRowModel: getPaginationRowModel() }),
                  ...(manualPagination && rowCount ? { rowCount } : {}),
              }
            : {}),

        // Visibility
        onColumnVisibilityChange: setColumnVisibility,
        enableHiding: enableColumnVisibility,

        // Selection
        onRowSelectionChange: setRowSelection,
        enableRowSelection,
        enableMultiRowSelection,

        // Core
        getCoreRowModel: getCoreRowModel(),
    });

    // ── Selection helpers ────────────────────────────────────

    const getSelectedRows = useCallback(() => {
        return table.getSelectedRowModel().rows.map((row) => row.original);
    }, [table]);

    const clearSelection = useCallback(() => {
        setRowSelection({});
    }, []);

    const hasSelection = Object.keys(rowSelection).length > 0;
    const selectedCount = Object.keys(rowSelection).length;

    return {
        table,
        sorting,
        columnFilters,
        columnVisibility,
        rowSelection,
        getSelectedRows,
        clearSelection,
        hasSelection,
        selectedCount,
    };
}
