# @ottabase/ui-datatable — agent notes

Headless-first React data table on TanStack Table v8: sorting, pagination, row selection, bulk actions, server-driven tables via OttaORM. Full docs: ./README.md

## Use when

- Rendering list/table views in admin UIs (client-side or server-driven via `useServerTable`).
- NOT for create/edit forms — use `@ottabase/forms` (its `ModelTable` already wraps this package).

## Imports

```ts
import {
    DataTable, DataTableColumnHeader, DataTablePagination, DataTableToolbar, DataTableViewOptions,
    useDataTable, useServerTable, createColumns, selectColumn, actionsColumn,
    formatCellValue, truncateText, flexRender,
} from '@ottabase/ui-datatable';
// Types: DataTableProps, DataTableColumnDef, DataTableAction, DataTableBulkAction,
// UseDataTableOptions, UseServerTableOptions (same specifier)
```

## Canonical usage

```tsx
const columns = createColumns<TodoType>([
    { key: 'title', header: 'Title', sortable: true },
    { key: 'completed', header: 'Done', format: 'boolean' },
    { key: 'createdAt', header: 'Created', format: 'datetime', sortable: true },
]);
// Client-side
const { table, getSelectedRows } = useDataTable({ data, columns, enableRowSelection: true });
return <DataTable table={table} />;
// Server-side (fetches /api/ottaorm/{entity})
const { table, isLoading, pagination, setSearchQuery } = useServerTable<TodoType>({
    entityName: 'todos', columns, perPage: 20, defaultSort: 'createdAt', defaultSortDirection: 'desc',
});
return <DataTable table={table} isLoading={isLoading} pagination={pagination} />;
```

## Gotchas

- `useServerTable` needs the `@tanstack/react-query` peer dep; `useDataTable` does not. Peer `@ottabase/ui-shadcn` is workspace:*.
- `DataTablePaginationState.page` is 1-indexed, unlike TanStack's 0-indexed `pageIndex`.
- `onCellClick` calls `stopPropagation()` — `onRowClick` won't fire for that click.
- Explicit width style is skipped when column size equals TanStack's default 150; set `width` to override.
