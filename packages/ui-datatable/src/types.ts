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
    /** Total number of items (from server) */
    total: number;
}

// ── Filtering ────────────────────────────────────────────────

export interface DataTableFilterValue {
    /** Column ID to filter */
    column: string;
    /** Filter value */
    value: unknown;
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
    /** Cell value formatter (string output — use `cell` for JSX) */
    format?: 'date' | 'datetime' | 'boolean' | 'currency' | 'percentage' | 'image' | 'link' | 'badge';
    /** Column width (px or CSS string) */
    width?: number | string;
    /** Min width */
    minWidth?: number;
    /** Max width */
    maxWidth?: number;
    /** Whether column is visible by default */
    visible?: boolean;
    /** Enable inline editing for this column */
    editable?: boolean;
    /** On cell edit commit */
    onEdit?: (row: TData, value: unknown) => void | Promise<void>;
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
    /** Server-side sorting state */
    sorting?: DataTableSortingState | null;
    /** Callback when sort changes */
    onSortingChange?: (sorting: DataTableSortingState | null) => void;
    /** Server-side pagination state */
    pagination?: DataTablePaginationState;
    /** Callback when page changes */
    onPaginationChange?: (pagination: DataTablePaginationState) => void;
    /** Server-side filter values */
    filters?: DataTableFilterValue[];
    /** Callback when filters change */
    onFiltersChange?: (filters: DataTableFilterValue[]) => void;
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
    /** Cell click handler — receives row data, column ID, and cell value */
    onCellClick?: (row: TData, columnId: string, value: unknown) => void;
    /** Loading state */
    isLoading?: boolean;
    /** Empty state message */
    emptyMessage?: string;
    /** Empty state icon */
    emptyIcon?: React.ElementType;
    /** Whether to show column visibility toggle */
    showColumnVisibility?: boolean;
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
    /** Pagination state for server-side pagination display */
    pagination?: DataTablePaginationState;
    /** On pagination change for server-side */
    onPaginationChange?: (pagination: DataTablePaginationState) => void;
    /** Page size options */
    pageSizeOptions?: number[];
    /** Show pagination */
    showPagination?: boolean;
    /** Compact mode – reduced padding */
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

// ── Server Table Options ─────────────────────────────────────

/**
 * Options for useServerTable — integrates with OttaORM's useList/useInfiniteList
 */
export interface UseServerTableOptions<TData> {
    /** Entity name for OttaORM (e.g. 'todos') */
    entityName: string;
    /** TanStack Table column definitions */
    columns: ColumnDef<TData, unknown>[];
    /** Items per page (default: 10) */
    perPage?: number;
    /** Default sort column */
    defaultSort?: string;
    /** Default sort direction */
    defaultSortDirection?: 'asc' | 'desc';
    /** Enable row selection */
    enableRowSelection?: boolean;
    /** Initial column visibility */
    initialColumnVisibility?: VisibilityState;
    /** Row ID accessor */
    getRowId?: (row: TData) => string;
    /** API base path (default: '/api/ottaorm') */
    apiPath?: string;
    /** Custom fetch function */
    fetchFn?: typeof fetch;
    /** Page size options */
    pageSizeOptions?: number[];
}

export interface UseServerTableReturn<TData> extends UseDataTableReturn<TData> {
    /** Loading state */
    isLoading: boolean;
    /** Error state */
    error: Error | null;
    /** Refetch data */
    refetch: () => void;
    /** Current search query */
    searchQuery: string;
    /** Change search */
    setSearchQuery: (query: string) => void;
    /** Server pagination state */
    pagination: DataTablePaginationState;
    /** Server sorting state */
    serverSorting: DataTableSortingState | null;
}
