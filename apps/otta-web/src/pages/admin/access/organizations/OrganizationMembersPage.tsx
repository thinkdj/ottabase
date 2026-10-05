/**
 * Members of one organization: who is in, their role and state, and invites still open.
 */
import {
    useInviteMember,
    useOrganization,
    useOrganizationMembers,
    useRemoveMember,
    useUpdateMember,
    useUpdateMemberRole,
    useUpdateMemberStatus,
} from '@/hooks/useRBAC';
import { useRBACToast } from '@/hooks/useToast';
import { isApiError } from '@/lib/api';
import { organizationIdAtom } from '@/ottabase/state/appState';
import type { MemberRole, MemberStatus, OrganizationMemberRecord } from '@/types/rbac';
import { ConfirmDialog } from '@ottabase/ui-components';
import { useDataTable, useListState } from '@ottabase/ui-datatable';
import { actionsColumn, createColumns, DataTable } from '@ottabase/ui-datatable/react';
import {
    Alert,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    NativeSelect,
    NativeSelectOption,
} from '@ottabase/ui-shadcn';
import { formatShortDate } from '@ottabase/utils/timezone';
import { Link, useParams } from '@tanstack/react-router';
import { useSetAtom } from 'jotai';
import { ArrowLeft, Pencil, Trash2, UserPlus, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { InviteMemberForm, type InviteMemberFormData } from './components/InviteMemberForm';

const CURRENT_ORG_KEY = 'ottabase.current-org-id';
const ROLES: MemberRole[] = ['owner', 'admin', 'member'];
const STATUSES: MemberStatus[] = ['active', 'invited', 'suspended'];
const NO_MEMBERS: OrganizationMemberRecord[] = [];

const errorText = (err: unknown) => (err instanceof Error ? err.message : 'Unknown error');

export function OrganizationMembersPage() {
    const toast = useRBACToast();
    const { organizationId = '' } = useParams({ strict: false }) as { organizationId?: string };
    const setOrganizationId = useSetAtom(organizationIdAtom);
    /** `'invite'` opens an empty form; a record opens it filled in */
    const [editing, setEditing] = useState<OrganizationMemberRecord | 'invite' | null>(null);
    const [pendingRemove, setPendingRemove] = useState<OrganizationMemberRecord | null>(null);

    const list = useListState();
    const organization = useOrganization(organizationId);
    const members = useOrganizationMembers(organizationId, list.page, list.perPage);
    const rows = members.data?.data ?? NO_MEMBERS;
    const total = members.data?.pagination.total;

    const inviteMutation = useInviteMember();
    const updateMemberMutation = useUpdateMember();
    const updateRoleMutation = useUpdateMemberRole();
    const updateStatusMutation = useUpdateMemberStatus();
    const removeMutation = useRemoveMember();

    // The rest of the admin area follows the organization being looked at.
    const { reset } = list;
    useEffect(() => {
        if (!organizationId) return;
        setOrganizationId(organizationId);
        reset();
        try {
            localStorage.setItem(CURRENT_ORG_KEY, organizationId);
        } catch {
            // storage may be unavailable
        }
    }, [organizationId, reset, setOrganizationId]);

    const { mutate: mutateRole } = updateRoleMutation;
    const { mutate: mutateStatus } = updateStatusMutation;
    const changeRole = useCallback(
        (userId: string, role: MemberRole) =>
            mutateRole(
                { userId, role, organizationId },
                {
                    onSuccess: () => toast.rbac.memberUpdated(),
                    onError: (err) => toast.error('Failed to update role', errorText(err)),
                },
            ),
        [mutateRole, organizationId, toast],
    );
    const changeStatus = useCallback(
        (userId: string, status: MemberStatus) =>
            mutateStatus(
                { userId, status, organizationId },
                {
                    onSuccess: () => toast.rbac.memberUpdated(),
                    onError: (err) => toast.error('Failed to update status', errorText(err)),
                },
            ),
        [mutateStatus, organizationId, toast],
    );

    const save = async (data: InviteMemberFormData) => {
        try {
            if (editing && editing !== 'invite') {
                if (!editing.userId) return;
                await updateMemberMutation.mutateAsync({
                    organizationId,
                    userId: editing.userId,
                    role: data.role,
                    status: data.status ?? editing.status,
                });
                toast.rbac.memberUpdated();
            } else {
                await inviteMutation.mutateAsync({ ...data, organizationId });
                toast.rbac.memberInvited();
            }
            setEditing(null);
        } catch (err) {
            throw new Error(isApiError(err) ? err.message : 'Failed to invite member');
        }
    };

    const confirmRemove = () => {
        if (!pendingRemove) return;
        removeMutation.mutate(
            { memberId: pendingRemove.id, userId: pendingRemove.userId ?? undefined, organizationId },
            {
                onSuccess: () => toast.rbac.memberRemoved(),
                onError: (err) => toast.error('Failed to remove member', errorText(err)),
                onSettled: () => setPendingRemove(null),
            },
        );
    };

    const busy = updateRoleMutation.isPending || updateStatusMutation.isPending;
    const columns = useMemo(
        () => [
            ...createColumns<OrganizationMemberRecord>([
                { key: 'user', header: 'Member', cell: ({ row }) => <MemberCell member={row} /> },
                {
                    key: 'role',
                    header: 'Role',
                    width: 130,
                    cell: ({ row }) => (
                        <NativeSelect
                            value={row.role}
                            aria-label={`Role of ${memberName(row)}`}
                            disabled={!row.userId || busy}
                            onChange={(e) => row.userId && changeRole(row.userId, e.target.value as MemberRole)}
                            size="sm"
                            className="w-32 capitalize"
                        >
                            {ROLES.map((role) => (
                                <NativeSelectOption key={role} value={role} className="capitalize">
                                    {role}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    ),
                },
                {
                    key: 'status',
                    header: 'Status',
                    width: 140,
                    cell: ({ row }) => (
                        <NativeSelect
                            value={row.status}
                            aria-label={`Status of ${memberName(row)}`}
                            disabled={!row.userId || busy}
                            onChange={(e) => row.userId && changeStatus(row.userId, e.target.value as MemberStatus)}
                            size="sm"
                            className="w-36 capitalize"
                        >
                            {STATUSES.map((status) => (
                                <NativeSelectOption key={status} value={status} className="capitalize">
                                    {status}
                                </NativeSelectOption>
                            ))}
                        </NativeSelect>
                    ),
                },
                {
                    key: 'invitedAt',
                    header: 'Invited',
                    width: 130,
                    cell: ({ row }) => (
                        <span className="text-muted-foreground">
                            {row.invitedAt ? formatShortDate(row.invitedAt) : ''}
                        </span>
                    ),
                },
                {
                    key: 'joinedAt',
                    header: 'Joined',
                    width: 130,
                    cell: ({ row }) => (
                        <span className="text-muted-foreground">
                            {row.joinedAt ? formatShortDate(row.joinedAt) : ''}
                        </span>
                    ),
                },
            ]),
            actionsColumn<OrganizationMemberRecord>([
                { label: 'Edit', icon: Pencil, onClick: setEditing, disabled: (row) => !row.userId },
                { label: 'Remove', icon: Trash2, variant: 'destructive', onClick: setPendingRemove },
            ]),
        ],
        [busy, changeRole, changeStatus],
    );

    const { table } = useDataTable<OrganizationMemberRecord>({
        data: rows,
        columns,
        getRowId: (row) => row.id,
        list,
        rowCount: total,
    });

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to={'/admin/access/organizations' as never}>
                        <ArrowLeft className="h-4 w-4" />
                        Back to Organizations
                    </Link>
                </Button>
                <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <Users className="h-7 w-7 text-primary" />
                            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                                {organization.data?.name ?? 'Members'}
                            </h1>
                        </div>
                        <p className="text-muted-foreground">
                            Who is in this organization and what each person may do. Invites stay open until the invitee
                            signs up.
                        </p>
                    </div>
                    <Button onClick={() => setEditing('invite')} className="shrink-0 gap-2">
                        <UserPlus className="h-4 w-4" />
                        Invite member
                    </Button>
                </header>
            </div>

            {members.error && <Alert variant="destructive">{members.error.message}</Alert>}

            <DataTable
                table={table}
                isLoading={members.isLoading}
                emptyIcon={Users}
                emptyMessage="No members yet. Invite the first one."
                pageSizeOptions={[25, 50, 100]}
            />

            <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editing === 'invite' ? 'Invite member' : 'Edit member'}</DialogTitle>
                        <DialogDescription>
                            {editing === 'invite'
                                ? 'Add someone by account or email address.'
                                : 'Change their role and status.'}
                        </DialogDescription>
                    </DialogHeader>
                    {editing && (
                        <InviteMemberForm
                            key={editing === 'invite' ? 'invite' : editing.id}
                            organizationId={organizationId}
                            editingMember={editing === 'invite' ? null : editing}
                            onSubmit={save}
                            onCancel={() => setEditing(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={pendingRemove !== null}
                onOpenChange={(open) => !open && setPendingRemove(null)}
                title={pendingRemove?.userId ? `Remove ${memberName(pendingRemove)}?` : 'Cancel this invite?'}
                description={
                    pendingRemove?.userId
                        ? 'They lose access to this organization right away.'
                        : 'The invitation stops working. You can invite them again later.'
                }
                tone="destructive"
                secondaryActionText="Keep"
                primaryActionText={pendingRemove?.userId ? 'Remove' : 'Cancel invite'}
                onConfirm={confirmRemove}
                confirmProps={{ disabled: removeMutation.isPending }}
            />
        </div>
    );
}

const memberName = (member: OrganizationMemberRecord) =>
    member.user?.name || member.user?.email || member.invitedEmail || member.userId || 'pending invite';

/** Name and email, or the address an open invite went to */
function MemberCell({ member }: { member: OrganizationMemberRecord }) {
    const pending = !member.userId;
    return (
        <span className="block min-w-0">
            <span className="block truncate font-medium">
                {pending ? 'Pending invite' : member.user?.name || 'Unknown user'}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
                {pending ? member.invitedEmail || 'Awaiting signup' : member.user?.email || member.userId}
            </span>
        </span>
    );
}
