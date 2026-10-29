// ============================================================
// @ottabase/forms - CrudHub list view
// ============================================================
// Server-paged table over /api/admin/crudhub/{model}: search on the
// model's search field, column menu, row actions (model actions,
// View, Edit, Copy ID, Delete), stale rows under an overlay while
// fetching, 5..100 rows per page, remembered preferences per model.
// ============================================================

import type { CrudHubModelDescriptor } from '@ottabase/ottaorm';
import { getStableQuerySignal } from '@ottabase/ottaorm/client';
import { ConfirmDialog, toast } from '@ottabase/ui';
import type {
    DataTableAction,
    DataTableBulkAction,
    DataTableColumnDef,
    DataTablePaginationState,
} from '@ottabase/ui-datatable';
import { useDataTable } from '@ottabase/ui-datatable';
import { actionsColumn, createColumns, DataTable, selectColumn } from '@ottabase/ui-datatable/react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { Copy, Edit2, Eye, Play, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormRequest } from '../../hooks/useFormRequest';
import {
    CRUDHUB_API,
    CRUDHUB_PATH,
    crudHubPaths,
    fillRouteTokens,
    readRemembered,
    rowTitle,
    writeRemembered,
    type CrudHubNavigate,
    type RememberedListState,
} from './useCrudHub';
import { CrudHubCell } from './CrudHubCell';

export const CRUDHUB_PAGE_SIZES = [5, 10, 20, 50, 100];
type Row = Record<string, unknown> & { __actions?: string[] };

export interface CrudHubListState {
    page: number;
    search: string;
    perPage?: number;
    sort?: { column: string; direction: 'asc' | 'desc' } | null;
}

export interface CrudHubListProps {
    model: CrudHubModelDescriptor;
    /** URL-backed state: page and search always, sort/perPage when the URL carries them. */
    state: CrudHubListState;
    onStateChange: (patch: Partial<CrudHubListState>) => void;
    onNavigate: CrudHubNavigate;
    /** Server-side write permission, as the directory reported it. */
    canWrite?: boolean;
    basePath?: string;
    apiBasePath?: string;
    className?: string;
}

/**
 * Effective page size and sort: the URL wins over remembered preferences, which win over the
 * model's defaults. `sort: null` is an explicit "no sort" and is honoured at every level.
 */
export function resolveListPrefs(
    state: Pick<CrudHubListState, 'perPage' | 'sort'>,
    remembered: RememberedListState,
    model: Pick<CrudHubModelDescriptor, 'defaultSort' | 'defaultSortDirection'>,
): { perPage: number; sort: { column: string; direction: 'asc' | 'desc' } | null } {
    const perPage = state.perPage ?? remembered.perPage ?? 10;
    const sort =
        state.sort !== undefined
            ? state.sort
            : remembered.sort !== undefined
              ? remembered.sort
              : model.defaultSort
                ? { column: model.defaultSort, direction: model.defaultSortDirection ?? 'asc' }
                : null;
    return { perPage, sort };
}

/**
 * What the caller may do from the hub. `readOnly` blocks generic create/edit/delete only; declared
 * actions and a custom `routes.edit` page stay available to anyone who may write.
 */
export function crudHubAbilities(model: Pick<CrudHubModelDescriptor, 'readOnly' | 'routes'>, canWrite: boolean) {
    const generic = canWrite && !model.readOnly;
    return {
        create: generic,
        remove: generic,
        edit: model.routes?.edit ? canWrite : generic,
        actions: canWrite,
    };
}

interface ListResponse {
    data: Row[];
    pagination: { page: number; perPage: number; total: number; totalPages: number };
}

function useRowFlash() {
    const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
    const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
    const flash = useCallback((id: string) => {
        setIds((prev) => new Set(prev).add(id));
        clearTimeout(timers.current.get(id));
        timers.current.set(
            id,
            setTimeout(() => {
                setIds((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }, 2000),
        );
    }, []);
    useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
    return { flashIds: ids, flash };
}

export function CrudHubList({
    model,
    state,
    onStateChange,
    onNavigate,
    canWrite = true,
    basePath = CRUDHUB_PATH,
    apiBasePath = CRUDHUB_API,
    className,
}: CrudHubListProps) {
    const request = useFormRequest();
    const queryClient = useQueryClient();
    const paths = crudHubPaths(model.entity, basePath);
    const apiPath = `${apiBasePath}/${encodeURIComponent(model.entity)}`;
    const pk = model.primaryKey;
    const can = crudHubAbilities(model, canWrite);

    // URL wins over storage, storage over model defaults.
    const remembered = useMemo(() => readRemembered(model.entity), [model.entity]);
    const { perPage, sort } = resolveListPrefs(state, remembered, model);

    const [searchInput, setSearchInput] = useState(state.search);
    useEffect(() => setSearchInput(state.search), [state.search]);
    // Debounced server search (400ms)
    useEffect(() => {
        if (searchInput === state.search) return;
        const t = setTimeout(() => onStateChange({ search: searchInput, page: 1 }), 400);
        return () => clearTimeout(t);
    }, [searchInput, state.search, onStateChange]);

    const { flashIds, flash } = useRowFlash();
    const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
    const [actionTarget, setActionTarget] = useState<{ key: string; rows: Row[] } | null>(null);

    // ── Data ────────────────────────────────────────────────
    const queryKey = ['crudhub', model.entity, 'list', { page: state.page, perPage, sort, search: state.search }];
    const list = useQuery<ListResponse>({
        queryKey,
        queryFn: async (context) => {
            const params = new URLSearchParams({ page: String(state.page), perPage: String(perPage) });
            if (sort) {
                params.set('orderBy', sort.column);
                params.set('orderDirection', sort.direction);
            }
            if (state.search) params.set('search', state.search);
            return request<ListResponse>(`${apiPath}?${params}`, { signal: await getStableQuerySignal(context) });
        },
        placeholderData: keepPreviousData,
    });
    const rows = list.data?.data ?? [];
    const total = list.data?.pagination.total ?? 0;
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['crudhub', model.entity] });

    // ── Mutations ───────────────────────────────────────────
    const remove = useMutation({
        meta: { errorPresentation: 'local' },
        mutationFn: (id: string) => request(`${apiPath}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        onSuccess: () => {
            toast.success(`${model.displayName} deleted`);
            invalidate();
        },
        onError: (error: Error) => toast.error(error.message || 'Delete failed'),
    });

    const runAction = useMutation({
        meta: { errorPresentation: 'local' },
        mutationFn: async ({ key, rows: targets }: { key: string; rows: Row[] }) => {
            const results = await Promise.allSettled(
                targets.map((row) =>
                    request(`${apiPath}/${encodeURIComponent(String(row[pk]))}/actions/${key}`, { method: 'POST' }),
                ),
            );
            return {
                done: results.filter((r) => r.status === 'fulfilled').length,
                failed: results.length - results.filter((r) => r.status === 'fulfilled').length,
                targets,
            };
        },
        onSuccess: ({ done, failed, targets }, { key }) => {
            const title = model.actions.find((a) => a.key === key)?.title ?? key;
            if (targets.length === 1) {
                if (failed) toast.error(`${title} failed`);
                else toast.success(title);
            } else {
                toast[failed ? 'warning' : 'success'](`${title}: ${done} done${failed ? `, ${failed} failed` : ''}`);
            }
            targets.forEach((row) => flash(String(row[pk])));
            invalidate();
        },
    });

    const copyId = useCallback(
        async (row: Row) => {
            const id = String(row[pk]);
            try {
                await navigator.clipboard.writeText(`${model.entity}:${id}`);
                toast.success(`Copied ${model.entity}:${id}`);
                flash(id);
            } catch {
                toast.error('Clipboard is not available');
            }
        },
        [model.entity, pk, flash],
    );

    const viewPath = (row: Row) =>
        (model.routes?.view && fillRouteTokens(model.routes.view, row)) || paths.view(String(row[pk]));
    const editPath = (row: Row) =>
        (model.routes?.edit && fillRouteTokens(model.routes.edit, row)) || paths.edit(String(row[pk]));

    const startAction = (key: string, targets: Row[]) => {
        const action = model.actions.find((a) => a.key === key);
        if (!action) return;
        if (action.confirm || action.destructive) setActionTarget({ key, rows: targets });
        else runAction.mutate({ key, rows: targets });
    };

    // ── Columns ─────────────────────────────────────────────
    const columns = useMemo(() => {
        const keys =
            model.listFields ??
            Object.entries(model.fields)
                .filter(([, f]) => f.tableConfig?.visible !== false)
                .sort(([, a], [, b]) => (a.tableConfig?.order ?? 999) - (b.tableConfig?.order ?? 999))
                .map(([k]) => k);
        const defs: DataTableColumnDef<Row>[] = keys.map((key) => {
            const field = model.fields[key];
            return {
                key,
                header: field?.uiConfig?.label ?? key.charAt(0).toUpperCase() + key.slice(1),
                sortable: field?.sortable ?? false,
                width: field?.tableConfig?.colWidth,
                visible: remembered.columns?.[key],
                cell: ({ row, value }) => (
                    <CrudHubCell
                        entity={model.entity}
                        fieldKey={key}
                        field={field}
                        value={value}
                        row={row}
                        titleHref={key === model.titleField ? paths.view(String(row[pk])) : undefined}
                        editHref={key === model.titleField && can.edit ? editPath(row) : undefined}
                        onNavigate={onNavigate}
                        onCopy={() => copyId(row)}
                    />
                ),
            };
        });

        const rowActions: DataTableAction<Row>[] = [
            ...model.actions.map((action) => ({
                label: action.title,
                icon: Play,
                variant: action.destructive ? ('destructive' as const) : ('default' as const),
                hidden: (row: Row) =>
                    !can.actions || (Array.isArray(row.__actions) && !row.__actions.includes(action.key)),
                onClick: (row: Row) => startAction(action.key, [row]),
            })),
            {
                label: 'View',
                icon: Eye,
                separator: model.actions.length > 0,
                onClick: (row) => onNavigate(viewPath(row)),
            },
            { label: 'Edit', icon: Edit2, hidden: () => !can.edit, onClick: (row) => onNavigate(editPath(row)) },
            { label: 'Copy ID', icon: Copy, separator: true, onClick: (row) => void copyId(row) },
            {
                label: 'Delete',
                icon: Trash2,
                variant: 'destructive',
                separator: true,
                hidden: () => !can.remove,
                onClick: (row) => setDeleteTarget(row),
            },
        ];

        const cols = [
            ...(can.actions && model.actions.some((a) => a.bulk) ? [selectColumn<Row>()] : []),
            ...createColumns<Row>(defs),
            actionsColumn<Row>(rowActions, { header: '' }),
        ];
        return cols;
        // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers are stable per model
    }, [model, can.actions, can.edit, can.remove, remembered.columns, onNavigate, copyId, pk]);

    const pagination = useMemo<DataTablePaginationState>(
        () => ({ page: state.page, perPage, total }),
        [state.page, perPage, total],
    );

    const { table, getSelectedRows, clearSelection } = useDataTable<Row>({
        data: rows,
        columns,
        getRowId: (row) => String(row[pk] ?? ''),
        enableRowSelection: can.actions && model.actions.some((a) => a.bulk),
        manualSorting: true,
        manualPagination: true,
        manualFiltering: true,
        sorting: sort,
        onSortingChange: (next) => {
            writeRemembered(model.entity, { sort: next });
            onStateChange({ sort: next, page: 1 });
        },
        pagination,
        onPaginationChange: (next) => {
            if (next.perPage !== perPage) writeRemembered(model.entity, { perPage: next.perPage });
            onStateChange({ page: next.page, perPage: next.perPage });
        },
        rowCount: total,
    });

    // Persist column visibility whenever it changes.
    const visibility = table.getState().columnVisibility;
    useEffect(() => {
        if (Object.keys(visibility).length > 0) writeRemembered(model.entity, { columns: visibility });
    }, [visibility, model.entity]);

    const bulkActions: DataTableBulkAction<Row>[] = model.actions
        .filter((a) => a.bulk)
        .map((a) => ({
            label: a.title,
            icon: Play,
            variant: a.destructive ? 'destructive' : 'outline',
            onClick: (selected) => {
                startAction(a.key, selected);
                clearSelection();
            },
        }));

    const searchable = Boolean(model.searchField);
    const emptyMessage = state.search
        ? `No results for “${state.search}”`
        : `No ${model.displayNamePlural.toLowerCase()} yet`;

    return (
        <div className={clsx('space-y-3', className)}>
            <DataTable
                table={table}
                isLoading={list.isPending}
                isFetching={list.isFetching && !list.isPending}
                flashRowIds={flashIds}
                emptyMessage={emptyMessage}
                onRowClick={(row) => onNavigate(viewPath(row))}
                toolbarLeft={
                    <div className="flex items-center gap-2">
                        <input
                            type="search"
                            value={searchInput}
                            disabled={!searchable}
                            title={searchable ? undefined : 'This model has no searchable field'}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder={
                                searchable ? `Search ${model.displayNamePlural.toLowerCase()}…` : 'No searchable field'
                            }
                            aria-label="Search"
                            className="h-9 w-64 rounded-md bg-background px-3 text-sm ring-1 ring-border placeholder:text-muted-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        {state.search && (
                            <button
                                type="button"
                                onClick={() => onStateChange({ search: '', page: 1 })}
                                className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                            >
                                <X className="h-3.5 w-3.5" /> Reset
                            </button>
                        )}
                    </div>
                }
                toolbarRight={
                    can.create ? (
                        <button
                            type="button"
                            onClick={() => onNavigate(paths.create)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <Plus className="h-4 w-4" /> New
                        </button>
                    ) : undefined
                }
                bulkActions={bulkActions.length ? bulkActions : undefined}
                pagination={pagination}
                onPaginationChange={(next) => {
                    if (next.perPage !== perPage) writeRemembered(model.entity, { perPage: next.perPage });
                    onStateChange({ page: next.page, perPage: next.perPage });
                }}
                pageSizeOptions={CRUDHUB_PAGE_SIZES}
                showPagination
            />

            {list.isError && (
                <div
                    role="alert"
                    className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                    {(list.error as Error).message || 'Could not load rows'}
                </div>
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                tone="destructive"
                title={`Delete ${model.displayName.toLowerCase()}?`}
                description={
                    deleteTarget
                        ? `“${rowTitle(model, deleteTarget)}” will be deleted. This action cannot be undone.`
                        : undefined
                }
                confirmLabel="Delete"
                onConfirm={() => {
                    if (deleteTarget) remove.mutate(String(deleteTarget[pk]));
                    setDeleteTarget(null);
                }}
            />

            <ConfirmDialog
                open={actionTarget !== null}
                onOpenChange={(open) => !open && setActionTarget(null)}
                tone={model.actions.find((a) => a.key === actionTarget?.key)?.destructive ? 'destructive' : 'default'}
                title={model.actions.find((a) => a.key === actionTarget?.key)?.title}
                description={
                    model.actions.find((a) => a.key === actionTarget?.key)?.confirm ??
                    `Run this on ${actionTarget?.rows.length ?? 0} row(s)?`
                }
                confirmLabel="Run"
                onConfirm={() => {
                    if (actionTarget) runAction.mutate(actionTarget);
                    setActionTarget(null);
                }}
            />
            {getSelectedRows().length > 0 && <span className="sr-only">{getSelectedRows().length} selected</span>}
        </div>
    );
}
