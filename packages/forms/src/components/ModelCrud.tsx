// ============================================================
// @ottabase/forms - ModelCrud Component
// ============================================================
// Complete CRUD interface combining list, detail, create, edit views
// ============================================================

import React, { useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ModelTable } from './ModelTable';
import { ModelDetail } from './ModelDetail';
import { ModelForm } from './ModelForm';
import type { ModelCrudProps, CrudViewMode } from '../types';

export type { ModelCrudProps } from '../types';

interface PaginationResult<T> {
    data: T[];
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

/**
 * ModelCrud - Complete CRUD interface for a model
 *
 * Features:
 * - List view with pagination, sorting, search
 * - Detail view with key/value display
 * - Create form with validation
 * - Edit form with validation
 * - Delete confirmation
 * - Integrated with TanStack Query for caching
 */
export function ModelCrud<T extends Record<string, unknown>>({
    config,
    initialMode = 'list',
    initialRecordId,
    onCreate,
    onUpdate,
    onDelete,
    header,
    className,
    apiBasePath = '/api/ottaorm',
    perPage = 10,
    selectable = false,
    fetchFn = fetch,
}: ModelCrudProps<T>) {
    const queryClient = useQueryClient();
    const primaryKey = config.primaryKey || 'id';
    const apiPath = config.apiPath || `${apiBasePath}/${config.entity}`;

    // View state
    const [viewMode, setViewMode] = useState<CrudViewMode>(initialMode);
    const [selectedRecordId, setSelectedRecordId] = useState<string | number | null>(initialRecordId ?? null);
    const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);

    // Pagination & sorting state
    const [page, setPage] = useState(1);
    const [sortField, setSortField] = useState<string | undefined>(config.defaultSort);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(config.defaultSortDirection || 'asc');
    const [searchQuery, setSearchQuery] = useState('');

    // Delete confirmation state
    const [deleteConfirm, setDeleteConfirm] = useState<T | null>(null);

    // Server-side field validation errors (from create/update mutations)
    const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

    // Build query key
    const listQueryKey = [config.entity, 'list', { page, perPage, sortField, sortDirection, searchQuery }];
    const detailQueryKey = [config.entity, 'detail', selectedRecordId];

    // Fetch list
    const listQuery = useQuery<PaginationResult<T>>({
        queryKey: listQueryKey,
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('perPage', String(perPage));
            if (sortField) {
                params.set('orderBy', sortField);
                params.set('orderDirection', sortDirection);
            }
            if (searchQuery) {
                params.set('search', searchQuery);
            }

            const response = await fetchFn(`${apiPath}?${params}`);
            if (!response.ok) {
                throw new Error('Failed to fetch data');
            }

            const data = await response.json();

            // Handle both paginated and simple array responses
            if (Array.isArray(data)) {
                return {
                    data,
                    total: data.length,
                    page: 1,
                    perPage: data.length,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPrevPage: false,
                };
            }

            // Handle wrapped response { users: [...] } or { data: [...], pagination?: {...} } (OttaORM standard)
            const items = data[config.entity] || data.data || data;
            if (Array.isArray(items)) {
                const pagination = data.pagination;
                const total = data.total ?? pagination?.total ?? items.length;
                const page = data.page ?? pagination?.page ?? 1;
                const perPage = data.perPage ?? pagination?.perPage ?? items.length;
                const totalPages = data.totalPages ?? pagination?.totalPages ?? Math.max(1, Math.ceil(total / perPage));
                return {
                    data: items,
                    total,
                    page,
                    perPage,
                    totalPages,
                    hasNextPage: data.hasNextPage ?? page < totalPages,
                    hasPrevPage: data.hasPrevPage ?? page > 1,
                };
            }

            return data;
        },
        enabled: viewMode === 'list',
    });

    // Fetch single record
    const detailQuery = useQuery<T>({
        queryKey: detailQueryKey,
        queryFn: async () => {
            const response = await fetchFn(`${apiPath}/${selectedRecordId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch record');
            }

            const data = await response.json();
            // Handle wrapped response
            const singularEntity = singularize(config.entity);
            return data[singularEntity] || data.data || data;
        },
        enabled: (viewMode === 'detail' || viewMode === 'edit') && !!selectedRecordId,
    });

    // Helper: parse server field errors from API responses
    // Supports { errors: { field: "msg" } } and OttaORM { fieldErrors: { field: ["msg"] } }
    const parseServerErrors = (body: Record<string, unknown>) => {
        const fieldErrors = body.errors || body.fieldErrors;
        if (fieldErrors && typeof fieldErrors === 'object' && !Array.isArray(fieldErrors)) {
            const parsed: Record<string, string> = {};
            for (const [key, val] of Object.entries(fieldErrors as Record<string, unknown>)) {
                parsed[key] = Array.isArray(val) ? val[0] : String(val);
            }
            if (Object.keys(parsed).length > 0) {
                setServerFieldErrors(parsed);
                return parsed;
            }
        }
        return null;
    };

    // Create mutation
    const createMutation = useMutation<T, Error, Partial<T>>({
        mutationFn: async (data) => {
            setServerFieldErrors({});
            const response = await fetchFn(apiPath, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                parseServerErrors(body);
                throw new Error(body.error || body.message || 'Failed to create record');
            }
            const result = await response.json();
            const singularEntity = singularize(config.entity);
            return result[singularEntity] || result.data || result;
        },
        onSuccess: (record) => {
            setServerFieldErrors({});
            queryClient.invalidateQueries({ queryKey: [config.entity] });
            setViewMode('detail');
            setSelectedRecordId(record[primaryKey] as string | number);
            onCreate?.(record);
        },
    });

    // Update mutation
    const updateMutation = useMutation<T, Error, Partial<T>>({
        mutationFn: async (data) => {
            setServerFieldErrors({});
            const response = await fetchFn(`${apiPath}/${selectedRecordId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                parseServerErrors(body);
                throw new Error(body.error || body.message || 'Failed to update record');
            }
            const result = await response.json();
            const singularEntity = singularize(config.entity);
            return result[singularEntity] || result.data || result;
        },
        onSuccess: (record) => {
            setServerFieldErrors({});
            queryClient.invalidateQueries({ queryKey: [config.entity] });
            setViewMode('detail');
            onUpdate?.(record);
        },
    });

    // Delete mutation
    const deleteMutation = useMutation<void, Error, string | number>({
        mutationFn: async (id) => {
            const response = await fetchFn(`${apiPath}/${id}`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || error.message || 'Failed to delete record');
            }
        },
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: [config.entity] });
            setViewMode('list');
            setSelectedRecordId(null);
            onDelete?.(id);
        },
    });

    // Handlers
    const handleView = useCallback(
        (record: T) => {
            setSelectedRecordId(record[primaryKey] as string | number);
            setViewMode('detail');
        },
        [primaryKey],
    );

    const handleEdit = useCallback(
        (record: T) => {
            setSelectedRecordId(record[primaryKey] as string | number);
            setViewMode('edit');
        },
        [primaryKey],
    );

    const handleDelete = useCallback((record: T) => {
        setDeleteConfirm(record);
    }, []);

    const confirmDelete = useCallback(() => {
        if (deleteConfirm) {
            deleteMutation.mutate(deleteConfirm[primaryKey] as string | number);
            setDeleteConfirm(null);
        }
    }, [deleteConfirm, primaryKey, deleteMutation]);

    const handleCreate = useCallback(() => {
        setSelectedRecordId(null);
        setServerFieldErrors({});
        setViewMode('create');
    }, []);

    const handleBack = useCallback(() => {
        setServerFieldErrors({});
        setViewMode('list');
        setSelectedRecordId(null);
    }, []);

    const handleSortChange = useCallback((field: string, direction: 'asc' | 'desc') => {
        setSortField(field);
        setSortDirection(direction);
        setPage(1);
    }, []);

    const handleSearch = useCallback((query: string) => {
        setSearchQuery(query);
        setPage(1);
    }, []);

    return (
        <div className={clsx('space-y-4', className)}>
            {/* Custom Header */}
            {header}

            {/* List View */}
            {viewMode === 'list' && (
                <ModelTable
                    config={config}
                    data={listQuery.data?.data}
                    isLoading={listQuery.isLoading}
                    total={listQuery.data?.total}
                    page={page}
                    perPage={perPage}
                    onPageChange={setPage}
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onCreate={handleCreate}
                    onSortChange={handleSortChange}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSearch={handleSearch}
                    selectable={selectable}
                    selectedIds={selectedIds}
                    onSelectionChange={setSelectedIds}
                />
            )}

            {/* Detail View */}
            {viewMode === 'detail' && detailQuery.data && (
                <ModelDetail
                    config={config}
                    data={detailQuery.data}
                    isLoading={detailQuery.isLoading}
                    onEdit={() => setViewMode('edit')}
                    onDelete={() => setDeleteConfirm(detailQuery.data!)}
                    onBack={handleBack}
                />
            )}

            {/* Create Form */}
            {viewMode === 'create' && (
                <ModelForm
                    config={config}
                    mode="create"
                    onSubmit={(data) => createMutation.mutate(data)}
                    onCancel={handleBack}
                    isLoading={createMutation.isPending}
                    apiBasePath={apiBasePath}
                    serverErrors={serverFieldErrors}
                />
            )}

            {/* Edit Form */}
            {viewMode === 'edit' && detailQuery.data && (
                <ModelForm
                    config={config}
                    mode="edit"
                    initialData={detailQuery.data}
                    onSubmit={(data) => updateMutation.mutate(data)}
                    onCancel={() => setViewMode('detail')}
                    isLoading={updateMutation.isPending}
                    apiBasePath={apiBasePath}
                    serverErrors={serverFieldErrors}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <DeleteConfirmModal
                    entityName={config.displayName || singularize(config.entity)}
                    recordId={String(deleteConfirm[primaryKey])}
                    isLoading={deleteMutation.isPending}
                    onConfirm={confirmDelete}
                    onCancel={() => setDeleteConfirm(null)}
                />
            )}

            {/* Error Display */}
            {(listQuery.error ||
                detailQuery.error ||
                createMutation.error ||
                updateMutation.error ||
                deleteMutation.error) && (
                <ErrorBanner
                    error={
                        listQuery.error?.message ||
                        detailQuery.error?.message ||
                        createMutation.error?.message ||
                        updateMutation.error?.message ||
                        deleteMutation.error?.message ||
                        'An error occurred'
                    }
                />
            )}
        </div>
    );
}

// ============================================================
// Helper Components
// ============================================================

interface DeleteConfirmModalProps {
    entityName: string;
    recordId: string;
    isLoading: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

function DeleteConfirmModal({ entityName, recordId, isLoading, onConfirm, onCancel }: DeleteConfirmModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Delete {entityName}?</h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Are you sure you want to delete this {entityName.toLowerCase()} (ID: {recordId}
                    )? This action cannot be undone.
                </p>

                <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className={clsx(
                            'px-4 py-2 rounded-lg font-medium transition-colors',
                            'text-gray-700 dark:text-gray-300',
                            'bg-gray-100 dark:bg-gray-700',
                            'hover:bg-gray-200 dark:hover:bg-gray-600',
                            'disabled:opacity-50',
                        )}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={clsx(
                            'px-4 py-2 rounded-lg font-medium transition-colors',
                            'text-white bg-red-600 hover:bg-red-700',
                            'disabled:opacity-50',
                        )}
                    >
                        {isLoading ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}

interface ErrorBannerProps {
    error: string;
}

function ErrorBanner({ error }: ErrorBannerProps) {
    return (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
    );
}

// ============================================================
// Utility Functions
// ============================================================

function singularize(str: string): string {
    if (str.endsWith('ies')) return str.slice(0, -3) + 'y';
    if (str.endsWith('s')) return str.slice(0, -1);
    return str;
}

export default ModelCrud;
