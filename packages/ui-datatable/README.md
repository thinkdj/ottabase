# @ottabase/ui-datatable

Advanced, headless-first data table built on **TanStack Table v8** for ottabase. Supports server-side
sort/filter/pagination (via OttaORM), column visibility, row selection, inline editing, bulk actions, and theme-aware
styling.

## Why

Every admin panel, CMS, and SaaS dashboard needs a rich data table. **OttaORM** and **@ottabase/forms** handle
create/edit; this package handles **list views** — closing the full CRUD loop.

## Installation

```bash
pnpm add @ottabase/ui-datatable
```

**Peer dependencies:** `react`, `react-dom`, `@ottabase/ui-shadcn`

## Quick Start

### 1. Define columns

```tsx
import { createColumns, actionsColumn, selectColumn } from '@ottabase/ui-datatable';

const columns = createColumns<TodoType>([
    { key: 'title', header: 'Title', sortable: true },
    { key: 'completed', header: 'Done', format: 'boolean' },
    { key: 'createdAt', header: 'Created', format: 'datetime', sortable: true },
]);
```

### 2. Create the table instance

```tsx
import { useDataTable, DataTable } from '@ottabase/ui-datatable';

function TodosPage() {
    const { table } = useDataTable({
        data: todos,
        columns,
        enablePagination: true,
        initialPageSize: 20,
    });

    return (
        <DataTable
            table={table}
            onRowClick={(row) => navigate(`/todos/${row.id}`)}
            showPagination
            showColumnVisibility
        />
    );
}
```

### 3. With row selection & bulk actions

```tsx
const columns = [
    selectColumn<TodoType>(),
    ...createColumns<TodoType>([
        { key: 'title', header: 'Title', sortable: true },
        { key: 'completed', header: 'Done', format: 'boolean' },
    ]),
    actionsColumn<TodoType>([
        { label: 'Edit', icon: Edit2, onClick: (row) => openEdit(row) },
        { label: 'Delete', variant: 'destructive', onClick: (row) => remove(row.id) },
    ]),
];

const { table, getSelectedRows, clearSelection } = useDataTable({
    data: todos,
    columns,
    enableRowSelection: true,
});

<DataTable
    table={table}
    bulkActions={[{ label: 'Delete All', variant: 'destructive', onClick: (rows) => bulkDelete(rows) }]}
    showPagination
/>;
```

## Server-Side with OttaORM

`useServerTable` connects directly to the OttaORM CRUD API for server-driven sorting, pagination, and search:

```tsx
import { useServerTable, DataTable } from '@ottabase/ui-datatable';

function TodosPage() {
    const { table, isLoading, pagination, setSearchQuery, refetch } = useServerTable<TodoType>({
        entityName: 'todos',
        columns: todoColumns,
        perPage: 20,
        defaultSort: 'createdAt',
        defaultSortDirection: 'desc',
    });

    return (
        <DataTable
            table={table}
            isLoading={isLoading}
            pagination={pagination}
            onSearchChange={setSearchQuery}
            showPagination
        />
    );
}
```

## Integration with @ottabase/forms

`@ottabase/forms`' `ModelTable` component is now powered by `@ottabase/ui-datatable` internally. If you use `ModelCrud`,
you get the upgraded table automatically — no changes needed:

```tsx
import { ModelCrud, createModelConfig } from '@ottabase/forms';
import { User } from '@ottabase/ottaorm/models';

const usersConfig = createModelConfig(User);

function UsersPage() {
    return <ModelCrud config={usersConfig} apiBasePath="/api/ottaorm" />;
}
```

## API Reference

### Hooks

| Hook                      | Description                                                                  |
| ------------------------- | ---------------------------------------------------------------------------- |
| `useDataTable(options)`   | Core hook — wraps TanStack Table with sorting, pagination, selection bridges |
| `useServerTable(options)` | Server-side hook — fetches data from OttaORM API with auto-pagination/sort   |

### Components

| Component               | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| `DataTable`             | Main table renderer — header, body, toolbar, pagination |
| `DataTableToolbar`      | Search input, column visibility toggle, bulk actions    |
| `DataTablePagination`   | Page navigation with size selector                      |
| `DataTableColumnHeader` | Sortable column header with direction indicators        |
| `DataTableViewOptions`  | Column visibility dropdown                              |

### Column Helpers

| Helper                   | Description                                              |
| ------------------------ | -------------------------------------------------------- |
| `createColumns(defs)`    | Convert declarative column configs to TanStack ColumnDef |
| `selectColumn()`         | Checkbox selection column (place first)                  |
| `actionsColumn(actions)` | Row actions column with dropdown (place last)            |

### Column Definition (`DataTableColumnDef<T>`)

```typescript
{
    key: string & keyof T;     // Accessor key on data
    header: string;            // Column header label
    sortable?: boolean;        // Enable sorting (default: false)
    filterable?: boolean;      // Enable filtering
    format?: 'date' | 'datetime' | 'boolean' | 'currency' | 'percentage' | 'image' | 'link' | 'badge';
    cell?: (props) => ReactNode;  // Custom cell renderer
    width?: number | string;   // Column width
    align?: 'left' | 'center' | 'right';
    visible?: boolean;         // Default visibility (default: true)
    truncate?: boolean;        // Enable text truncation
    maxLength?: number;        // Max chars before truncation
}
```

### DataTable Props

```typescript
{
    table: Table<T>;           // From useDataTable/useServerTable
    onRowClick?: (row: T) => void;
    onCellClick?: (row: T, columnId: string, value: unknown) => void;
    isLoading?: boolean;
    emptyMessage?: string;
    showColumnVisibility?: boolean;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    bulkActions?: DataTableBulkAction<T>[];
    pagination?: DataTablePaginationState;
    onPaginationChange?: (p: DataTablePaginationState) => void;
    showPagination?: boolean;
    compact?: boolean;         // Reduced padding
    striped?: boolean;         // Alternating row colors
    bordered?: boolean;        // Cell borders
    stickyHeader?: boolean;    // Sticky table header
    maxHeight?: string | number; // Scrollable body
    toolbarRight?: ReactNode;  // Custom toolbar controls
    toolbarLeft?: ReactNode;
}
```

> **`onCellClick` vs `onRowClick`:** When both are provided, `onCellClick` fires on cell clicks (with `stopPropagation`)
> while `onRowClick` fires on clicks that don't hit a cell handler. Use `onCellClick` when you need to know _which_
> column was clicked.

### Row Action (`DataTableAction<T>`)

```typescript
{
    label: string;
    icon?: ElementType;
    onClick: (row: T) => void;
    variant?: 'default' | 'destructive';
    separator?: boolean;       // Separator before this action
    hidden?: (row: T) => boolean;
    disabled?: (row: T) => boolean;
}
```

## Theming

Uses CSS variables from `@ottabase/ui-shadcn`. Fully supports light and dark mode out of the box. Key variables used:

- `--background`, `--foreground` — base colors
- `--muted`, `--muted-foreground` — headers, empty states
- `--border`, `--input`, `--ring` — borders and focus rings
- `--primary`, `--primary-foreground` — buttons, selection
- `--accent` — hover states
- `--destructive` — delete actions

## Architecture

```
@ottabase/ui-datatable
├── src/
│   ├── index.ts                        # Public exports
│   ├── types.ts                        # Core type definitions
│   ├── hooks/
│   │   ├── useDataTable.ts             # Client-side table hook
│   │   └── useServerTable.ts           # Server-side OttaORM hook
│   ├── components/
│   │   ├── DataTable.tsx               # Main renderer
│   │   ├── DataTableToolbar.tsx        # Toolbar (search, bulk actions)
│   │   ├── DataTablePagination.tsx     # Pagination controls
│   │   ├── DataTableColumnHeader.tsx   # Sortable headers
│   │   └── DataTableViewOptions.tsx    # Column visibility
│   ├── columns/
│   │   └── createColumns.ts           # Column definition helpers
│   └── utils/
│       └── formatters.ts              # Cell value formatters
└── __tests__/
    └── DataTable.test.tsx
```

## Nuances

### Actions dropdown uses fixed positioning

The row actions dropdown (`actionsColumn` with 3+ actions) renders with `position: fixed` so it escapes
`overflow: hidden` on the table container. It auto-closes on scroll, outside click, and `Escape`.

### `onCellClick` stops propagation

When `onCellClick` is provided, clicking a cell fires `onCellClick(row, columnId, value)` and calls
`e.stopPropagation()` — the row-level `onRowClick` will **not** fire for that click. This lets you use both handlers
without double-firing.

### Server-side hook needs `@tanstack/react-query`

`useServerTable` imports `useQuery` from `@tanstack/react-query` (a peer dependency). If you only use `useDataTable`
(client-side), you don't need react-query installed.

### Column sizing defaults

TanStack Table defaults column size to `150`. The DataTable component skips writing an explicit `width` style when
`header.getSize() === 150` to avoid fighting with natural table layout. Set an explicit `width` in your column def to
override.

### Pagination is 1-indexed

`DataTablePaginationState.page` is **1-indexed** (not 0-indexed like TanStack's internal `pageIndex`). The hooks handle
the conversion automatically.

### Bulk actions toolbar replaces search

When rows are selected and `bulkActions` are provided, the toolbar switches from showing the search input to showing the
bulk action buttons + selection count. Clearing the selection restores the search input.

## Dependencies

- **@tanstack/react-table** v8 — headless table core
- **lucide-react** — icons
- **clsx** — className merging
- **@ottabase/ui-shadcn** (peer) — theme variables and base styles
