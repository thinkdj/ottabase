// ============================================================
// @ottabase/ui-datatable - Advanced Data Table
// ============================================================
// Headless-first data table built on TanStack Table v8.
// Supports server-side sort/filter/pagination (via OttaORM),
// column visibility, row selection, inline editing, and bulk actions.
// ============================================================

// ── Components ───────────────────────────────────────────────
export { DataTable } from './components/DataTable';
export { DataTableColumnHeader } from './components/DataTableColumnHeader';
export { DataTablePagination } from './components/DataTablePagination';
export { DataTableToolbar } from './components/DataTableToolbar';
export { DataTableViewOptions } from './components/DataTableViewOptions';

// ── Hooks ────────────────────────────────────────────────────
export { useDataTable } from './hooks/useDataTable';
export { useServerTable } from './hooks/useServerTable';

// ── Column Helpers ───────────────────────────────────────────
export { createColumns, selectColumn, actionsColumn } from './columns/createColumns';

// ── Utilities ────────────────────────────────────────────────
export { formatCellValue, truncateText } from './utils/formatters';

// ── Types ────────────────────────────────────────────────────
export type {
    DataTableProps,
    DataTableSortingState,
    DataTablePaginationState,
    DataTableFilterValue,
    DataTableAction,
    DataTableBulkAction,
    DataTableColumnDef,
    UseDataTableOptions,
    UseDataTableReturn,
    UseServerTableOptions,
    UseServerTableReturn,
} from './types';

// ── Re-exports from TanStack Table (convenience) ─────────────
export type {
    ColumnDef,
    SortingState,
    ColumnFiltersState,
    VisibilityState,
    RowSelectionState,
    Table,
} from '@tanstack/react-table';
export { flexRender } from '@tanstack/react-table';
