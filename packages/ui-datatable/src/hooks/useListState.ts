// ============================================================
// @ottabase/ui-datatable - useListState
// ============================================================
// Page, page size and search for a list the server pages. The
// hook owns that state; the page builds its request from it and
// hands the rows and total to useDataTable.
// ============================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DataTablePaginationState, ListState } from '../types';

export interface ListStateOptions {
    /** Rows per page to start with (default 25) */
    perPage?: number;
    /** How long the search waits after the last keystroke before it is sent, in ms (default 300) */
    searchDelay?: number;
}

/**
 * State for a server-paged list.
 *
 * @example
 * ```tsx
 * const list = useListState({ perPage: 25 });
 * const users = useApiQuery({ queryKey: ['users', list.params], endpoint: `/api/users?${list.params}` });
 * const { table } = useDataTable({ data: users.data?.data ?? [], columns, list, rowCount: users.data?.total });
 * return <DataTable table={table} searchValue={list.search} onSearchChange={list.setSearch} />;
 * ```
 */
export function useListState({ perPage: initialPerPage = 25, searchDelay = 300 }: ListStateOptions = {}): ListState {
    const [search, setSearch] = useState('');
    const [state, setState] = useState({ page: 1, perPage: initialPerPage, query: '' });

    // The search is sent once typing pauses, and a changed search starts from the first page.
    // Clearing it is immediate.
    useEffect(() => {
        const query = search.trim();
        const apply = () => setState((prev) => (prev.query === query ? prev : { ...prev, query, page: 1 }));
        if (!query) {
            apply();
            return;
        }
        const timer = setTimeout(apply, searchDelay);
        return () => clearTimeout(timer);
    }, [search, searchDelay]);

    const setPage = useCallback((page: number) => setState((prev) => ({ ...prev, page })), []);
    const reset = useCallback(() => setPage(1), [setPage]);
    const onPaginationChange = useCallback(
        (next: DataTablePaginationState) => setState((prev) => ({ ...prev, page: next.page, perPage: next.perPage })),
        [],
    );

    const { page, perPage, query } = state;
    const params = useMemo(() => {
        const searchParams = new URLSearchParams({ page: String(page), perPage: String(perPage) });
        if (query) searchParams.set('search', query);
        return searchParams.toString();
    }, [page, perPage, query]);
    const pagination = useMemo(() => ({ page, perPage }), [page, perPage]);

    return { page, perPage, search, query, params, setPage, setSearch, reset, pagination, onPaginationChange };
}
