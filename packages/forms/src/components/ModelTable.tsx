// ============================================================
// @ottabase/forms - ModelTable Component
// ============================================================
// Auto-generated list/table view from model metadata
// ============================================================

import React, { useMemo, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import {
    ChevronUp,
    ChevronDown,
    Edit2,
    Trash2,
    Eye,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Search,
    Plus,
    Check,
} from 'lucide-react';
import type { ModelTableProps, ModelFieldDescriptor } from '../types';

// Re-export for backwards compatibility
export type { ModelTableProps } from '../types';

interface ColumnEntry {
    key: string;
    field: ModelFieldDescriptor;
    order: number;
    width?: string | number;
}

/**
 * ModelTable - Auto-generated table/list view for model records
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
    selectedIds = [],
    onSelectionChange,
    className,
    emptyMessage,
}: ModelTableProps<T>) {
    const [searchQuery, setSearchQuery] = useState('');

    // Get visible table columns sorted by order
    const columns = useMemo(() => {
        const cols: ColumnEntry[] = [];

        for (const [key, field] of Object.entries(config.fields)) {
            // Skip if table visibility is explicitly false
            if (field.tableConfig?.visible === false) continue;

            cols.push({
                key,
                field,
                order: field.tableConfig?.order ?? 999,
                width: field.tableConfig?.colWidth,
            });
        }

        return cols.sort((a, b) => a.order - b.order);
    }, [config.fields]);

    // Get primary key
    const primaryKey = config.primaryKey || 'id';

    // Check if all rows are selected
    const allSelected = useMemo(() => {
        if (data.length === 0) return false;
        return data.every((row) => selectedIds.includes(row[primaryKey] as string | number));
    }, [data, selectedIds, primaryKey]);

    // Handle select all
    const handleSelectAll = useCallback(() => {
        if (!onSelectionChange) return;

        if (allSelected) {
            // Deselect all current page items
            const currentIds = data.map((row) => row[primaryKey] as string | number);
            onSelectionChange(selectedIds.filter((id) => !currentIds.includes(id)));
        } else {
            // Select all current page items
            const currentIds = data.map((row) => row[primaryKey] as string | number);
            const newIds = [...new Set([...selectedIds, ...currentIds])];
            onSelectionChange(newIds);
        }
    }, [data, selectedIds, allSelected, primaryKey, onSelectionChange]);

    // Handle single row selection
    const handleSelectRow = useCallback(
        (id: string | number) => {
            if (!onSelectionChange) return;

            if (selectedIds.includes(id)) {
                onSelectionChange(selectedIds.filter((i) => i !== id));
            } else {
                onSelectionChange([...selectedIds, id]);
            }
        },
        [selectedIds, onSelectionChange],
    );

    // Handle sort
    const handleSort = useCallback(
        (key: string) => {
            if (!onSortChange) return;

            const field = config.fields[key];
            if (!field?.sortable) return;

            const newDirection = sortField === key && sortDirection === 'asc' ? 'desc' : 'asc';
            onSortChange(key, newDirection);
        },
        [config.fields, sortField, sortDirection, onSortChange],
    );

    // Handle search
    const handleSearch = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault();
            onSearch?.(searchQuery);
        },
        [searchQuery, onSearch],
    );

    // Calculate pagination
    const totalPages = total ? Math.ceil(total / perPage) : 1;
    const hasActions = onView || onEdit || onDelete;
    const displayName = config.displayName || capitalize(singularize(config.entity));
    const displayNamePlural = config.displayNamePlural || config.entity;

    return (
        <div className={clsx('space-y-4', className)}>
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {capitalize(displayNamePlural)}
                </h2>

                <div className="flex items-center gap-3">
                    {/* Search */}
                    {onSearch && (
                        <form onSubmit={handleSearch} className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={searchPlaceholder || `Search ${displayNamePlural.toLowerCase()}...`}
                                className={clsx(
                                    'pl-9 pr-4 py-2 rounded-lg border',
                                    'bg-white dark:bg-gray-800',
                                    'border-gray-300 dark:border-gray-600',
                                    'text-gray-900 dark:text-gray-100',
                                    'placeholder:text-gray-400 dark:placeholder:text-gray-500',
                                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                                )}
                            />
                        </form>
                    )}

                    {/* Create button */}
                    {onCreate && (
                        <button
                            onClick={onCreate}
                            className={clsx(
                                'px-4 py-2 rounded-lg font-medium transition-colors',
                                'bg-blue-600 hover:bg-blue-700 text-white',
                                'flex items-center gap-2',
                            )}
                        >
                            <Plus className="w-4 h-4" />
                            Add {displayName}
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800">
                            <tr>
                                {/* Selection checkbox */}
                                {selectable && (
                                    <th className="w-12 px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={allSelected}
                                            onChange={handleSelectAll}
                                            className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600"
                                        />
                                    </th>
                                )}

                                {/* Data columns */}
                                {columns.map(({ key, field, width }) => (
                                    <th
                                        key={key}
                                        className={clsx(
                                            'px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300',
                                            field.sortable &&
                                                onSortChange &&
                                                'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700',
                                        )}
                                        style={{
                                            width: width
                                                ? typeof width === 'number'
                                                    ? `${width}px`
                                                    : width
                                                : undefined,
                                        }}
                                        onClick={() => field.sortable && handleSort(key)}
                                    >
                                        <div className="flex items-center gap-1">
                                            {field.uiConfig?.label || capitalize(key)}
                                            {field.sortable &&
                                                onSortChange &&
                                                sortField === key &&
                                                (sortDirection === 'asc' ? (
                                                    <ChevronUp className="w-4 h-4" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4" />
                                                ))}
                                        </div>
                                    </th>
                                ))}

                                {/* Actions column */}
                                {hasActions && (
                                    <th className="w-32 px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Actions
                                    </th>
                                )}
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {isLoading ? (
                                <tr>
                                    <td
                                        colSpan={columns.length + (selectable ? 1 : 0) + (hasActions ? 1 : 0)}
                                        className="px-4 py-12 text-center"
                                    >
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading...</p>
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={columns.length + (selectable ? 1 : 0) + (hasActions ? 1 : 0)}
                                        className="px-4 py-12 text-center"
                                    >
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {emptyMessage || `No ${displayNamePlural.toLowerCase()} found`}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                data.map((row) => {
                                    const rowId = row[primaryKey] as string | number;
                                    const isSelected = selectedIds.includes(rowId);

                                    return (
                                        <tr
                                            key={rowId}
                                            className={clsx(
                                                'bg-white dark:bg-gray-900',
                                                onRowClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800',
                                                isSelected && 'bg-blue-50 dark:bg-blue-900/20',
                                            )}
                                            onClick={() => onRowClick?.(row)}
                                        >
                                            {/* Selection checkbox */}
                                            {selectable && (
                                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleSelectRow(rowId)}
                                                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600"
                                                    />
                                                </td>
                                            )}

                                            {/* Data cells */}
                                            {columns.map(({ key, field }) => (
                                                <td
                                                    key={key}
                                                    className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100"
                                                >
                                                    {formatCellValue(row[key], field)}
                                                </td>
                                            ))}

                                            {/* Actions */}
                                            {hasActions && (
                                                <td
                                                    className="px-4 py-3 text-right"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div className="flex items-center justify-end gap-1">
                                                        {onView && (
                                                            <button
                                                                onClick={() => onView(row)}
                                                                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                                                title="View"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {onEdit && (
                                                            <button
                                                                onClick={() => onEdit(row)}
                                                                className="p-1.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                                                title="Edit"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {onDelete && (
                                                            <button
                                                                onClick={() => onDelete(row)}
                                                                className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {onPageChange && total !== undefined && total > perPage && (
                <div className="flex items-center justify-between px-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, total)} of {total} results
                    </p>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onPageChange(page - 1)}
                            disabled={page <= 1}
                            className={clsx(
                                'p-2 rounded-lg border transition-colors',
                                'border-gray-300 dark:border-gray-600',
                                page <= 1
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-800',
                            )}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                            Page {page} of {totalPages}
                        </span>

                        <button
                            onClick={() => onPageChange(page + 1)}
                            disabled={page >= totalPages}
                            className={clsx(
                                'p-2 rounded-lg border transition-colors',
                                'border-gray-300 dark:border-gray-600',
                                page >= totalPages
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-800',
                            )}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================
// Utility Functions
// ============================================================

function formatCellValue(value: unknown, field: ModelFieldDescriptor): React.ReactNode {
    if (value === null || value === undefined) {
        return <span className="text-gray-400">-</span>;
    }

    const format = field.tableConfig?.format;

    // Handle specific formats
    if (format) {
        switch (format) {
            case 'date':
                return new Date(value as string).toLocaleDateString();
            case 'datetime':
                return new Date(value as string).toLocaleString();
            case 'boolean':
                return value ? <Check className="w-4 h-4 text-green-500" /> : <span className="text-gray-400">-</span>;
            case 'currency':
                return new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                }).format(Number(value));
            case 'percentage':
                return `${Number(value).toFixed(1)}%`;
            case 'image':
                return <img src={String(value)} alt="" className="w-8 h-8 rounded-full object-cover" />;
            case 'link':
                return (
                    <a
                        href={String(value)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {String(value)}
                    </a>
                );
        }
    }

    // Handle by field type
    switch (field.type) {
        case 'boolean':
            return value ? <Check className="w-4 h-4 text-green-500" /> : <span className="text-gray-400">-</span>;
        case 'date':
            return new Date(value as string).toLocaleDateString();
        case 'datetime':
            return new Date(value as string).toLocaleString();
        case 'json':
            return (
                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                    {JSON.stringify(value).slice(0, 50)}...
                </code>
            );
        case 'array':
            if (Array.isArray(value)) {
                return value.slice(0, 3).join(', ') + (value.length > 3 ? '...' : '');
            }
            return String(value);
        default:
            const str = String(value);
            // Truncate long strings
            return str.length > 100 ? str.slice(0, 100) + '...' : str;
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
