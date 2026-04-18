// ============================================================
// DataTable Demo Page
// ============================================================
// Demonstrates @ottabase/ui-datatable with the Todo model
// ============================================================

import type { DataTableBulkAction, DataTablePaginationState, DataTableSortingState } from '@ottabase/ui-datatable';
import { actionsColumn, createColumns, DataTable, selectColumn, useDataTable } from '@ottabase/ui-datatable';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, Edit2, Info, Trash2, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useState } from 'react';

// ── Shared info message context ──────────────────────────────

const TableMessageContext = createContext<{
    message: string | null;
    showMessage: (msg: string) => void;
    clearMessage: () => void;
}>({ message: null, showMessage: () => {}, clearMessage: () => {} });

/** Info bar that shows "Table said: ..." messages */
function TableInfoBar() {
    const { message, clearMessage } = useContext(TableMessageContext);
    if (!message) return null;

    return (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-foreground animate-in fade-in slide-in-from-top-1">
            <Info className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1">
                <span className="font-medium text-muted-foreground">Table said: </span>
                {message}
            </span>
            <button
                onClick={clearMessage}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Dismiss"
            >
                <X className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

// ── Mock Todo type ───────────────────────────────────────────

interface Todo {
    id: string;
    title: string;
    completed: boolean;
    priority: 'low' | 'medium' | 'high';
    assignee: string;
    createdAt: string;
    [key: string]: unknown;
}

// ── Mock data ────────────────────────────────────────────────

const MOCK_TODOS: Todo[] = Array.from({ length: 42 }, (_, i) => ({
    id: `todo-${i + 1}`,
    title: [
        'Set up CI/CD pipeline',
        'Write unit tests for auth module',
        'Review PR #235',
        'Update documentation',
        'Fix timezone bug in scheduler',
        'Add dark mode support',
        'Optimize database queries',
        'Migrate to TanStack Router',
        'Implement file upload',
        'Design landing page',
    ][i % 10],
    completed: i % 3 === 0,
    priority: (['low', 'medium', 'high'] as const)[i % 3],
    assignee: ['Alice', 'Bob', 'Charlie', 'Diana'][i % 4],
    createdAt: new Date(2026, 0, 1 + i).toISOString(),
}));

// ── Column definitions ───────────────────────────────────────

const todoColumns = createColumns<Todo>([
    {
        key: 'title',
        header: 'Title',
        sortable: true,
        filterable: true,
    },
    {
        key: 'completed',
        header: 'Status',
        sortable: true,
        width: 100,
        cell: ({ value }) =>
            value ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" /> Done
                </span>
            ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    <XCircle className="h-3 w-3" /> Pending
                </span>
            ),
    },
    {
        key: 'priority',
        header: 'Priority',
        sortable: true,
        width: 100,
        cell: ({ value }) => {
            const colors: Record<string, string> = {
                high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
            };
            return (
                <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${colors[value as string] ?? ''}`}
                >
                    {String(value)}
                </span>
            );
        },
    },
    {
        key: 'assignee',
        header: 'Assignee',
        sortable: true,
        filterable: true,
        width: 120,
    },
    {
        key: 'createdAt',
        header: 'Created',
        sortable: true,
        format: 'date',
        width: 120,
    },
]);

// ── Demo Component ───────────────────────────────────────────

export function DataTableDemoPage() {
    // Track which demo is active
    const [activeDemo, setActiveDemo] = useState<'basic' | 'selection' | 'server' | 'compact'>('basic');

    // Shared info message state
    const [message, setMessage] = useState<string | null>(null);
    const showMessage = useCallback((msg: string) => setMessage(msg), []);
    const clearMessage = useCallback(() => setMessage(null), []);

    return (
        <div className="flex min-h-[calc(100vh-10rem)] flex-col gap-8">
            {/* Header */}
            <div className="flex flex-col gap-4">
                <Button asChild variant="ghost" className="w-fit">
                    <Link to="/demo">← Back to Demo Gallery</Link>
                </Button>

                <div>
                    <h1 className="text-3xl font-bold tracking-tight">DataTable Demo</h1>
                    <p className="mt-2 text-muted-foreground">
                        Advanced data table built on TanStack Table v8. Supports sorting, pagination, column visibility,
                        row selection, bulk actions, and server-side integration with OttaORM.
                    </p>
                </div>
            </div>

            {/* Demo Tabs */}
            <div className="flex gap-2 border-b border-border pb-2">
                {(['basic', 'selection', 'server', 'compact'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveDemo(tab)}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                            activeDemo === tab
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                    >
                        {tab === 'server' ? 'Server-Side' : tab}
                    </button>
                ))}
            </div>

            {/* Info bar — shows messages from table interactions */}
            <TableMessageContext.Provider value={{ message, showMessage, clearMessage }}>
                <TableInfoBar />

                {/* Demo Content */}
                {activeDemo === 'basic' && <BasicDemo />}
                {activeDemo === 'selection' && <SelectionDemo />}
                {activeDemo === 'server' && <ServerSideDemo />}
                {activeDemo === 'compact' && <CompactDemo />}
            </TableMessageContext.Provider>

            {/* Code Example */}
            <Card>
                <CardHeader>
                    <CardTitle>Usage Example</CardTitle>
                </CardHeader>
                <CardContent>
                    <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
                        <code>{`import { DataTable, useDataTable, createColumns, actionsColumn, selectColumn } from '@ottabase/ui-datatable';

// 1. Define columns declaratively
const columns = createColumns<TodoType>([
    { key: 'title', header: 'Title', sortable: true },
    { key: 'completed', header: 'Done', format: 'boolean' },
    { key: 'createdAt', header: 'Created', format: 'datetime', sortable: true },
]);

// 2. Create the table instance
const { table } = useDataTable({
    data: todos,
    columns: [selectColumn(), ...columns, actionsColumn([
        { label: 'Edit', onClick: (row) => openEdit(row) },
        { label: 'Delete', variant: 'destructive', onClick: (row) => remove(row.id) },
    ])],
    enableRowSelection: true,
});

// 3. Render
return (
    <DataTable
        table={table}
        onRowClick={(row) => navigate(\`/todos/\${row.id}\`)}
        showPagination
        showColumnVisibility
    />
);

// ── Server-side with OttaORM ─────────────────
import { useServerTable } from '@ottabase/ui-datatable';

const { table, isLoading, pagination, setSearchQuery } = useServerTable({
    entityName: 'todos',
    columns,
    perPage: 20,
    defaultSort: 'createdAt',
});

return (
    <DataTable
        table={table}
        isLoading={isLoading}
        pagination={pagination}
        onSearchChange={setSearchQuery}
    />
);`}</code>
                    </pre>
                </CardContent>
            </Card>

            {/* Features */}
            <Card className="bg-muted/50">
                <CardHeader>
                    <CardTitle>Features</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <FeatureItem
                            title="TanStack Table v8"
                            description="Headless-first, fully typed, framework-agnostic table core"
                        />
                        <FeatureItem
                            title="Server-Side Integration"
                            description="useServerTable hook integrates with OttaORM's CRUD API for sort/filter/paginate"
                        />
                        <FeatureItem
                            title="Column Visibility"
                            description="Toggle columns on/off via dropdown — state persists across renders"
                        />
                        <FeatureItem
                            title="Row Selection"
                            description="Checkbox-based multi-select with bulk action toolbar"
                        />
                        <FeatureItem
                            title="Declarative Columns"
                            description="createColumns() helper with format presets: date, boolean, currency, badge, etc."
                        />
                        <FeatureItem
                            title="Theme-Aware"
                            description="Uses CSS variables from @ottabase/ui-shadcn — light/dark mode ready"
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// ── Basic Demo ───────────────────────────────────────────────

function BasicDemo() {
    const { showMessage } = useContext(TableMessageContext);

    const columns = [
        ...todoColumns,
        actionsColumn<Todo>([
            { label: 'Edit', icon: Edit2, onClick: (row) => showMessage(`Edit: ${row.title}`) },
            {
                label: 'Delete',
                icon: Trash2,
                variant: 'destructive',
                onClick: (row) => showMessage(`Delete: ${row.id}`),
            },
        ]),
    ];

    const { table } = useDataTable<Todo>({
        data: MOCK_TODOS,
        columns,
        enablePagination: true,
        initialPageSize: 10,
        initialSorting: [{ id: 'createdAt', desc: true }],
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Basic Table</CardTitle>
                <CardDescription>Client-side sorting, pagination, column visibility, and row actions</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable
                    table={table}
                    onCellClick={(row, columnId, value) =>
                        showMessage(`Row: ${row.title} → Column: ${columnId} → Value: ${String(value ?? '—')}`)
                    }
                    showColumnVisibility
                    showPagination
                />
            </CardContent>
        </Card>
    );
}

// ── Selection Demo ───────────────────────────────────────────

function SelectionDemo() {
    const columns = [selectColumn<Todo>(), ...todoColumns];

    const { showMessage } = useContext(TableMessageContext);

    const bulkActions: DataTableBulkAction<Todo>[] = [
        {
            label: 'Mark Complete',
            icon: CheckCircle2,
            onClick: (rows) => showMessage(`Marking ${rows.length} todos as complete`),
        },
        {
            label: 'Delete',
            icon: Trash2,
            variant: 'destructive',
            onClick: (rows) => showMessage(`Deleting ${rows.length} todos`),
        },
    ];

    const { table, getSelectedRows, clearSelection, selectedCount } = useDataTable<Todo>({
        data: MOCK_TODOS.slice(0, 15),
        columns,
        enableRowSelection: true,
        enablePagination: true,
        initialPageSize: 10,
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Row Selection + Bulk Actions</CardTitle>
                <CardDescription>
                    Select rows with checkboxes. Bulk action toolbar appears when rows are selected.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable table={table} bulkActions={bulkActions} showPagination showColumnVisibility />
            </CardContent>
        </Card>
    );
}

// ── Server-Side Demo ─────────────────────────────────────────

function ServerSideDemo() {
    // Simulate server-side with local state
    const [sorting, setSorting] = useState<DataTableSortingState | null>({
        column: 'createdAt',
        direction: 'desc',
    });
    const [pagination, setPagination] = useState<DataTablePaginationState>({
        page: 1,
        perPage: 10,
        total: MOCK_TODOS.length,
    });
    const [search, setSearch] = useState('');

    // Simulate server filtering
    const filtered = MOCK_TODOS.filter((t) => !search || t.title.toLowerCase().includes(search.toLowerCase()));

    // Simulate server sorting
    const sorted = [...filtered].sort((a, b) => {
        if (!sorting) return 0;
        const aVal = a[sorting.column];
        const bVal = b[sorting.column];
        const cmp = String(aVal).localeCompare(String(bVal));
        return sorting.direction === 'desc' ? -cmp : cmp;
    });

    // Simulate server pagination
    const start = (pagination.page - 1) * pagination.perPage;
    const pageData = sorted.slice(start, start + pagination.perPage);

    const serverPagination: DataTablePaginationState = {
        ...pagination,
        total: filtered.length,
    };

    const { table } = useDataTable<Todo>({
        data: pageData,
        columns: todoColumns,
        manualSorting: true,
        manualPagination: true,
        sorting,
        onSortingChange: setSorting,
        pagination: serverPagination,
        onPaginationChange: setPagination,
        rowCount: filtered.length,
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Server-Side Pagination & Sorting</CardTitle>
                <CardDescription>
                    Simulates server-driven data with manual sorting, pagination, and search. In production, use{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">useServerTable()</code> to connect to
                    OttaORM.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable
                    table={table}
                    searchValue={search}
                    onSearchChange={setSearch}
                    pagination={serverPagination}
                    onPaginationChange={setPagination}
                    showPagination
                    showColumnVisibility
                />
            </CardContent>
        </Card>
    );
}

// ── Compact Demo ─────────────────────────────────────────────

function CompactDemo() {
    const { table } = useDataTable<Todo>({
        data: MOCK_TODOS.slice(0, 20),
        columns: todoColumns,
        enablePagination: true,
        initialPageSize: 10,
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Compact & Striped</CardTitle>
                <CardDescription>Compact mode with striped rows for dense data views.</CardDescription>
            </CardHeader>
            <CardContent>
                <DataTable table={table} compact striped showPagination showColumnVisibility={false} />
            </CardContent>
        </Card>
    );
}

// ── Helper Component ─────────────────────────────────────────

function FeatureItem({ title, description }: { title: string; description: string }) {
    return (
        <div className="space-y-1">
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
    );
}

export default DataTableDemoPage;
