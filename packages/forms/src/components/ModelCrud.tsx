// ============================================================
// @ottabase/forms - ModelCrud Component
// ============================================================
// Complete CRUD interface combining list, detail, create, edit views
// ============================================================

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getStableQuerySignal } from '@ottabase/ottaorm/client';
import { clsx } from 'clsx';
import { useCallback, useState } from 'react';
import { getServerErrorData, useFormRequest } from '../hooks/useFormRequest';
import type { CrudViewMode, ModelCrudProps } from '../types';
import { ModelDetail } from './ModelDetail';
import { ModelForm } from './ModelForm';
import { ModelTable } from './ModelTable';

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
}: ModelCrudProps<T>) {
    const queryClient = useQueryClient();
    const primaryKey = config.primaryKey || 'id';
    const apiPath = config.apiPath || `${apiBasePath}/${config.entity}`;
    const request = useFormRequest();

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
    const recordPath = useCallback((id: string | number) => `${apiPath}/${encodeURIComponent(String(id))}`, [apiPath]);

    // Fetch list
    const listQuery = useQuery<PaginationResult<T>>({
        queryKey: listQueryKey,
        queryFn: async (context) => {
            const signal = await getStableQuerySignal(context);
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

            const data = await request<Record<string, unknown> | T[]>(`${apiPath}?${params}`, { signal });

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
            const responseData = data as Record<string, unknown>;
            const items = responseData[config.entity] || responseData.data || data;
            if (Array.isArray(items)) {
                const pagination = responseData.pagination as Partial<PaginationResult<T>> | undefined;
                const total = (responseData.total as number | undefined) ?? pagination?.total ?? items.length;
                const page = (responseData.page as number | undefined) ?? pagination?.page ?? 1;
                const perPage = (responseData.perPage as number | undefined) ?? pagination?.perPage ?? items.length;
                const totalPages =
                    (responseData.totalPages as number | undefined) ??
                    pagination?.totalPages ??
                    Math.max(1, Math.ceil(total / perPage));
                return {
                    data: items,
                    total,
                    page,
                    perPage,
                    totalPages,
                    hasNextPage: (responseData.hasNextPage as boolean | undefined) ?? page < totalPages,
                    hasPrevPage: (responseData.hasPrevPage as boolean | undefined) ?? page > 1,
                };
            }

            return data as unknown as PaginationResult<T>;
        },
        enabled: viewMode === 'list',
    });

    // Fetch single record
    const detailQuery = useQuery<T>({
        queryKey: detailQueryKey,
        queryFn: async (context) => {
            const signal = await getStableQuerySignal(context);
            if (selectedRecordId === null) {
                throw new Error('Cannot fetch a record without an ID');
            }

            const data = await request<Record<string, unknown> | T>(recordPath(selectedRecordId), { signal });
            // Handle wrapped response
            const singularEntity = singularize(config.entity);
            const responseData = data as Record<string, unknown>;
            return (responseData[singularEntity] || responseData.data || data) as T;
        },
        enabled: (viewMode === 'detail' || viewMode === 'edit') && selectedRecordId !== null,
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
        meta: { errorPresentation: 'local' },
        mutationFn: async (data) => {
            setServerFieldErrors({});
            try {
                const result = await request<Record<string, unknown> | T>(apiPath, {
                    method: 'POST',
                    body: data,
                });
                const singularEntity = singularize(config.entity);
                return (result as Record<string, T>)[singularEntity] || (result as { data?: T }).data || (result as T);
            } catch (error) {
                parseServerErrors(getServerErrorData(error));
                throw error;
            }
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
        meta: { errorPresentation: 'local' },
        mutationFn: async (data) => {
            setServerFieldErrors({});
            try {
                if (selectedRecordId === null) {
                    throw new Error('Cannot update a record without an ID');
                }

                const result = await request<Record<string, unknown> | T>(recordPath(selectedRecordId), {
                    method: 'PATCH',
                    body: data,
                });
                const singularEntity = singularize(config.entity);
                return (result as Record<string, T>)[singularEntity] || (result as { data?: T }).data || (result as T);
            } catch (error) {
                parseServerErrors(getServerErrorData(error));
                throw error;
            }
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
        meta: { errorPresentation: 'local' },
        mutationFn: async (id) => {
            await request<void>(recordPath(id), {
                method: 'DELETE',
            });
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

    const handleServerErrorClear = useCallback((field: string) => {
        setServerFieldErrors((current) => {
            if (!(field in current)) return current;
            const { [field]: _removed, ...remaining } = current;
            return remaining;
        });
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

    const visibleError = listQuery.error ?? detailQuery.error ?? deleteMutation.error;

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
                    onSubmit={async (data) => {
                        await createMutation.mutateAsync(data);
                    }}
                    onCancel={handleBack}
                    isLoading={createMutation.isPending}
                    apiBasePath={apiBasePath}
                    serverErrors={serverFieldErrors}
                    onServerErrorClear={handleServerErrorClear}
                />
            )}

            {/* Edit Form */}
            {viewMode === 'edit' && detailQuery.data && (
                <ModelForm
                    config={config}
                    mode="edit"
                    initialData={detailQuery.data}
                    onSubmit={async (data) => {
                        await updateMutation.mutateAsync(data);
                    }}
                    onCancel={() => setViewMode('detail')}
                    isLoading={updateMutation.isPending}
                    apiBasePath={apiBasePath}
                    serverErrors={serverFieldErrors}
                    onServerErrorClear={handleServerErrorClear}
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
            {visibleError && <ErrorBanner error={visibleError} />}
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
            <div className="absolute inset-0 bg-black/80 duration-normal ease-theme" onClick={onCancel} />

            {/* Modal */}
            <div className="relative mx-4 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg duration-normal ease-theme">
                <h3 className="text-[0.9375rem] font-semibold text-foreground">Delete {entityName}?</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Are you sure you want to delete this {entityName.toLowerCase()} (ID: {recordId}
                    )? This action cannot be undone.
                </p>

                <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className={clsx(
                            'h-9 rounded-lg px-4 text-sm font-medium transition-colors duration-normal',
                            'bg-background text-foreground ring-1 ring-border',
                            'hover:bg-muted/70',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            'disabled:opacity-50',
                        )}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={clsx(
                            'h-9 rounded-lg px-4 text-sm font-medium transition-colors duration-normal',
                            'bg-destructive text-destructive-foreground',
                            'hover:bg-destructive/90',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            'disabled:opacity-50',
                        )}
                    >
                        {isLoading ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
}

interface ErrorBannerProps {
    error: Error;
}

function ErrorBanner({ error }: ErrorBannerProps) {
    const status = (error as Error & { status?: unknown }).status;

    if (status === 403) {
        return (
            <div
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            >
                <p className="font-medium">Access denied</p>
                <p className="mt-1 text-destructive/80">
                    You do not have permission to access this resource. The server blocked the request.
                </p>
            </div>
        );
    }

    return (
        <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
            {error.message || 'An error occurred'}
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
