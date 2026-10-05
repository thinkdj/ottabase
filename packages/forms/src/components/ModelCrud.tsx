// ============================================================
// @ottabase/forms - ModelCrud Component
// ============================================================
// The list stays on screen; clicking a row (or "Add") opens the record in a
// side panel. The selection can be owned by the page (selectedId +
// onSelectedIdChange) so it lives in the URL, or kept internally.
// ============================================================

import { getStableQuerySignal } from '@ottabase/ottaorm/client';
import { ConfirmDialog } from '@ottabase/ui-components';
import { Alert, Sheet, SheetContent, SheetHeader, SheetTitle } from '@ottabase/ui-shadcn';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { getServerErrorData, useFormRequest } from '../hooks/useFormRequest';
import type { ModelCrudProps, ModelCrudSelection } from '../types';
import { ModelForm } from './ModelForm';
import { ModelTable } from './ModelTable';
import { entityNames, singularize } from '../utils/names';

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
 * ModelCrud - list, create, edit and delete for one model
 *
 * - Searchable, sortable, paginated list (DataTable)
 * - Row click opens the record in a side panel; "Add" opens an empty one
 * - Delete from the panel, with confirmation
 * - TanStack Query caching; server field errors shown inline
 */
export function ModelCrud<T extends Record<string, unknown>>({
    config,
    selectedId: selectedIdProp,
    onSelectedIdChange,
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
    const displayName = entityNames(config).singular.toLowerCase();
    const request = useFormRequest();

    // Selection: a record id, 'new', or null (panel closed). Controlled when the page passes it.
    const [internalId, setInternalId] = useState<ModelCrudSelection>(null);
    const selectedId = selectedIdProp !== undefined ? selectedIdProp : internalId;
    const mode = selectedId === 'new' ? 'create' : selectedId !== null ? 'edit' : null;
    const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});
    const select = useCallback(
        (id: ModelCrudSelection) => {
            setServerFieldErrors({});
            setInternalId(id);
            onSelectedIdChange?.(id);
        },
        [onSelectedIdChange],
    );

    const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
    const [page, setPage] = useState(1);
    const [sortField, setSortField] = useState<string | undefined>(config.defaultSort);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(config.defaultSortDirection || 'asc');
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteOpen, setDeleteOpen] = useState(false);

    const listQueryKey = [config.entity, 'list', { page, perPage, sortField, sortDirection, searchQuery }];
    const recordPath = useCallback((id: string | number) => `${apiPath}/${encodeURIComponent(String(id))}`, [apiPath]);
    const unwrap = (result: Record<string, unknown> | T): T => {
        const singular = singularize(config.entity);
        return ((result as Record<string, T>)[singular] || (result as { data?: T }).data || result) as T;
    };

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
            if (searchQuery) params.set('search', searchQuery);

            const data = await request<Record<string, unknown> | T[]>(`${apiPath}?${params}`, { signal });
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
            // { data: [...], total, page, ... } (OttaORM) or { <entity>: [...] }
            const responseData = data as Record<string, unknown>;
            const items = responseData[config.entity] || responseData.data || data;
            if (Array.isArray(items)) {
                const pagination = responseData.pagination as Partial<PaginationResult<T>> | undefined;
                const total = (responseData.total as number | undefined) ?? pagination?.total ?? items.length;
                const currentPage = (responseData.page as number | undefined) ?? pagination?.page ?? 1;
                const size = (responseData.perPage as number | undefined) ?? pagination?.perPage ?? items.length;
                const totalPages =
                    (responseData.totalPages as number | undefined) ??
                    pagination?.totalPages ??
                    Math.max(1, Math.ceil(total / size));
                return {
                    data: items,
                    total,
                    page: currentPage,
                    perPage: size,
                    totalPages,
                    hasNextPage: (responseData.hasNextPage as boolean | undefined) ?? currentPage < totalPages,
                    hasPrevPage: (responseData.hasPrevPage as boolean | undefined) ?? currentPage > 1,
                };
            }
            return data as unknown as PaginationResult<T>;
        },
    });

    const detailQuery = useQuery<T>({
        queryKey: [config.entity, 'detail', selectedId],
        queryFn: async (context) => {
            const signal = await getStableQuerySignal(context);
            return unwrap(
                await request<Record<string, unknown> | T>(recordPath(selectedId as string | number), { signal }),
            );
        },
        enabled: mode === 'edit',
    });

    // { errors: { field: "msg" } } and OttaORM { fieldErrors: { field: ["msg"] } }
    const parseServerErrors = (body: Record<string, unknown>) => {
        const fieldErrors = body.errors || body.fieldErrors;
        if (fieldErrors && typeof fieldErrors === 'object' && !Array.isArray(fieldErrors)) {
            const parsed: Record<string, string> = {};
            for (const [key, val] of Object.entries(fieldErrors as Record<string, unknown>)) {
                parsed[key] = Array.isArray(val) ? val[0] : String(val);
            }
            if (Object.keys(parsed).length > 0) setServerFieldErrors(parsed);
        }
    };

    const prepare = (data: Partial<T>, m: 'create' | 'edit') => (config.prepare ? config.prepare(data, m) : data);
    const invalidate = () => queryClient.invalidateQueries({ queryKey: [config.entity] });

    const createMutation = useMutation<T, Error, Partial<T>>({
        meta: { errorPresentation: 'local' },
        mutationFn: async (data) => {
            setServerFieldErrors({});
            try {
                return unwrap(await request(apiPath, { method: 'POST', body: prepare(data, 'create') }));
            } catch (error) {
                parseServerErrors(getServerErrorData(error));
                throw error;
            }
        },
        onSuccess: (record) => {
            void invalidate();
            select(null);
            onCreate?.(record);
        },
    });

    const updateMutation = useMutation<T, Error, Partial<T>>({
        meta: { errorPresentation: 'local' },
        mutationFn: async (data) => {
            setServerFieldErrors({});
            try {
                return unwrap(
                    await request(recordPath(selectedId as string | number), {
                        method: 'PATCH',
                        body: prepare(data, 'edit'),
                    }),
                );
            } catch (error) {
                parseServerErrors(getServerErrorData(error));
                throw error;
            }
        },
        onSuccess: (record) => {
            void invalidate();
            select(null);
            onUpdate?.(record);
        },
    });

    const deleteMutation = useMutation<void, Error, string | number>({
        meta: { errorPresentation: 'local' },
        mutationFn: async (id) => {
            await request<void>(recordPath(id), { method: 'DELETE' });
        },
        onSuccess: (_, id) => {
            void invalidate();
            setDeleteOpen(false);
            select(null);
            onDelete?.(id);
        },
    });

    const handleServerErrorClear = useCallback((field: string) => {
        setServerFieldErrors((current) => {
            if (!(field in current)) return current;
            const { [field]: _removed, ...remaining } = current;
            return remaining;
        });
    }, []);

    const visibleError = listQuery.error ?? detailQuery.error ?? deleteMutation.error;
    const formProps = {
        config,
        hideHeader: true,
        apiBasePath,
        serverErrors: serverFieldErrors,
        onServerErrorClear: handleServerErrorClear,
        onCancel: () => select(null),
    };

    return (
        <div className={clsx('space-y-4', className)}>
            {header}

            <ModelTable
                config={config}
                data={listQuery.data?.data}
                isLoading={listQuery.isLoading}
                total={listQuery.data?.total}
                page={page}
                perPage={perPage}
                onPageChange={setPage}
                onRowClick={(record) => select(record[primaryKey] as string | number)}
                onCreate={() => select('new')}
                onSortChange={(field, direction) => {
                    setSortField(field);
                    setSortDirection(direction);
                    setPage(1);
                }}
                sortField={sortField}
                sortDirection={sortDirection}
                onSearch={(query) => {
                    setSearchQuery(query);
                    setPage(1);
                }}
                selectable={selectable}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
            />

            {visibleError && <ErrorBanner error={visibleError} />}

            <Sheet open={mode !== null} onOpenChange={(open) => !open && select(null)}>
                <SheetContent
                    side="right"
                    className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
                    aria-describedby={undefined}
                >
                    <SheetHeader className="border-b border-border px-6 py-4 text-left">
                        <SheetTitle>{mode === 'create' ? `New ${displayName}` : `Edit ${displayName}`}</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 space-y-6 px-6 py-5">
                        {mode === 'create' && (
                            <ModelForm
                                {...formProps}
                                mode="create"
                                onSubmit={async (data) => {
                                    await createMutation.mutateAsync(data);
                                }}
                                isLoading={createMutation.isPending}
                            />
                        )}
                        {mode === 'edit' &&
                            (detailQuery.data ? (
                                <>
                                    <ModelForm
                                        key={String(selectedId)}
                                        {...formProps}
                                        mode="edit"
                                        initialData={detailQuery.data}
                                        onSubmit={async (data) => {
                                            await updateMutation.mutateAsync(data);
                                        }}
                                        isLoading={updateMutation.isPending}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setDeleteOpen(true)}
                                        className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete {displayName}
                                    </button>
                                </>
                            ) : (
                                <p className="text-sm text-muted-foreground" aria-busy="true">
                                    Loading…
                                </p>
                            ))}
                    </div>
                </SheetContent>
            </Sheet>

            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title={`Delete this ${displayName}?`}
                description="This cannot be undone."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={() => deleteMutation.mutateAsync(selectedId as string | number)}
            />
        </div>
    );
}

function ErrorBanner({ error }: { error: Error }) {
    const status = (error as Error & { status?: unknown }).status;
    if (status === 403) {
        return (
            <Alert variant="destructive">
                <p className="font-medium">Access denied</p>
                <p className="mt-1 text-destructive/80">
                    You do not have permission to access this resource. The server blocked the request.
                </p>
            </Alert>
        );
    }
    return <Alert variant="destructive">{error.message || 'An error occurred'}</Alert>;
}

export default ModelCrud;
