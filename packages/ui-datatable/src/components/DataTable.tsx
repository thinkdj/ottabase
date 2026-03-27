// ============================================================
// @ottabase/ui-datatable - DataTable Component
// ============================================================
// Main table UI component rendering TanStack Table state
// Uses semantic HTML + theme CSS variables for consistent styling
// ============================================================

import { flexRender } from '@tanstack/react-table';
import { clsx } from 'clsx';
import { Inbox, Loader2 } from 'lucide-react';
import type { DataTableProps } from '../types';
import { DataTableColumnHeader } from './DataTableColumnHeader';
import { DataTablePagination } from './DataTablePagination';
import { DataTableToolbar } from './DataTableToolbar';

/**
 * DataTable — the primary table renderer.
 *
 * Renders header, body, toolbar, and pagination from a TanStack Table instance.
 * Designed to be composed with `useDataTable()` or `useServerTable()`.
 *
 * @example
 * ```tsx
 * const { table, ...rest } = useDataTable({ data, columns });
 *
 * return (
 *     <DataTable
 *         table={table}
 *         onRowClick={(row) => navigate(`/items/${row.id}`)}
 *         showPagination
 *     />
 * );
 * ```
 */
export function DataTable<TData extends Record<string, unknown>>({
    table,
    onRowClick,
    onCellClick,
    isLoading = false,
    emptyMessage = 'No results found.',
    emptyIcon: EmptyIcon = Inbox,
    showColumnVisibility = true,
    searchValue,
    onSearchChange,
    searchPlaceholder,
    bulkActions,
    toolbarRight,
    toolbarLeft,
    className,
    pagination,
    onPaginationChange,
    pageSizeOptions,
    showPagination = true,
    compact = false,
    striped = false,
    bordered = false,
    stickyHeader = false,
    maxHeight,
}: DataTableProps<TData>) {
    const headerGroups = table.getHeaderGroups();
    const rows = table.getRowModel().rows;
    const selectedCount = Object.keys(table.getState().rowSelection).length;
    const totalColumns = headerGroups[0]?.headers.length ?? 1;

    // Helpers to retrieve selected rows & clear selection
    const getSelectedRows = () => table.getSelectedRowModel().rows.map((r) => r.original);
    const clearSelection = () => table.resetRowSelection();

    // Show toolbar if we have search, bulk actions, custom slots, or column visibility
    const showToolbar =
        onSearchChange !== undefined ||
        searchValue !== undefined ||
        bulkActions !== undefined ||
        toolbarRight !== undefined ||
        toolbarLeft !== undefined ||
        showColumnVisibility;

    const cellPadding = compact ? 'px-2 py-1.5' : 'px-3 py-2.5';
    const headerPadding = compact ? 'px-2 py-2' : 'px-3 py-3';

    return (
        <div className={clsx('space-y-3', className)}>
            {/* Toolbar */}
            {showToolbar && (
                <DataTableToolbar
                    table={table}
                    searchValue={searchValue}
                    onSearchChange={onSearchChange}
                    searchPlaceholder={searchPlaceholder}
                    showColumnVisibility={showColumnVisibility}
                    bulkActions={bulkActions}
                    selectedCount={selectedCount}
                    getSelectedRows={getSelectedRows}
                    clearSelection={clearSelection}
                    toolbarRight={toolbarRight}
                    toolbarLeft={toolbarLeft}
                />
            )}

            {/* Table container */}
            <div
                className={clsx(
                    'overflow-hidden rounded-lg border border-border',
                    stickyHeader || maxHeight ? 'relative' : '',
                )}
            >
                <div
                    className="overflow-x-auto"
                    style={
                        maxHeight
                            ? {
                                  maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
                                  overflowY: 'auto',
                              }
                            : undefined
                    }
                >
                    <table className="w-full caption-bottom text-sm">
                        {/* Header */}
                        <thead
                            className={clsx(
                                'bg-muted/50 [&_tr]:border-b',
                                stickyHeader && 'sticky top-0 z-10 bg-muted/95 backdrop-blur-sm',
                            )}
                        >
                            {headerGroups.map((headerGroup) => (
                                <tr key={headerGroup.id} className="border-b transition-colors">
                                    {headerGroup.headers.map((header) => {
                                        const meta = header.column.columnDef.meta as
                                            | Record<string, unknown>
                                            | undefined;
                                        const align = (meta?.align as string) ?? 'left';

                                        return (
                                            <th
                                                key={header.id}
                                                className={clsx(
                                                    headerPadding,
                                                    'text-muted-foreground font-medium',
                                                    align === 'center' && 'text-center',
                                                    align === 'right' && 'text-right',
                                                    bordered && 'border-r last:border-r-0',
                                                )}
                                                style={{
                                                    width: header.getSize() !== 150 ? header.getSize() : undefined,
                                                    minWidth: header.column.columnDef.minSize,
                                                    maxWidth: header.column.columnDef.maxSize,
                                                }}
                                            >
                                                {header.isPlaceholder ? null : (
                                                    <DataTableColumnHeader
                                                        column={header.column}
                                                        title={
                                                            typeof header.column.columnDef.header === 'string'
                                                                ? header.column.columnDef.header
                                                                : header.column.id
                                                        }
                                                    />
                                                )}
                                            </th>
                                        );
                                    })}
                                </tr>
                            ))}
                        </thead>

                        {/* Body */}
                        <tbody className="[&_tr:last-child]:border-0">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={totalColumns} className="h-32">
                                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                            <span className="text-sm">Loading…</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={totalColumns} className="h-32">
                                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                                            <EmptyIcon className="h-10 w-10 opacity-40" />
                                            <span className="text-sm">{emptyMessage}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                rows.map((row, rowIdx) => {
                                    const isSelected = row.getIsSelected();

                                    return (
                                        <tr
                                            key={row.id}
                                            data-state={isSelected ? 'selected' : undefined}
                                            className={clsx(
                                                'border-b transition-colors',
                                                'hover:bg-muted/50',
                                                isSelected && 'bg-muted',
                                                striped && rowIdx % 2 === 1 && 'bg-muted/25',
                                                onRowClick && 'cursor-pointer',
                                            )}
                                            onClick={() => onRowClick?.(row.original)}
                                        >
                                            {row.getVisibleCells().map((cell) => {
                                                const meta = cell.column.columnDef.meta as
                                                    | Record<string, unknown>
                                                    | undefined;
                                                const align = (meta?.align as string) ?? 'left';
                                                const cellClassName = (meta?.className as string) ?? '';

                                                return (
                                                    <td
                                                        key={cell.id}
                                                        className={clsx(
                                                            cellPadding,
                                                            'align-middle',
                                                            align === 'center' && 'text-center',
                                                            align === 'right' && 'text-right',
                                                            bordered && 'border-r last:border-r-0',
                                                            cellClassName,
                                                        )}
                                                        onClick={
                                                            onCellClick
                                                                ? (e) => {
                                                                      e.stopPropagation();
                                                                      onCellClick(
                                                                          row.original,
                                                                          cell.column.id,
                                                                          cell.getValue(),
                                                                      );
                                                                  }
                                                                : undefined
                                                        }
                                                    >
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {showPagination && (
                <DataTablePagination
                    table={table}
                    pagination={pagination}
                    onPaginationChange={onPaginationChange}
                    pageSizeOptions={pageSizeOptions}
                    selectedCount={selectedCount}
                />
            )}
        </div>
    );
}
