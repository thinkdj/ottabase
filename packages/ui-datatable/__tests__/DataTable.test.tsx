// ============================================================
// @ottabase/ui-datatable - Tests
// ============================================================
// Comprehensive tests for DataTable components and hooks
// ============================================================

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { actionsColumn, createColumns, selectColumn } from '../src/columns/createColumns';
import { DataTable } from '../src/components/DataTable';
import { useDataTable } from '../src/hooks/useDataTable';
import type { DataTableAction, DataTableColumnDef } from '../src/types';
import { formatCellValue, truncateText } from '../src/utils/formatters';

// ── Test data ────────────────────────────────────────────────

interface TestItem {
    id: string;
    name: string;
    email: string;
    active: boolean;
    createdAt: string;
    [key: string]: unknown;
}

const TEST_DATA: TestItem[] = [
    { id: '1', name: 'Alice', email: 'alice@example.com', active: true, createdAt: '2026-01-15T00:00:00Z' },
    { id: '2', name: 'Bob', email: 'bob@example.com', active: false, createdAt: '2026-01-16T00:00:00Z' },
    { id: '3', name: 'Charlie', email: 'charlie@example.com', active: true, createdAt: '2026-01-17T00:00:00Z' },
    { id: '4', name: 'Diana', email: 'diana@example.com', active: false, createdAt: '2026-01-18T00:00:00Z' },
    { id: '5', name: 'Eve', email: 'eve@example.com', active: true, createdAt: '2026-01-19T00:00:00Z' },
];

const TEST_COLUMNS: DataTableColumnDef<TestItem>[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'email', header: 'Email' },
    { key: 'active', header: 'Active', format: 'boolean' },
    { key: 'createdAt', header: 'Created', format: 'date', sortable: true },
];

// ── Helper to render a table with hook ───────────────────────

function TestTable({
    data = TEST_DATA,
    columnDefs = TEST_COLUMNS,
    ...props
}: {
    data?: TestItem[];
    columnDefs?: DataTableColumnDef<TestItem>[];
    onRowClick?: (row: TestItem) => void;
    onCellClick?: (row: TestItem, columnId: string, value: unknown) => void;
    isLoading?: boolean;
    emptyMessage?: string;
}) {
    const columns = createColumns<TestItem>(columnDefs);

    const { table } = useDataTable<TestItem>({
        data,
        columns,
        enablePagination: true,
        initialPageSize: 10,
    });

    return <DataTable table={table} showPagination showColumnVisibility={false} {...props} />;
}

// ── createColumns ────────────────────────────────────────────

describe('createColumns', () => {
    it('creates column definitions from simple config', () => {
        const columns = createColumns<TestItem>([
            { key: 'name', header: 'Name', sortable: true },
            { key: 'email', header: 'Email' },
        ]);

        expect(columns).toHaveLength(2);
        expect(columns[0].id).toBe('name');
        expect(columns[0].enableSorting).toBe(true);
        expect(columns[1].id).toBe('email');
        expect(columns[1].enableSorting).toBe(false);
    });

    it('creates column with custom cell renderer', () => {
        const customCell = vi.fn(() => React.createElement('span', null, 'custom'));

        const columns = createColumns<TestItem>([
            {
                key: 'name',
                header: 'Name',
                cell: customCell,
            },
        ]);

        expect(columns[0].id).toBe('name');
        // Cell is a function wrapper, the custom cell will be called during render
        expect(typeof columns[0].cell).toBe('function');
    });

    it('supports format option', () => {
        const columns = createColumns<TestItem>([
            { key: 'active', header: 'Active', format: 'boolean' },
            { key: 'createdAt', header: 'Created', format: 'date' },
        ]);

        expect(columns).toHaveLength(2);
    });

    it('supports width, minWidth, maxWidth', () => {
        const columns = createColumns<TestItem>([
            { key: 'name', header: 'Name', width: 200, minWidth: 100, maxWidth: 400 },
        ]);

        expect(columns[0].size).toBe(200);
        expect(columns[0].minSize).toBe(100);
        expect(columns[0].maxSize).toBe(400);
    });

    it('passes align and className through meta', () => {
        const columns = createColumns<TestItem>([
            { key: 'name', header: 'Name', align: 'center', className: 'font-bold' },
        ]);

        const meta = columns[0].meta as Record<string, unknown>;
        expect(meta.align).toBe('center');
        expect(meta.className).toBe('font-bold');
    });
});

// ── selectColumn ─────────────────────────────────────────────

describe('selectColumn', () => {
    it('creates a selection column with id _select', () => {
        const col = selectColumn<TestItem>();
        expect(col.id).toBe('_select');
        expect(col.enableSorting).toBe(false);
        expect(col.enableHiding).toBe(false);
    });
});

// ── actionsColumn ────────────────────────────────────────────

describe('actionsColumn', () => {
    it('creates an actions column with id _actions', () => {
        const actions: DataTableAction<TestItem>[] = [
            { label: 'Edit', onClick: vi.fn() },
            { label: 'Delete', variant: 'destructive', onClick: vi.fn() },
        ];

        const col = actionsColumn<TestItem>(actions);
        expect(col.id).toBe('_actions');
        expect(col.enableSorting).toBe(false);
        expect(col.enableHiding).toBe(false);
    });

    it('supports custom id and header', () => {
        const col = actionsColumn<TestItem>([], { id: 'my-actions', header: 'Actions' });
        expect(col.id).toBe('my-actions');
    });

    it('renders inline buttons for 1-2 actions', () => {
        const editFn = vi.fn();
        const deleteFn = vi.fn();

        function ActionsTable() {
            const cols = [
                ...createColumns<TestItem>([{ key: 'name', header: 'Name' }]),
                actionsColumn<TestItem>([
                    { label: 'Edit', onClick: editFn },
                    { label: 'Delete', variant: 'destructive', onClick: deleteFn },
                ]),
            ];
            const { table } = useDataTable<TestItem>({ data: TEST_DATA.slice(0, 1), columns: cols });
            return <DataTable table={table} showPagination={false} showColumnVisibility={false} />;
        }

        render(<ActionsTable />);

        const editBtn = screen.getByTitle('Edit');
        const deleteBtn = screen.getByTitle('Delete');
        expect(editBtn).toBeDefined();
        expect(deleteBtn).toBeDefined();

        fireEvent.click(editBtn);
        expect(editFn).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));

        fireEvent.click(deleteBtn);
        expect(deleteFn).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    });

    it('renders dropdown trigger for 3+ actions', () => {
        function DropdownTable() {
            const cols = [
                ...createColumns<TestItem>([{ key: 'name', header: 'Name' }]),
                actionsColumn<TestItem>([
                    { label: 'Edit', onClick: vi.fn() },
                    { label: 'View', onClick: vi.fn() },
                    { label: 'Delete', onClick: vi.fn() },
                ]),
            ];
            const { table } = useDataTable<TestItem>({ data: TEST_DATA.slice(0, 1), columns: cols });
            return <DataTable table={table} showPagination={false} showColumnVisibility={false} />;
        }

        render(<DropdownTable />);

        // Should show the "Row actions" trigger button instead of inline buttons
        const trigger = screen.getByLabelText('Row actions');
        expect(trigger).toBeDefined();

        // Click to open dropdown
        fireEvent.click(trigger);

        // All 3 actions should be visible in the dropdown
        expect(screen.getByText('Edit')).toBeDefined();
        expect(screen.getByText('View')).toBeDefined();
        expect(screen.getByText('Delete')).toBeDefined();
    });
});

// ── formatCellValue ──────────────────────────────────────────

describe('formatCellValue', () => {
    it('handles null/undefined values', () => {
        const result = formatCellValue(null, 'date');
        expect(result).toBeDefined();
    });

    it('formats currency values', () => {
        const result = formatCellValue(1234.56, 'currency');
        expect(result).toBe('$1,234.56');
    });

    it('formats percentage values', () => {
        const result = formatCellValue(75.5, 'percentage');
        expect(result).toBe('75.5%');
    });

    it('formats boolean true', () => {
        const result = formatCellValue(true, 'boolean');
        expect(result).toBeDefined();
    });

    it('formats boolean false', () => {
        const result = formatCellValue(false, 'boolean');
        expect(result).toBeDefined();
    });

    it('formats badge', () => {
        const result = formatCellValue('Active', 'badge');
        expect(result).toBeDefined();
    });
});

// ── truncateText ─────────────────────────────────────────────

describe('truncateText', () => {
    it('returns original text when shorter than maxLength', () => {
        expect(truncateText('Hello', 10)).toBe('Hello');
    });

    it('truncates text with ellipsis when longer than maxLength', () => {
        expect(truncateText('Hello World', 5)).toBe('Hello…');
    });

    it('handles exact length', () => {
        expect(truncateText('Hello', 5)).toBe('Hello');
    });
});

// ── useDataTable ─────────────────────────────────────────────

describe('useDataTable', () => {
    it('creates a table instance with data', () => {
        const columns = createColumns<TestItem>([{ key: 'name', header: 'Name' }]);

        const { result } = renderHook(() =>
            useDataTable<TestItem>({
                data: TEST_DATA,
                columns,
            }),
        );

        expect(result.current.table).toBeDefined();
        expect(result.current.table.getRowModel().rows).toHaveLength(TEST_DATA.length);
    });

    it('tracks row selection state', () => {
        const columns = [selectColumn<TestItem>(), ...createColumns<TestItem>([{ key: 'name', header: 'Name' }])];

        const { result } = renderHook(() =>
            useDataTable<TestItem>({
                data: TEST_DATA,
                columns,
                enableRowSelection: true,
            }),
        );

        expect(result.current.hasSelection).toBe(false);
        expect(result.current.selectedCount).toBe(0);

        act(() => {
            result.current.table.getRowModel().rows[0].toggleSelected(true);
        });

        expect(result.current.hasSelection).toBe(true);
        expect(result.current.selectedCount).toBe(1);
    });

    it('clears selection via clearSelection', () => {
        const columns = createColumns<TestItem>([{ key: 'name', header: 'Name' }]);

        const { result } = renderHook(() =>
            useDataTable<TestItem>({
                data: TEST_DATA,
                columns,
                enableRowSelection: true,
            }),
        );

        act(() => {
            result.current.table.getRowModel().rows[0].toggleSelected(true);
        });
        expect(result.current.selectedCount).toBe(1);

        act(() => {
            result.current.clearSelection();
        });
        expect(result.current.selectedCount).toBe(0);
    });

    it('handles manual sorting state', () => {
        const onSortingChange = vi.fn();
        const columns = createColumns<TestItem>([{ key: 'name', header: 'Name', sortable: true }]);

        const { result } = renderHook(() =>
            useDataTable<TestItem>({
                data: TEST_DATA,
                columns,
                manualSorting: true,
                sorting: { column: 'name', direction: 'asc' },
                onSortingChange,
            }),
        );

        // Sorting should reflect the server state
        expect(result.current.sorting).toEqual([{ id: 'name', desc: false }]);
    });

    it('supports initial column visibility', () => {
        const columns = createColumns<TestItem>([
            { key: 'name', header: 'Name' },
            { key: 'email', header: 'Email' },
        ]);

        const { result } = renderHook(() =>
            useDataTable<TestItem>({
                data: TEST_DATA,
                columns,
                initialColumnVisibility: { email: false },
            }),
        );

        expect(result.current.columnVisibility).toEqual({ email: false });
    });

    it('supports client-side pagination', () => {
        const columns = createColumns<TestItem>([{ key: 'name', header: 'Name' }]);

        const { result } = renderHook(() =>
            useDataTable<TestItem>({
                data: TEST_DATA,
                columns,
                enablePagination: true,
                initialPageSize: 2,
            }),
        );

        // With page size 2, only 2 rows should show on the first page
        expect(result.current.table.getRowModel().rows.length).toBe(2);
    });
});

// ── DataTable Component ──────────────────────────────────────

describe('DataTable component', () => {
    it('renders table headers', () => {
        render(<TestTable />);

        expect(screen.getByText('Name')).toBeDefined();
        expect(screen.getByText('Email')).toBeDefined();
        expect(screen.getByText('Active')).toBeDefined();
        expect(screen.getByText('Created')).toBeDefined();
    });

    it('renders data rows', () => {
        render(<TestTable />);

        expect(screen.getByText('Alice')).toBeDefined();
        expect(screen.getByText('Bob')).toBeDefined();
        expect(screen.getByText('Charlie')).toBeDefined();
    });

    it('shows loading state', () => {
        render(<TestTable isLoading />);

        expect(screen.getByText('Loading…')).toBeDefined();
    });

    it('shows empty state', () => {
        render(<TestTable data={[]} emptyMessage="Nothing here" />);

        expect(screen.getByText('Nothing here')).toBeDefined();
    });

    it('calls onRowClick when row is clicked', () => {
        const onRowClick = vi.fn();
        render(<TestTable onRowClick={onRowClick} />);

        fireEvent.click(screen.getByText('Alice'));
        expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ id: '1', name: 'Alice' }));
    });

    it('calls onCellClick with row, columnId, and value', () => {
        const onCellClick = vi.fn();
        render(<TestTable onCellClick={onCellClick} />);

        fireEvent.click(screen.getByText('Alice'));
        expect(onCellClick).toHaveBeenCalledWith(expect.objectContaining({ id: '1', name: 'Alice' }), 'name', 'Alice');
    });

    it('onCellClick prevents onRowClick from firing', () => {
        const onRowClick = vi.fn();
        const onCellClick = vi.fn();
        render(<TestTable onRowClick={onRowClick} onCellClick={onCellClick} />);

        fireEvent.click(screen.getByText('Bob'));

        // onCellClick should fire
        expect(onCellClick).toHaveBeenCalledWith(expect.objectContaining({ id: '2', name: 'Bob' }), 'name', 'Bob');
        // onRowClick should NOT fire because onCellClick stops propagation
        expect(onRowClick).not.toHaveBeenCalled();
    });

    it('renders pagination controls', () => {
        render(<TestTable />);

        expect(screen.getByLabelText('First page')).toBeDefined();
        expect(screen.getByLabelText('Previous page')).toBeDefined();
        expect(screen.getByLabelText('Next page')).toBeDefined();
        expect(screen.getByLabelText('Last page')).toBeDefined();
    });
});
