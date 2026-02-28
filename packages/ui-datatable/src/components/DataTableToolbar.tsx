// ============================================================
// @ottabase/ui-datatable - DataTableToolbar
// ============================================================
// Search, filters, column visibility, and bulk action bar
// ============================================================

import type { Table } from '@tanstack/react-table';
import { clsx } from 'clsx';
import { Search, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import type { DataTableBulkAction } from '../types';
import { DataTableViewOptions } from './DataTableViewOptions';

interface DataTableToolbarProps<TData> {
    table: Table<TData>;
    /** Controlled search value */
    searchValue?: string;
    /** Search change handler */
    onSearchChange?: (value: string) => void;
    /** Search placeholder */
    searchPlaceholder?: string;
    /** Whether to show column visibility toggle */
    showColumnVisibility?: boolean;
    /** Bulk actions (shown when rows selected) */
    bulkActions?: DataTableBulkAction<TData>[];
    /** Number of selected rows */
    selectedCount?: number;
    /** Get selected row data */
    getSelectedRows?: () => TData[];
    /** Clear row selection */
    clearSelection?: () => void;
    /** Extra controls on the right side */
    toolbarRight?: React.ReactNode;
    /** Extra controls on the left side */
    toolbarLeft?: React.ReactNode;
}

/**
 * Toolbar for the DataTable — search input, column visibility toggle,
 * bulk action buttons, and custom slots.
 */
export function DataTableToolbar<TData>({
    table,
    searchValue: controlledSearch,
    onSearchChange,
    searchPlaceholder = 'Search...',
    showColumnVisibility = true,
    bulkActions,
    selectedCount = 0,
    getSelectedRows,
    clearSelection,
    toolbarRight,
    toolbarLeft,
}: DataTableToolbarProps<TData>) {
    const [internalSearch, setInternalSearch] = useState('');

    // Use controlled or internal search state
    const searchValue = controlledSearch ?? internalSearch;
    const handleSearchChange = useCallback(
        (value: string) => {
            if (onSearchChange) {
                onSearchChange(value);
            } else {
                setInternalSearch(value);
                // Client-side global filter
                table.setGlobalFilter(value);
            }
        },
        [onSearchChange, table],
    );

    const hasBulkSelection = selectedCount > 0 && bulkActions && bulkActions.length > 0;

    return (
        <div className="flex items-center justify-between gap-3">
            {/* Left side */}
            <div className="flex flex-1 items-center gap-3">
                {/* Bulk action bar (when rows selected) */}
                {hasBulkSelection ? (
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">{selectedCount} selected</span>
                        {bulkActions!.map((action, i) => (
                            <button
                                key={i}
                                onClick={() => action.onClick(getSelectedRows?.() ?? [])}
                                className={clsx(
                                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                                    action.variant === 'destructive'
                                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                        : action.variant === 'outline'
                                          ? 'border border-input hover:bg-accent'
                                          : 'bg-primary text-primary-foreground hover:bg-primary/90',
                                )}
                            >
                                {action.icon && <action.icon className="h-4 w-4" />}
                                {action.label}
                            </button>
                        ))}
                        <button
                            onClick={clearSelection}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                        >
                            <X className="h-3.5 w-3.5" />
                            Clear
                        </button>
                    </div>
                ) : (
                    <>
                        {toolbarLeft}

                        {/* Search input */}
                        {(onSearchChange || !controlledSearch) && (
                            <div className="relative max-w-sm">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchValue}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    placeholder={searchPlaceholder}
                                    className={clsx(
                                        'h-9 w-full rounded-md border border-input bg-background pl-10 pr-8 text-sm transition-colors',
                                        'placeholder:text-muted-foreground',
                                        'focus:outline-none focus:ring-1 focus:ring-ring',
                                    )}
                                />
                                {searchValue && (
                                    <button
                                        aria-label="Clear search"
                                        onClick={() => handleSearchChange('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">
                {toolbarRight}
                {showColumnVisibility && <DataTableViewOptions table={table} />}
            </div>
        </div>
    );
}
