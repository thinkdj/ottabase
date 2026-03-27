// ============================================================
// @ottabase/forms - ModelTable Component
// ============================================================
// Auto-generated list/table view powered by @ottabase/ui-datatable
// Converts OttaORM model metadata into DataTable columns automatically
// ============================================================

import type {
    DataTableAction,
    DataTableColumnDef,
    DataTablePaginationState,
    DataTableSortingState,
} from '@ottabase/ui-datatable';
import { actionsColumn, createColumns, DataTable, selectColumn, useDataTable } from '@ottabase/ui-datatable';
import { Edit2, Eye, Plus, Trash2 } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import type { ModelFieldDescriptor, ModelTableProps } from '../types';

// Re-export for backwards compatibility
export type { ModelTableProps } from '../types';

/**
 * ModelTable — auto-generated table/list view for model records.
 *
 * Now powered by `@ottabase/ui-datatable` under the hood. Converts OttaORM
 * model field metadata into DataTable column definitions, providing sorting,
 * pagination, row selection, search, and row actions out of the box.
 */
export function ModelTable<T extends Record<string, unknown>>({
    config,
    data = [],
    isLoading = false,
    total,
    page = 1,
    perPage = 10,
    onPageChange,
    onRowClick,
    onView,
    onEdit,
    onDelete,
    onCreate,
    onSortChange,
    sortField,
    sortDirection = 'asc',
    onSearch,
    searchPlaceholder,
    selectable = false,
    selectedIds: _selectedIds = [],
    onSelectionChange: _onSelectionChange,
    className,
    emptyMessage,
}: ModelTableProps<T>) {
    const [searchQuery, setSearchQuery] = useState('');

    const primaryKey = config.primaryKey || 'id';
    const displayName = config.displayName || capitalize(singularize(config.entity));
    const displayNamePlural = config.displayNamePlural || config.entity;

    // ── Convert model fields to DataTable column defs ────────

    const dataColumns = useMemo(() => {
        const fields: { key: string; field: ModelFieldDescriptor; order: number }[] = [];

        for (const [key, field] of Object.entries(config.fields)) {
            if (field.tableConfig?.visible === false) continue;
            fields.push({ key, field, order: field.tableConfig?.order ?? 999 });
        }

        fields.sort((a, b) => a.order - b.order);

        return createColumns<T>(
            fields.map(({ key, field }) => {
                const col: DataTableColumnDef<T> = {
                    key: key as string & keyof T,
                    header: field.uiConfig?.label || capitalize(key),
                    sortable: field.sortable ?? false,
                    filterable: field.filterable ?? false,
                    width: field.tableConfig?.colWidth,
                };

                // Map format from field metadata
                const format = field.tableConfig?.format ?? mapFieldTypeToFormat(field.type);
                if (format) {
                    col.format = format as DataTableColumnDef<T>['format'];
                }

                return col;
            }),
        );
    }, [config.fields]);

    // ── Build row actions column ─────────────────────────────

    const hasActions = !!(onView || onEdit || onDelete);

    const actionsDef = useMemo(() => {
        if (!hasActions) return null;

        const actions: DataTableAction<T>[] = [];
        if (onView) actions.push({ label: 'View', icon: Eye, onClick: (row) => onView(row) });
        if (onEdit) actions.push({ label: 'Edit', icon: Edit2, onClick: (row) => onEdit(row) });
        if (onDelete) {
            actions.push({
                label: 'Delete',
                icon: Trash2,
                variant: 'destructive',
                separator: true,
                onClick: (row) => onDelete(row),
            });
        }

        return actionsColumn<T>(actions, { header: 'Actions' });
    }, [hasActions, onView, onEdit, onDelete]);

    // ── Assemble final columns ───────────────────────────────

    const columns = useMemo(() => {
        const cols = [...(selectable ? [selectColumn<T>()] : []), ...dataColumns];
        if (actionsDef) cols.push(actionsDef);
        return cols;
    }, [selectable, dataColumns, actionsDef]);

    // ── Sorting state bridge ─────────────────────────────────

    const sorting = useMemo<DataTableSortingState | null>(
        () => (sortField ? { column: sortField, direction: sortDirection } : null),
        [sortField, sortDirection],
    );

    const handleSortingChange = useCallback(
        (newSorting: DataTableSortingState | null) => {
            if (!onSortChange || !newSorting) return;
            onSortChange(newSorting.column, newSorting.direction);
        },
        [onSortChange],
    );

    // ── Pagination state bridge ──────────────────────────────

    const pagination = useMemo<DataTablePaginationState>(
        () => ({ page, perPage, total: total ?? data.length }),
        [page, perPage, total, data.length],
    );

    const handlePaginationChange = useCallback(
        (newPagination: DataTablePaginationState) => {
            onPageChange?.(newPagination.page);
        },
        [onPageChange],
    );

    // ── Search handler ───────────────────────────────────────

    const handleSearchChange = useCallback(
        (value: string) => {
            setSearchQuery(value);
            onSearch?.(value);
        },
        [onSearch],
    );

    // ── useDataTable hook ────────────────────────────────────

    const { table } = useDataTable<T>({
        data,
        columns,
        getRowId: (row) => String(row[primaryKey] ?? ''),
        enableRowSelection: selectable,
        manualSorting: true,
        manualPagination: true,
        sorting,
        onSortingChange: handleSortingChange,
        pagination,
        onPaginationChange: handlePaginationChange,
        rowCount: total,
    });

    // ── Create button for toolbar ────────────────────────────

    const createButton = onCreate
        ? React.createElement(
              'button',
              {
                  onClick: onCreate,
                  className:
                      'inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90',
              },
              React.createElement(Plus, { className: 'h-4 w-4' }),
              `Add ${displayName}`,
          )
        : undefined;

    // ── Render ───────────────────────────────────────────────

    return (
        <div className={className}>
            <DataTable
                table={table}
                onRowClick={onRowClick}
                isLoading={isLoading}
                emptyMessage={emptyMessage || `No ${displayNamePlural.toLowerCase()} found`}
                searchValue={onSearch ? searchQuery : undefined}
                onSearchChange={onSearch ? handleSearchChange : undefined}
                searchPlaceholder={searchPlaceholder || `Search ${displayNamePlural.toLowerCase()}...`}
                showColumnVisibility
                toolbarRight={createButton}
                pagination={pagination}
                onPaginationChange={handlePaginationChange}
                showPagination={!!(onPageChange && total !== undefined && total > perPage)}
            />
        </div>
    );
}

// ============================================================
// Utility Functions
// ============================================================

/** Map OttaORM field type to DataTable format name */
function mapFieldTypeToFormat(type: string): string | undefined {
    switch (type) {
        case 'boolean':
            return 'boolean';
        case 'date':
            return 'date';
        case 'datetime':
            return 'datetime';
        default:
            return undefined;
    }
}

function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function singularize(str: string): string {
    if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (str.endsWith('s')) return str.slice(0, -1);
    return str;
}

export default ModelTable;
