// ============================================================
// @ottabase/ui-datatable/react - Rendered UI surface
// ============================================================
// Every export here renders React (imports lucide-react / clsx,
// or emits React.createElement + className). Keeping it behind
// this single subpath lets the `.` barrel stay headless so pure
// consumers never pull in the optional UI peer dependencies.
// ============================================================

// ── Components ───────────────────────────────────────────────
export { DataTable } from './components/DataTable';
export { DataTableColumnHeader } from './components/DataTableColumnHeader';
export { DataTablePagination } from './components/DataTablePagination';
export { DataTableToolbar } from './components/DataTableToolbar';
export { DataTableViewOptions } from './components/DataTableViewOptions';

// ── Column Helpers (emit React.createElement) ────────────────
export { createColumns, selectColumn, actionsColumn } from './columns/createColumns';

// ── Cell Formatter (returns React nodes) ─────────────────────
export { formatCellValue } from './utils/formatters';
