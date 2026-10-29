/**
 * CrudHub: generic admin data screens at /admin/crudhub.
 *
 * Four route-driven pages (directory, list, details, create/edit) over the components in
 * `@ottabase/forms/react`. The server (`/api/admin/crudhub`) decides which models the caller may
 * open; these pages only render what it returns. Page and search live in the URL so a view can be
 * shared and Back works; page size, sort and columns are remembered per model in localStorage.
 */
import { isPlatformAdmin, useSession } from '@/lib/auth';
import type { CrudHubModelDescriptor } from '@ottabase/ottaorm';
import {
    CrudHubDetail,
    CrudHubDirectory,
    CrudHubForm,
    CrudHubList,
    crudHubPaths,
    fillRouteTokens,
    useCrudHubModels,
    type CrudHubListState,
    type CrudHubNavigate,
} from '@ottabase/forms/react';
import { ConfirmDialog, PageHeader } from '@ottabase/ui';
import { Link, useBlocker, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { ChevronRight, Table2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

const HUB = '/admin/crudhub';

function useHubNavigate(): CrudHubNavigate {
    const navigate = useNavigate();
    return useCallback(
        (path: string, options?: { replace?: boolean }) => {
            const url = new URL(path, window.location.origin);
            const search = Object.fromEntries(url.searchParams.entries());
            void navigate({ to: url.pathname, search, replace: options?.replace } as never);
        },
        [navigate],
    );
}

/** The current model's descriptor from the directory listing (one request serves every page). */
function useHubModel(entity: string | undefined) {
    const models = useCrudHubModels();
    const model = useMemo(() => models.data?.models.find((m) => m.entity === entity), [models.data, entity]);
    return {
        model,
        models: models.data?.models,
        isPending: models.isPending,
        isError: models.isError,
        loaded: Boolean(models.data),
    };
}

function Crumbs({ model, trail }: { model?: CrudHubModelDescriptor; trail?: Array<{ label: string; to?: string }> }) {
    const items: Array<{ label: string; to?: string }> = [
        { label: 'Admin', to: '/admin' },
        { label: 'CrudHub', to: HUB },
        ...(model ? [{ label: model.displayNamePlural, to: crudHubPaths(model.entity).list }] : []),
        ...(trail ?? []),
    ];
    return (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {items.map((item, i) => (
                <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
                    {item.to && i < items.length - 1 ? (
                        <Link to={item.to} className="hover:text-foreground">
                            {item.label}
                        </Link>
                    ) : (
                        <span className="text-foreground">{item.label}</span>
                    )}
                </span>
            ))}
        </nav>
    );
}

function ModelMissing({ loaded }: { loaded: boolean }) {
    return (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">
            {loaded ? (
                <>
                    This model is not available in CrudHub for your account.{' '}
                    <Link to={HUB} className="text-primary hover:underline">
                        Back to the directory
                    </Link>
                    .
                </>
            ) : (
                'Loading…'
            )}
        </div>
    );
}

/**
 * May the caller write to this model at all? `readOnly` is applied by the components (it blocks
 * generic create/edit/delete but not declared actions or a custom edit page). The server is the
 * boundary; this only decides what to render.
 */
function useCanWrite(model: CrudHubModelDescriptor | undefined): boolean {
    const { user } = useSession();
    if (!model) return false;
    // Org-scoped models are writable by any admin the server let in; system ones by platform admins.
    return model.scope === 'org' ? true : isPlatformAdmin(user);
}

// ─── /admin/crudhub ──────────────────────────────────────────────────────────

export function CrudHubDirectoryPage() {
    const models = useCrudHubModels();
    const onNavigate = useHubNavigate();
    return (
        <div className="flex flex-col gap-6 pb-20">
            <Crumbs />
            <PageHeader
                title="CrudHub"
                description="Browse, search and edit any model that opted in. Grant and auth tables stay on their own pages."
                actions={
                    <Link
                        to="/admin/infrastructure/database"
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground ring-1 ring-border hover:bg-muted/70 hover:text-foreground"
                    >
                        <Table2 className="h-4 w-4" /> Raw tables
                    </Link>
                }
            />
            {models.isPending ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-36 animate-pulse rounded-xl bg-muted/40" />
                    ))}
                </div>
            ) : models.isError ? (
                <div
                    role="alert"
                    className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                >
                    {models.error.message || 'Could not load the model list'}
                </div>
            ) : (
                <CrudHubDirectory models={models.data.models} onNavigate={onNavigate} />
            )}
        </div>
    );
}

// ─── /admin/crudhub/$model ───────────────────────────────────────────────────

export interface CrudHubListSearch {
    page: number;
    q: string;
    sort?: string;
    dir?: 'asc' | 'desc';
    perPage?: number;
}

export function parseCrudHubListSearch(search: Record<string, unknown>): CrudHubListSearch {
    const perPage = Number(search.perPage);
    const dir = search.dir === 'desc' ? 'desc' : search.dir === 'asc' ? 'asc' : undefined;
    return {
        page: Math.max(1, Number(search.page) || 1),
        q: typeof search.q === 'string' ? search.q : '',
        sort: typeof search.sort === 'string' && search.sort ? search.sort : undefined,
        dir: typeof search.sort === 'string' && search.sort ? dir : undefined,
        perPage: Number.isInteger(perPage) && perPage > 0 ? Math.min(perPage, 100) : undefined,
    };
}

export function CrudHubListPage() {
    const { model: entity } = useParams({ strict: false }) as { model: string };
    const search = useSearch({ strict: false }) as CrudHubListSearch;
    const navigate = useNavigate();
    const onNavigate = useHubNavigate();
    const { model, loaded } = useHubModel(entity);
    const canWrite = useCanWrite(model);

    const state = useMemo<CrudHubListState>(
        () => ({
            page: search.page ?? 1,
            search: search.q ?? '',
            perPage: search.perPage,
            sort: search.sort ? { column: search.sort, direction: search.dir ?? 'asc' } : undefined,
        }),
        [search.page, search.q, search.perPage, search.sort, search.dir],
    );

    const onStateChange = useCallback(
        (patch: Partial<CrudHubListState>) => {
            const next = { ...state, ...patch };
            // Only non-default values go in the URL so a clean list has a clean address.
            const params: Record<string, unknown> = {};
            if (next.page > 1) params.page = next.page;
            if (next.search) params.q = next.search;
            if (next.perPage && next.perPage !== 10) params.perPage = next.perPage;
            if (next.sort) {
                params.sort = next.sort.column;
                params.dir = next.sort.direction;
            } else if (next.sort === null) {
                // An explicit "no sort" must survive in the URL, or the remembered sort returns.
                params.sort = '';
            }
            void navigate({ to: '.', search: params, replace: patch.search !== undefined } as never);
        },
        [navigate, state],
    );

    return (
        <div className="flex flex-col gap-6 pb-20">
            <Crumbs model={model} />
            <PageHeader
                title={model?.displayNamePlural ?? 'CrudHub'}
                description={model?.description}
                actions={
                    model ? (
                        <Link
                            to="/admin/infrastructure/database"
                            search={{ table: model.tableName, page: 1, perPage: 25 }}
                            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground ring-1 ring-border hover:bg-muted/70 hover:text-foreground"
                        >
                            <Table2 className="h-4 w-4" /> Open as table
                        </Link>
                    ) : undefined
                }
            />
            {model ? (
                <CrudHubList
                    key={model.entity}
                    model={model}
                    state={state}
                    onStateChange={onStateChange}
                    onNavigate={onNavigate}
                    canWrite={canWrite}
                />
            ) : (
                <ModelMissing loaded={loaded} />
            )}
        </div>
    );
}

// ─── /admin/crudhub/$model/$id ───────────────────────────────────────────────

export function CrudHubDetailPage() {
    const { model: entity, id } = useParams({ strict: false }) as { model: string; id: string };
    const onNavigate = useHubNavigate();
    const { model, models, loaded } = useHubModel(entity);
    const canWrite = useCanWrite(model);
    return (
        <div className="flex flex-col gap-6 pb-20">
            <Crumbs model={model} trail={[{ label: id }]} />
            {model ? (
                <CrudHubDetail model={model} id={id} onNavigate={onNavigate} canWrite={canWrite} models={models} />
            ) : (
                <ModelMissing loaded={loaded} />
            )}
        </div>
    );
}

// ─── /admin/crudhub/$model/new and /$id/edit ─────────────────────────────────

/**
 * Asks before leaving a dirty form by any route: links, the sidebar, Back, reload. Reads a ref so
 * the form can report clean right before its own post-create navigation.
 */
function useLeaveGuard() {
    const dirtyRef = useRef(false);
    const blocker = useBlocker({
        shouldBlockFn: () => dirtyRef.current,
        enableBeforeUnload: () => dirtyRef.current,
        withResolver: true,
    });
    const dialog = (
        <ConfirmDialog
            open={blocker.status === 'blocked'}
            onOpenChange={(open) => !open && blocker.reset?.()}
            tone="unsaved-changes"
            title="Discard changes?"
            description="You have unsaved changes. Leaving now will lose them."
            onConfirm={() => blocker.proceed?.()}
        />
    );
    return { onDirtyChange: (dirty: boolean) => (dirtyRef.current = dirty), dialog };
}

export function CrudHubFormPage() {
    const { model: entity, id } = useParams({ strict: false }) as { model: string; id?: string };
    const onNavigate = useHubNavigate();
    const { model, loaded } = useHubModel(entity);
    const canWrite = useCanWrite(model);
    const guard = useLeaveGuard();

    // A model with its own editor never edits through the generic form: go there instead.
    const customEdit =
        model?.routes?.edit && id ? fillRouteTokens(model.routes.edit, { id, [model.primaryKey]: id }) : null;
    useEffect(() => {
        if (customEdit) onNavigate(customEdit, { replace: true });
    }, [customEdit, onNavigate]);
    const trail = id
        ? [{ label: id, to: model ? crudHubPaths(model.entity).view(id) : undefined }, { label: 'Edit' }]
        : [{ label: 'New' }];
    return (
        <div className="flex flex-col gap-6 pb-20">
            <Crumbs model={model} trail={trail} />
            <PageHeader
                title={
                    model
                        ? id
                            ? `Edit ${model.displayName.toLowerCase()}`
                            : `New ${model.displayName.toLowerCase()}`
                        : 'CrudHub'
                }
            />
            {guard.dialog}
            {model && canWrite && !model.readOnly && !customEdit ? (
                <CrudHubForm model={model} id={id} onNavigate={onNavigate} onDirtyChange={guard.onDirtyChange} />
            ) : model ? (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground">
                    This model is read-only in CrudHub.
                </div>
            ) : (
                <ModelMissing loaded={loaded} />
            )}
        </div>
    );
}
