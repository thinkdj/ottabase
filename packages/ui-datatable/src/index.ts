// ============================================================
// @ottabase/ui-datatable - Advanced Data Table (headless core)
// ============================================================
// Headless-first data table built on TanStack Table v8.
// Supports server-side sort/filter/pagination (via OttaORM),
// column visibility, row selection, inline editing, and bulk actions.
//
// This `.` barrel is PURE: hooks, types, and string helpers only —
// ZERO rendered UI. The rendered DataTable components and the
// column factories live behind `@ottabase/ui-datatable/react`.
// ============================================================

// ── Hooks ────────────────────────────────────────────────────
export { useDataTable } from './hooks/useDataTable';
export { useServerTable } from './hooks/useServerTable';

// ── Utilities (pure, UI-free) ────────────────────────────────
export { truncateText } from './utils/text';

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
