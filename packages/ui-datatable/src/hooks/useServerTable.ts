// ============================================================
// @ottabase/ui-datatable - useServerTable Hook
// ============================================================
// Server-side data table integrating with OttaORM CRUD API
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import type {
    DataTablePaginationState,
    DataTableSortingState,
    UseServerTableOptions,
    UseServerTableReturn,
} from '../types';
import { useDataTable } from './useDataTable';

interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

/**
 * Server-side data table hook that integrates with OttaORM's paginated API.
 *
 * Handles fetching, pagination, sorting, and search against the standard
 * `/api/ottaorm/{entity}` endpoints.
 *
 * @example
 * ```tsx
 * const { table, isLoading, pagination, setSearchQuery } = useServerTable<TodoType>({
 *     entityName: 'todos',
 *     columns,
 *     perPage: 20,
 *     defaultSort: 'createdAt',
 *     defaultSortDirection: 'desc',
 * });
 *
 * return <DataTable table={table} isLoading={isLoading} pagination={pagination} />;
 * ```
 */
export function useServerTable<TData extends Record<string, unknown>>(
    options: UseServerTableOptions<TData>,
): UseServerTableReturn<TData> {
    const {
        entityName,
        columns,
        perPage = 10,
        defaultSort,
        defaultSortDirection = 'asc',
        enableRowSelection = false,
        initialColumnVisibility = {},
        getRowId,
        apiPath,
        fetchFn = fetch,
        pageSizeOptions,
    } = options;

    const basePath = apiPath ?? `/api/ottaorm/${entityName}`;

    // ── Server state ─────────────────────────────────────────

    const [pagination, setPagination] = useState<DataTablePaginationState>({
        page: 1,
        perPage,
        total: 0,
    });

    const [serverSorting, setServerSorting] = useState<DataTableSortingState | null>(
        defaultSort ? { column: defaultSort, direction: defaultSortDirection } : null,
    );

    const [searchQuery, setSearchQueryState] = useState('');

    // ── Build query params ───────────────────────────────────

    const queryParams = useMemo(() => {
        const params: Record<string, string> = {
            limit: String(pagination.perPage),
            offset: String((pagination.page - 1) * pagination.perPage),
        };

        if (serverSorting) {
            params.orderBy = serverSorting.column;
            params.orderDirection = serverSorting.direction;
        }

        if (searchQuery) {
            params.search = searchQuery;
        }

        return params;
    }, [pagination.page, pagination.perPage, serverSorting, searchQuery]);

    // ── Data fetching ────────────────────────────────────────

    const queryKey = useMemo(() => ['ottaorm', entityName, 'list', queryParams], [entityName, queryParams]);

    const {
        data: response,
        isLoading,
        error,
        refetch,
    } = useQuery<PaginatedResponse<TData>>({
        queryKey,
        queryFn: async () => {
            const url = new URL(basePath, window.location.origin);
            (Object.entries(queryParams) as [string, string][]).forEach(([k, v]) => url.searchParams.set(k, v));

            const res = await fetchFn(url.toString());
            if (!res.ok) {
                throw new Error(`Failed to fetch ${entityName}: ${res.statusText}`);
            }
            return res.json();
        },
    });

    // ── Derived data ─────────────────────────────────────────

    const data = useMemo(() => response?.data ?? [], [response]);
    const total = response?.total ?? 0;

    // Keep total synced with server response
    const currentPagination = useMemo(() => ({ ...pagination, total }), [pagination, total]);

    // ── Pagination handler ───────────────────────────────────

    const handlePaginationChange = useCallback((newPagination: DataTablePaginationState) => {
        setPagination(newPagination);
    }, []);

    // ── Search handler ───────────────────────────────────────

    const setSearchQuery = useCallback((query: string) => {
        setSearchQueryState(query);
        // Reset to first page on search
        setPagination((prev) => ({ ...prev, page: 1 }));
    }, []);

    // ── Wire up the core hook ────────────────────────────────

    const tableResult = useDataTable<TData>({
        data,
        columns,
        getRowId,
        enableRowSelection,
        enableColumnVisibility: true,
        initialColumnVisibility,
        manualSorting: true,
        manualPagination: true,
        manualFiltering: true,
        sorting: serverSorting,
        onSortingChange: setServerSorting,
        pagination: currentPagination,
        onPaginationChange: handlePaginationChange,
        rowCount: total,
        pageSizeOptions,
    });

    return {
        ...tableResult,
        isLoading,
        error: error as Error | null,
        refetch,
        searchQuery,
        setSearchQuery,
        pagination: currentPagination,
        serverSorting,
    };
}
