// ============================================================
// @ottabase/ui-datatable - Type Definitions
// ============================================================
// Core types for the advanced data table system
// ============================================================

import type {
    ColumnDef,
    ColumnFiltersState,
    RowSelectionState,
    SortingState,
    Table,
    VisibilityState,
} from '@tanstack/react-table';
import type React from 'react';

// ── Sorting ──────────────────────────────────────────────────

export interface DataTableSortingState {
    /** Column ID to sort by */
    column: string;
    /** Sort direction */
    direction: 'asc' | 'desc';
}

// ── Pagination ───────────────────────────────────────────────

export interface DataTablePaginationState {
    /** Current page (1-indexed) */
    page: number;
    /** Items per page */
    perPage: number;
}

// ── List state (server-driven lists) ─────────────────────────

/** What `useListState` returns: the page, page size and search of a list the server pages */
export interface ListState {
    page: number;
    perPage: number;
    /** What the search box shows */
    search: string;
    /** The search to send: trimmed, and settled once typing pauses */
    query: string;
    /** `page=2&perPage=25&search=ada`, ready to append to an endpoint */
    params: string;
    setPage: (page: number) => void;
    /** A new search starts from the first page once it settles */
    setSearch: (value: string) => void;
    /** Back to the first page. Call it when a filter outside the table changes. */
    reset: () => void;
    pagination: DataTablePaginationState;
    onPaginationChange: (next: DataTablePaginationState) => void;
}

// ── Row Actions ──────────────────────────────────────────────

export interface DataTableAction<TData> {
    /** Action label */
    label: string;
    /** Icon component (optional) */
    icon?: React.ElementType;
    /** Click handler receives the row data */
    onClick: (row: TData) => void;
    /** Visual variant */
    variant?: 'default' | 'destructive';
    /** Whether to show a separator before this action */
    separator?: boolean;
    /** Conditionally hide the action */
    hidden?: (row: TData) => boolean;
    /** Conditionally disable the action */
    disabled?: (row: TData) => boolean;
}

// ── Bulk Actions ─────────────────────────────────────────────

export interface DataTableBulkAction<TData> {
    /** Action label */
    label: string;
    /** Icon component (optional) */
    icon?: React.ElementType;
    /** Click handler receives all selected rows */
    onClick: (rows: TData[]) => void;
    /** Visual variant */
    variant?: 'default' | 'destructive' | 'outline';
}

// ── Column Definition Helper ─────────────────────────────────

export interface DataTableColumnDef<TData> {
    /** Column accessor key (matches a field on TData) */
    key: string & keyof TData;
    /** Column header label */
    header: string;
    /** Whether column is sortable */
    sortable?: boolean;
    /** Whether column is filterable */
    filterable?: boolean;
    /** Custom cell renderer */
    cell?: (props: { row: TData; value: TData[keyof TData] }) => React.ReactNode;
    /** Cell value formatter (string output, use `cell` for JSX) */
    format?: 'date' | 'datetime' | 'boolean' | 'currency' | 'percentage' | 'image' | 'link' | 'badge';
    /** ISO 4217 currency code for `format: 'currency'` (default `'USD'`) */
    currency?: string;
    /** Column width: a number is px, a string is any CSS width (`'200px'`, `'20%'`) */
    width?: number | string;
    /** Min width */
    minWidth?: number;
    /** Max width */
    maxWidth?: number;
    /** `false` hides the column initially; it stays in the visibility toggle so users can show it */
    visible?: boolean;
    /** Additional className for cells */
    className?: string;
    /** Additional className for header */
    headerClassName?: string;
    /** Column alignment */
    align?: 'left' | 'center' | 'right';
    /** Whether to enable text truncation */
    truncate?: boolean;
    /** Max text length before truncation */
    maxLength?: number;
}

// ── useDataTable Options ─────────────────────────────────────

export interface UseDataTableOptions<TData> {
    /** Data array */
    data: TData[];
    /** TanStack Table column definitions (raw) or our simplified defs */
    columns: ColumnDef<TData, unknown>[];
    /** Row ID accessor (defaults to 'id') */
    getRowId?: (row: TData) => string;
    /** Enable row selection */
    enableRowSelection?: boolean;
    /** Enable multi-row selection (defaults to true when selection enabled) */
    enableMultiRowSelection?: boolean;
    /** Enable column visibility toggling */
    enableColumnVisibility?: boolean;

    // ── Server-side state (controlled) ───────────────────────
    /** State from `useListState`: turns on server mode and drives the pager. Pass `rowCount` with it. */
    list?: ListState;
    /** Server-side sorting state */
    sorting?: DataTableSortingState | null;
    /** Callback when sort changes */
    onSortingChange?: (sorting: DataTableSortingState | null) => void;
    /** Server-side pagination state */
    pagination?: DataTablePaginationState;
    /** Callback when page changes */
    onPaginationChange?: (pagination: DataTablePaginationState) => void;
    /** Whether sorting/pagination/filtering is server-driven */
    manualSorting?: boolean;
    /** Whether pagination is server-driven */
    manualPagination?: boolean;
    /** Whether filtering is server-driven */
    manualFiltering?: boolean;
    /** Total row count (for server-side pagination) */
    rowCount?: number;

    // ── Client-side defaults ─────────────────────────────────
    /** Initial sorting state (client-side) */
    initialSorting?: SortingState;
    /** Initial column visibility */
    initialColumnVisibility?: VisibilityState;
    /** Initial page size (for client-side pagination) */
    initialPageSize?: number;
    /** Enable client-side pagination */
    enablePagination?: boolean;
    /** Page size options */
    pageSizeOptions?: number[];
}

// ── useDataTable Return ──────────────────────────────────────

export interface UseDataTableReturn<TData> {
    /** TanStack Table instance */
    table: Table<TData>;
    /** Current sorting state (TanStack format) */
    sorting: SortingState;
    /** Current column filters */
    columnFilters: ColumnFiltersState;
    /** Current column visibility */
    columnVisibility: VisibilityState;
    /** Current row selection */
    rowSelection: RowSelectionState;
    /** Get selected row data */
    getSelectedRows: () => TData[];
    /** Clear all selections */
    clearSelection: () => void;
    /** Check if any rows are selected */
    hasSelection: boolean;
    /** Number of selected rows */
    selectedCount: number;
}

// ── DataTable Component Props ────────────────────────────────

export interface DataTableProps<TData> {
    /** TanStack Table instance (from useDataTable) */
    table: Table<TData>;
    /** Row click handler */
    onRowClick?: (row: TData) => void;
    /** Cell click handler: receives row data, column ID, and cell value */
    onCellClick?: (row: TData, columnId: string, value: unknown) => void;
    /** Loading state */
    isLoading?: boolean;
    /** Empty state message */
    emptyMessage?: string;
    /** Empty state icon */
    emptyIcon?: React.ElementType;
    /** Whether to show column visibility toggle */
    showColumnVisibility?: boolean;
    /** Show the search box (default: when a handler is given or the table filters on the client) */
    showSearch?: boolean;
    /** Search value (controlled) */
    searchValue?: string;
    /** Search change handler */
    onSearchChange?: (value: string) => void;
    /** Search placeholder */
    searchPlaceholder?: string;
    /** Bulk actions (shown when rows selected) */
    bulkActions?: DataTableBulkAction<TData>[];
    /** Toolbar right slot (extra controls) */
    toolbarRight?: React.ReactNode;
    /** Toolbar left slot */
    toolbarLeft?: React.ReactNode;
    /** Additional className */
    className?: string;
    /** Page size options (default 10, 20, 30, 50, 100) */
    pageSizeOptions?: number[];
    /** Show the row count and pager under the table. Page controls appear once there is more than one page's worth. */
    showPagination?: boolean;
    /** Compact mode: reduced padding */
    compact?: boolean;
    /** Striped rows */
    striped?: boolean;
    /** Bordered cells */
    bordered?: boolean;
    /** Stickyheader */
    stickyHeader?: boolean;
    /** Max height for scrollable body (enables sticky header) */
    maxHeight?: string | number;
}
