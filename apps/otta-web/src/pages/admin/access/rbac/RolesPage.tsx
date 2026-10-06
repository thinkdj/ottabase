/**
 * Roles: pick a role, tick the permissions the server actually checks, review
 * what changed, then save. Compare shows every role against every permission,
 * read-only, for the glance the old matrix gave without its save-on-every-tick.
 */

import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { UnsavedChangesDialog } from '@/components/editor/UnsavedChangesDialog';
import { useEditorLeaveGuard } from '@/hooks/useEditorLeaveGuard';
import { useCreateRole, useDeleteRole, useRoles, useUpdateRole } from '@/hooks/useRBAC';
import { useRBACToast } from '@/hooks/useToast';
import type { RoleRecord } from '@/types/rbac';
import { ConfirmDialog, EmptyState, LoadingState } from '@ottabase/ui-components';
import { Alert, Button, Checkbox, Input, Label, Textarea } from '@ottabase/ui-shadcn';
import { findGrantingPermission, PERMISSION_CATALOG, type PermissionDefinition } from '@ottabase/utils/permissions';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Check, Columns3, Plus, Trash2, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';

interface Draft {
    name: string;
    description: string;
    /** Raw grants as stored: catalog ids plus any wildcards like posts:* */
    grants: string[];
}

const NEW_ROLE = 'new';
const CATALOG_IDS = new Set(PERMISSION_CATALOG.map((p) => p.id));
const GROUPS = PERMISSION_CATALOG.reduce<Record<string, PermissionDefinition[]>>((acc, perm) => {
    (acc[perm.group] ??= []).push(perm);
    return acc;
}, {});

const fromRole = (role: RoleRecord): Draft => ({
    name: role.name,
    description: role.description ?? '',
    grants: [...(role.permissions ?? [])],
});
const EMPTY: Draft = { name: '', description: '', grants: [] };

const roleLabel = (role: RoleRecord) => role.displayName || role.name;

export function RolesPage() {
    const navigate = useNavigate();
    const { role: selectedId, view } = useSearch({ strict: false }) as { role?: string; view?: 'compare' };
    const comparing = view === 'compare';
    const toast = useRBACToast();
    const { data: roles = [], isLoading, error, refetch } = useRoles();
    const createRole = useCreateRole();
    const updateRole = useUpdateRole();
    const deleteRole = useDeleteRole();
    const [deleteOpen, setDeleteOpen] = useState(false);

    const creating = selectedId === NEW_ROLE;
    const selected = useMemo(() => roles.find((r) => r.id === selectedId) ?? null, [roles, selectedId]);
    const original = creating ? EMPTY : selected ? fromRole(selected) : null;
    const [draft, setDraft] = useState<Draft | null>(null);

    // A new selection (or a fresh copy of the same role) starts a clean draft
    useEffect(() => {
        setDraft(creating ? EMPTY : selected ? fromRole(selected) : null);
    }, [creating, selected]);

    const select = (id: string | null) =>
        navigate({ to: '/admin/access/rbac', search: { role: id ?? undefined, view: undefined }, replace: true });
    const compare = (on: boolean) =>
        navigate({
            to: '/admin/access/rbac',
            search: { role: on ? undefined : selectedId, view: on ? 'compare' : undefined },
            replace: true,
        });

    const added = draft && original ? draft.grants.filter((g) => !original.grants.includes(g)) : [];
    const removed = draft && original ? original.grants.filter((g) => !draft.grants.includes(g)) : [];
    const detailsChanged =
        !!draft && !!original && (draft.name !== original.name || draft.description !== original.description);
    const dirty = added.length > 0 || removed.length > 0 || detailsChanged;
    const readOnly = !!selected?.isSystem;
    const saving = createRole.isPending || updateRole.isPending;

    const { blocker, allowNavigateRef } = useEditorLeaveGuard(dirty && !readOnly);

    const setGrant = (id: string, on: boolean) =>
        setDraft((d) => d && { ...d, grants: on ? [...d.grants, id] : d.grants.filter((g) => g !== id) });

    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (!draft || readOnly) return;
        const name = draft.name.trim().toLowerCase();
        if (!/^[a-z0-9_-]{2,}$/.test(name)) {
            toast.error(
                'Pick a role name',
                'Lowercase letters, numbers, dashes or underscores; at least two characters.',
            );
            return;
        }
        const data = { name, description: draft.description.trim(), permissions: draft.grants };
        try {
            if (creating) {
                const created = await createRole.mutateAsync(data);
                toast.rbac.roleCreated();
                allowNavigateRef.current = true;
                select(created?.id ?? null);
            } else if (selected) {
                await updateRole.mutateAsync({ id: selected.id, data });
                toast.rbac.roleUpdated();
                setDraft({ ...draft, name });
            }
        } catch (err) {
            toast.error('Could not save the role', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    const remove = async () => {
        if (!selected) return;
        await deleteRole.mutateAsync(selected.id);
        toast.rbac.roleDeleted();
        setDeleteOpen(false);
        allowNavigateRef.current = true;
        select(null);
    };

    const system = roles.filter((r) => r.isSystem);
    const custom = roles.filter((r) => !r.isSystem);
    const wildcards = draft?.grants.filter((g) => !CATALOG_IDS.has(g)) ?? [];

    return (
        <div className="space-y-6">
            <UnsavedChangesDialog blocker={blocker} />
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Roles and permissions</h1>
                    <p className="max-w-3xl text-muted-foreground">
                        A role is a bundle of permissions. Pick one to see and change what it allows.
                    </p>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button
                        variant="outline"
                        onClick={() => compare(!comparing)}
                        aria-pressed={comparing}
                        className="gap-2"
                    >
                        <Columns3 className="h-4 w-4" />
                        {comparing ? 'Edit roles' : 'Compare roles'}
                    </Button>
                    <Button onClick={() => select(NEW_ROLE)} disabled={creating} className="gap-2">
                        <Plus className="h-4 w-4" />
                        New role
                    </Button>
                </div>
            </div>

            {error && <ApiErrorDisplay error={error} onRetry={() => refetch()} />}

            {isLoading && roles.length === 0 ? (
                <LoadingState count={5} height="h-12" />
            ) : comparing ? (
                <RoleComparison roles={[...custom, ...system]} onPick={select} />
            ) : (
                <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
                    <nav aria-label="Roles" className="space-y-4">
                        {creating && <RoleItem label="New role" meta="Unsaved" active onClick={() => undefined} />}
                        <RoleGroup title="Custom" roles={custom} selectedId={selectedId} onSelect={select} />
                        <RoleGroup title="System" roles={system} selectedId={selectedId} onSelect={select} />
                        {roles.length === 0 && !creating && (
                            <EmptyState compact title="No roles yet" description="Create the first one." />
                        )}
                    </nav>

                    {draft && original ? (
                        <form onSubmit={save} className="min-w-0 space-y-6">
                            {readOnly && (
                                <Alert variant="info">
                                    System roles are defined in code and kept in sync on deploy. To change what people
                                    can do, create a custom role.
                                </Alert>
                            )}

                            <fieldset disabled={readOnly || saving} className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="role-name">Name</Label>
                                    <Input
                                        id="role-name"
                                        value={draft.name}
                                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                        placeholder="editor"
                                        autoComplete="off"
                                        aria-describedby="role-name-hint"
                                    />
                                    <p id="role-name-hint" className="text-xs text-muted-foreground">
                                        Lowercase, no spaces. It is what the API and audit log show.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="role-description">Description</Label>
                                    <Textarea
                                        id="role-description"
                                        rows={2}
                                        value={draft.description}
                                        onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                                        placeholder="Writes and publishes posts"
                                    />
                                </div>
                            </fieldset>

                            <div className="space-y-5">
                                {Object.entries(GROUPS).map(([group, perms]) => (
                                    <section key={group} className="space-y-1">
                                        <h2 className="px-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                            {group}
                                        </h2>
                                        {perms.map((perm) => {
                                            const direct = draft.grants.includes(perm.id);
                                            const via = direct ? null : findGrantingPermission(draft.grants, perm.id);
                                            const id = `perm-${perm.id}`;
                                            return (
                                                <div
                                                    key={perm.id}
                                                    className="flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/40"
                                                >
                                                    <Checkbox
                                                        id={id}
                                                        checked={direct || !!via}
                                                        disabled={readOnly || !!via || saving}
                                                        onCheckedChange={(on) => setGrant(perm.id, on === true)}
                                                        className="mt-0.5"
                                                    />
                                                    <Label
                                                        htmlFor={id}
                                                        className="grid cursor-pointer gap-0.5 font-normal"
                                                    >
                                                        <span className="text-sm font-medium">
                                                            {perm.label}{' '}
                                                            <code className="font-mono text-xs text-muted-foreground">
                                                                {perm.id}
                                                            </code>
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {perm.description}
                                                            {via && (
                                                                <>
                                                                    {' '}
                                                                    Included in <code className="font-mono">{via}</code>
                                                                    .
                                                                </>
                                                            )}
                                                        </span>
                                                    </Label>
                                                </div>
                                            );
                                        })}
                                    </section>
                                ))}

                                <section className="space-y-2 px-3">
                                    <h2 className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Wildcard grants
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        <code className="font-mono">posts:*</code> covers every posts permission,{' '}
                                        <code className="font-mono">*:*</code> everything. Ticks above show what each
                                        one already includes.
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {wildcards.map((g) => (
                                            <span
                                                key={g}
                                                className="inline-flex items-center gap-1 rounded-full bg-background py-0.5 pl-2.5 pr-1 font-mono text-xs ring-1 ring-border"
                                            >
                                                {g}
                                                {!readOnly && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setGrant(g, false)}
                                                        aria-label={`Remove ${g}`}
                                                        className="rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                )}
                                            </span>
                                        ))}
                                        {!readOnly && <WildcardInput onAdd={(g) => setGrant(g, true)} />}
                                    </div>
                                </section>
                            </div>

                            {!readOnly && (
                                <div className="sticky bottom-0 flex flex-col gap-3 border-t border-border bg-background/95 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-sm text-muted-foreground" aria-live="polite">
                                        {dirty ? (
                                            <>
                                                {creating ? 'New role' : 'Unsaved'}
                                                {added.length > 0 && `: adding ${added.length}`}
                                                {removed.length > 0 &&
                                                    `${added.length ? ',' : ':'} removing ${removed.length}`}
                                                {detailsChanged &&
                                                    !added.length &&
                                                    !removed.length &&
                                                    ': details changed'}
                                                {(added.length > 0 || removed.length > 0) && ' permission'}
                                                {added.length + removed.length > 1 && 's'}
                                            </>
                                        ) : creating ? (
                                            'Give it a name and tick what it allows'
                                        ) : (
                                            'Saved'
                                        )}
                                    </p>
                                    <div className="flex gap-2">
                                        {selected && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                className="text-muted-foreground hover:text-destructive"
                                                onClick={() => setDeleteOpen(true)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </Button>
                                        )}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={!dirty || saving}
                                            onClick={() => (creating ? select(null) : setDraft(original))}
                                        >
                                            {creating ? 'Cancel' : 'Discard'}
                                        </Button>
                                        <Button type="submit" disabled={!dirty || saving}>
                                            {saving ? 'Saving…' : creating ? 'Create role' : 'Save changes'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </form>
                    ) : (
                        <EmptyState
                            title="Pick a role"
                            description="Choose one on the left to see what it allows, or create a new one."
                        />
                    )}
                </div>
            )}

            <ConfirmDialog
                open={deleteOpen}
                onOpenChange={setDeleteOpen}
                title={`Delete ${selected ? roleLabel(selected) : 'role'}?`}
                description="Everyone holding it loses its permissions. This cannot be undone."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={remove}
            />
        </div>
    );
}

/** Every role against every permission, read-only; a role name opens it in the editor */
function RoleComparison({ roles, onPick }: { roles: RoleRecord[]; onPick: (id: string) => void }) {
    if (roles.length === 0) return <EmptyState compact title="No roles yet" description="Create the first one." />;
    const grant = (role: RoleRecord, id: string) => {
        const grants = role.permissions ?? [];
        if (grants.includes(id)) return { on: true, via: null };
        return { on: false, via: findGrantingPermission(grants, id) };
    };
    return (
        <div className="overflow-x-auto rounded-xl ring-1 ring-border">
            <table className="w-full min-w-[40rem] text-sm">
                <caption className="sr-only">Which permissions each role grants</caption>
                <thead>
                    <tr className="bg-muted/40 text-left">
                        <th scope="col" className="sticky left-0 bg-muted/40 px-3 py-2 font-medium">
                            Permission
                        </th>
                        {roles.map((role) => (
                            <th key={role.id} scope="col" className="px-3 py-2 text-center font-medium">
                                <button
                                    type="button"
                                    onClick={() => onPick(role.id)}
                                    className="rounded-md px-1.5 py-0.5 hover:bg-accent hover:text-accent-foreground"
                                >
                                    {roleLabel(role)}
                                </button>
                                {role.isSystem && (
                                    <span className="block text-[0.6875rem] font-normal text-muted-foreground">
                                        system
                                    </span>
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(GROUPS).map(([group, perms]) => (
                        <Fragment key={group}>
                            <tr>
                                <th
                                    scope="rowgroup"
                                    colSpan={roles.length + 1}
                                    className="px-3 pb-1 pt-4 text-left text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground"
                                >
                                    {group}
                                </th>
                            </tr>
                            {perms.map((perm) => (
                                <tr key={perm.id} className="border-t border-border/60">
                                    <th
                                        scope="row"
                                        className="sticky left-0 bg-background px-3 py-1.5 text-left font-normal"
                                    >
                                        {perm.label}{' '}
                                        <code className="font-mono text-xs text-muted-foreground">{perm.id}</code>
                                    </th>
                                    {roles.map((role) => {
                                        const { on, via } = grant(role, perm.id);
                                        return (
                                            <td key={role.id} className="px-3 py-1.5 text-center">
                                                {on || via ? (
                                                    <Check
                                                        className={`mx-auto h-4 w-4 ${via ? 'text-muted-foreground' : 'text-success'}`}
                                                        aria-hidden="true"
                                                    />
                                                ) : null}
                                                <span className="sr-only">
                                                    {on ? 'Yes' : via ? `Yes, via ${via}` : 'No'}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </Fragment>
                    ))}
                    <tr className="border-t border-border/60">
                        <th scope="row" className="sticky left-0 bg-background px-3 py-2 text-left font-normal">
                            Wildcard grants
                        </th>
                        {roles.map((role) => (
                            <td key={role.id} className="px-3 py-2 text-center font-mono text-xs text-muted-foreground">
                                {(role.permissions ?? []).filter((g) => !CATALOG_IDS.has(g)).join(' ') || null}
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-muted-foreground">
                A green tick is a direct grant; a grey one comes from a wildcard. Pick a role name to edit it.
            </p>
        </div>
    );
}

function RoleGroup({
    title,
    roles,
    selectedId,
    onSelect,
}: {
    title: string;
    roles: RoleRecord[];
    selectedId?: string;
    onSelect: (id: string) => void;
}) {
    if (roles.length === 0) return null;
    return (
        <div className="space-y-1">
            <h2 className="px-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
            {roles.map((role) => (
                <RoleItem
                    key={role.id}
                    label={roleLabel(role)}
                    meta={`${role.permissions?.length ?? 0} grant${role.permissions?.length === 1 ? '' : 's'}`}
                    active={role.id === selectedId}
                    onClick={() => onSelect(role.id)}
                />
            ))}
        </div>
    );
}

function RoleItem({
    label,
    meta,
    active,
    onClick,
}: {
    label: string;
    meta: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-current={active ? 'true' : undefined}
            className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                active
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            }`}
        >
            <span className="truncate">{label}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>
        </button>
    );
}

/** Small inline input for the rare wildcard grant; Enter adds it */
function WildcardInput({ onAdd }: { onAdd: (grant: string) => void }) {
    const [value, setValue] = useState('');
    const add = () => {
        const g = value.trim().toLowerCase();
        if (/^[a-z0-9_*-]+:[a-z0-9_*-]+$/.test(g)) {
            onAdd(g);
            setValue('');
        }
    };
    return (
        <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    add();
                }
            }}
            onBlur={add}
            placeholder="Add a grant like posts:*"
            aria-label="Add a wildcard grant"
            className="h-8 w-56 font-mono text-xs"
        />
    );
}
