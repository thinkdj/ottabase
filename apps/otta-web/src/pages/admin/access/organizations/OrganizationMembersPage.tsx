import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { useLastRefreshed } from '@/hooks/useLastRefreshed';
import {
    useInviteByEmail,
    useInviteMember,
    useOrganization,
    useOrganizationMembers,
    useOrganizationPendingInvites,
    useRemoveMember,
    useResendOrganizationInvite,
    useRevokeOrganizationInvite,
    useUpdateMember,
    useUpdateMemberRole,
    useUpdateMemberStatus,
} from '@/hooks/useRBAC';
import { useRBACToast } from '@/hooks/useToast';
import { isApiError } from '@/lib/api';
import { organizationIdAtom } from '@/ottabase/state/appState';
import type { MemberRole, OrganizationMemberRecord, OrganizationPendingInviteRecord } from '@/types/rbac';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import { IconBan, IconMailForward } from '@tabler/icons-react';
import { Link, useParams } from '@tanstack/react-router';
import { useAtomValue } from 'jotai';
import { ChevronLeft, ChevronRight, Edit, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { InviteMemberForm, type InviteMemberFormData } from './components/InviteMemberForm';

function formatInviteDate(timestamp: number): string {
    const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
    return new Date(ms).toLocaleString();
}

export function OrganizationMembersPage() {
    const toast = useRBACToast();
    const { organizationId } = useParams({ strict: false }) as { organizationId?: string };
    const currentOrganizationId = useAtomValue(organizationIdAtom);
    const isPlatformMode = Boolean(organizationId);
    const scopedOrganizationId = isPlatformMode ? organizationId : undefined;
    const hasOrganizationContext = isPlatformMode ? !!organizationId : !!currentOrganizationId;

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<OrganizationMemberRecord | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
    const [revokeInviteId, setRevokeInviteId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const {
        data: organization,
        isLoading: organizationLoading,
        error: organizationError,
        refetch: refetchOrganization,
    } = useOrganization(scopedOrganizationId, { enabled: hasOrganizationContext });
    const {
        data: response,
        isLoading,
        isRefetching,
        error,
        refetch,
    } = useOrganizationMembers(scopedOrganizationId, currentPage, 25, hasOrganizationContext);
    const {
        data: pendingInvites = [],
        isLoading: invitesLoading,
        error: invitesError,
        refetch: refetchInvites,
    } = useOrganizationPendingInvites(scopedOrganizationId, hasOrganizationContext);

    const members: OrganizationMemberRecord[] = response?.data ?? [];
    const pagination = response?.pagination;
    const { label: lastRefreshedLabel, touch: touchRefreshed } = useLastRefreshed({
        isReady: hasOrganizationContext && !isLoading && !error,
    });

    const inviteMutation = useInviteMember();
    const inviteByEmailMutation = useInviteByEmail();
    const revokeInviteMutation = useRevokeOrganizationInvite();
    const resendInviteMutation = useResendOrganizationInvite();
    const updateMemberMutation = useUpdateMember();
    const updateRoleMutation = useUpdateMemberRole();
    const updateStatusMutation = useUpdateMemberStatus();
    const removeMutation = useRemoveMember();

    useEffect(() => {
        setCurrentPage(1);
    }, [organizationId, currentOrganizationId]);

    const handleRefresh = async () => {
        await Promise.all([refetchOrganization(), refetch(), refetchInvites()]);
        touchRefreshed();
    };

    const handleInvite = () => {
        setEditingMember(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (member: OrganizationMemberRecord) => {
        setEditingMember(member);
        setIsDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;

        removeMutation.mutate(
            { userId: deleteDialog, organizationId: scopedOrganizationId },
            {
                onSuccess: () => {
                    toast.rbac.memberRemoved();
                    setDeleteDialog(null);
                },
                onError: (err) => {
                    toast.error('Failed to remove member', err instanceof Error ? err.message : 'Unknown error');
                },
            },
        );
    };

    const handleConfirmRevokeInvite = () => {
        if (!revokeInviteId) return;

        revokeInviteMutation.mutate(
            { organizationId: scopedOrganizationId, inviteId: revokeInviteId },
            {
                onSuccess: () => {
                    toast.success('Invitation revoked', 'The pending invite link no longer works.');
                    setRevokeInviteId(null);
                },
                onError: (err) => {
                    toast.error('Failed to revoke invite', err instanceof Error ? err.message : 'Unknown error');
                },
            },
        );
    };

    const handleResendInvite = (invite: OrganizationPendingInviteRecord) => {
        resendInviteMutation.mutate(
            { organizationId: scopedOrganizationId, inviteId: invite.id },
            {
                onSuccess: () => {
                    toast.success('Invitation resent', `A new email was sent to ${invite.email}.`);
                },
                onError: (err) => {
                    toast.error('Failed to resend invite', err instanceof Error ? err.message : 'Unknown error');
                },
            },
        );
    };

    const handleQuickRoleChange = (userId: string, newRole: MemberRole) => {
        updateRoleMutation.mutate(
            { userId, role: newRole, organizationId: scopedOrganizationId },
            {
                onSuccess: () => {
                    toast.rbac.memberUpdated();
                },
                onError: (err) => {
                    toast.error('Failed to update role', err instanceof Error ? err.message : 'Unknown error');
                },
            },
        );
    };

    const handleQuickStatusChange = (userId: string, newStatus: 'active' | 'invited' | 'suspended') => {
        updateStatusMutation.mutate(
            { userId, status: newStatus, organizationId: scopedOrganizationId },
            {
                onSuccess: () => {
                    toast.rbac.memberUpdated();
                },
                onError: (err) => {
                    toast.error('Failed to update status', err instanceof Error ? err.message : 'Unknown error');
                },
            },
        );
    };

    const handleSubmit = async (data: InviteMemberFormData) => {
        try {
            if (editingMember) {
                await updateMemberMutation.mutateAsync({
                    organizationId: scopedOrganizationId,
                    userId: editingMember.userId,
                    role: data.role,
                    status: data.status,
                });
                toast.rbac.memberUpdated();
            } else if (data.inviteEmail?.trim()) {
                await inviteByEmailMutation.mutateAsync({
                    organizationId: scopedOrganizationId,
                    email: data.inviteEmail.trim(),
                    role: data.role,
                });
                toast.success('Invitation email sent', 'They will receive a link to accept this invitation.');
            } else {
                await inviteMutation.mutateAsync({
                    userId: data.userId,
                    organizationId: scopedOrganizationId,
                    role: data.role,
                    status: data.status,
                });
                toast.rbac.memberInvited();
            }

            setIsDialogOpen(false);
            setEditingMember(null);
        } catch (err) {
            throw new Error(isApiError(err) ? err.message : 'Failed to invite member');
        }
    };

    if (!hasOrganizationContext) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>No organization selected</CardTitle>
                    <CardDescription>
                        Select an organization from the switcher or create one to manage members.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Button asChild>
                        <Link to={'/onboarding/organization' as never}>Create Organization</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link to={'/dashboard' as never}>Back to Dashboard</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <CardTitle>
                                {organization?.name ? `${organization.name} Members` : 'Organization Members'}
                            </CardTitle>
                            <CardDescription>
                                {isPlatformMode
                                    ? 'Platform-admin member management for this tenant.'
                                    : 'Manage members, roles, and pending invites for the current organization.'}
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <div className="flex items-center pr-1 text-xs text-muted-foreground">
                                {lastRefreshedLabel}
                            </div>
                            <Button
                                variant="outline"
                                onClick={handleRefresh}
                                disabled={isLoading || isRefetching || organizationLoading}
                            >
                                <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                            </Button>
                            {isPlatformMode ? (
                                <Button variant="outline" asChild>
                                    <Link to={'/admin/platform/organizations' as never}>
                                        ← Back to Tenant Directory
                                    </Link>
                                </Button>
                            ) : (
                                <Button variant="outline" asChild>
                                    <Link to={'/admin/organization/settings' as never}>Organization Settings</Link>
                                </Button>
                            )}
                            <Button onClick={handleInvite} className="gap-2">
                                <UserPlus className="h-4 w-4" />
                                Invite Member
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {organizationError && (
                        <ApiErrorDisplay
                            error={
                                organizationError instanceof Error
                                    ? organizationError
                                    : new Error('Failed to load organization')
                            }
                            onRetry={() => refetchOrganization()}
                            className="mb-4"
                        />
                    )}
                    {invitesError && (
                        <p className="mb-4 text-sm text-destructive dark:text-red-400">
                            Could not load pending email invites. Try refresh.
                        </p>
                    )}
                    {error && (
                        <ApiErrorDisplay
                            error={error instanceof Error ? error : new Error('Failed to load members')}
                            onRetry={() => refetch()}
                            className="mb-4"
                        />
                    )}

                    {isLoading || organizationLoading ? (
                        <TableSkeleton rows={5} columns={6} />
                    ) : members.length === 0 ? (
                        <div className="py-8 text-center text-muted-foreground">
                            No members found. Invite the first member.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Invited</TableHead>
                                    <TableHead>Joined</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map((member) => {
                                    const locked = member.isLastActiveOwner === true;

                                    return (
                                        <TableRow key={member.id}>
                                            <TableCell>
                                                <div className="min-w-0 space-y-0.5">
                                                    <div className="truncate font-medium">
                                                        {member.user?.name || 'Unknown user'}
                                                    </div>
                                                    <div className="truncate text-xs text-muted-foreground">
                                                        {member.user?.email || member.userId}
                                                    </div>
                                                    <code className="text-[11px] text-muted-foreground">
                                                        {member.userId}
                                                    </code>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={member.role}
                                                    onValueChange={(value: MemberRole) =>
                                                        handleQuickRoleChange(member.userId, value)
                                                    }
                                                    disabled={
                                                        locked ||
                                                        updateRoleMutation.isPending ||
                                                        updateStatusMutation.isPending
                                                    }
                                                >
                                                    <SelectTrigger className="w-32">
                                                        <span className="capitalize">{member.role}</span>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="owner">Owner</SelectItem>
                                                        <SelectItem value="admin">Admin</SelectItem>
                                                        <SelectItem value="member">Member</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Select
                                                    value={member.status}
                                                    onValueChange={(value: 'active' | 'invited' | 'suspended') =>
                                                        handleQuickStatusChange(member.userId, value)
                                                    }
                                                    disabled={
                                                        locked ||
                                                        updateRoleMutation.isPending ||
                                                        updateStatusMutation.isPending
                                                    }
                                                >
                                                    <SelectTrigger className="w-36">
                                                        <span className="capitalize">{member.status}</span>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="active">Active</SelectItem>
                                                        <SelectItem value="invited">Invited</SelectItem>
                                                        <SelectItem value="suspended">Suspended</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                {member.invitedAt
                                                    ? new Date(member.invitedAt).toLocaleDateString()
                                                    : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEdit(member)}
                                                        disabled={
                                                            locked ||
                                                            updateRoleMutation.isPending ||
                                                            updateStatusMutation.isPending ||
                                                            updateMemberMutation.isPending
                                                        }
                                                        title={
                                                            locked
                                                                ? 'This is the only active owner; add another owner before changing this member.'
                                                                : undefined
                                                        }
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => setDeleteDialog(member.userId)}
                                                        disabled={locked || removeMutation.isPending}
                                                        title={
                                                            locked ? 'Cannot remove the only active owner.' : undefined
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <CardTitle>Pending email invites</CardTitle>
                            <CardDescription>
                                Invitations sent by email. Resend refreshes the link; revoke invalidates it.
                            </CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void refetchInvites()}
                            disabled={invitesLoading}
                        >
                            <RefreshCw className={`h-4 w-4 ${invitesLoading ? 'animate-spin' : ''}`} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {invitesLoading ? (
                        <TableSkeleton rows={3} columns={5} />
                    ) : pendingInvites.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground dark:text-slate-400">
                            No pending email invites for this organization.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Sent</TableHead>
                                    <TableHead>Expires</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingInvites.map((invite) => (
                                    <TableRow key={invite.id}>
                                        <TableCell className="font-medium">{invite.email}</TableCell>
                                        <TableCell className="capitalize">{invite.role}</TableCell>
                                        <TableCell>{formatInviteDate(invite.invitedAt)}</TableCell>
                                        <TableCell>{formatInviteDate(invite.expiresAt)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1 dark:border-slate-600"
                                                    onClick={() => handleResendInvite(invite)}
                                                    disabled={resendInviteMutation.isPending}
                                                >
                                                    <IconMailForward className="h-4 w-4" />
                                                    Resend
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1 border-destructive/30 text-destructive dark:border-red-900 dark:text-red-400"
                                                    onClick={() => setRevokeInviteId(invite.id)}
                                                    disabled={revokeInviteMutation.isPending}
                                                >
                                                    <IconBan className="h-4 w-4" />
                                                    Revoke
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {!isLoading && pagination && pagination.total > pagination.perPage && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing {(pagination.page - 1) * pagination.perPage + 1}-
                        {Math.min(pagination.page * pagination.perPage, pagination.total)} of {pagination.total} members
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                            disabled={pagination.page <= 1}
                        >
                            <ChevronLeft className="mr-1 h-4 w-4" />
                            Prev
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((page) => page + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                        >
                            Next
                            <ChevronRight className="ml-1 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingMember ? 'Edit Member' : 'Invite Member'}</DialogTitle>
                        <DialogDescription>
                            {editingMember
                                ? 'Update member role and status.'
                                : 'Invite a new member to this organization.'}
                        </DialogDescription>
                    </DialogHeader>
                    <InviteMemberForm
                        organizationId={scopedOrganizationId ?? currentOrganizationId ?? ''}
                        editingMember={editingMember}
                        onSubmit={handleSubmit}
                        onCancel={() => setIsDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!deleteDialog}
                onOpenChange={(open) => !open && setDeleteDialog(null)}
                title="Remove Member?"
                description="This will remove the member from the organization. They will lose access immediately."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Remove"
                onConfirm={handleConfirmDelete}
            />

            <ConfirmDialog
                open={!!revokeInviteId}
                onOpenChange={(open) => !open && setRevokeInviteId(null)}
                title="Revoke invitation?"
                description="The invite link will stop working. You can send a new invite later if needed."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Revoke"
                onConfirm={handleConfirmRevokeInvite}
            />
        </div>
    );
}
