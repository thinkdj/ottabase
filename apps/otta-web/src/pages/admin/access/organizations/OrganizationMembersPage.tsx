import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { useLastRefreshed } from '@/hooks/useLastRefreshed';
import {
    useInviteMember,
    useOrganizationMembers,
    useRemoveMember,
    useUpdateMember,
    useUpdateMemberRole,
    useUpdateMemberStatus,
} from '@/hooks/useRBAC';
import { useRBACToast } from '@/hooks/useToast';
import { isApiError } from '@/lib/api';
import { organizationIdAtom } from '@/ottabase/state/appState';
import type { MemberRole, OrganizationMemberRecord } from '@/types/rbac';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Button,
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
import { Link, useParams } from '@tanstack/react-router';
import { useSetAtom } from 'jotai';
import { ArrowLeft, ChevronLeft, ChevronRight, Edit, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { InviteMemberForm, type InviteMemberFormData } from './components/InviteMemberForm';

const CURRENT_ORG_KEY = 'ottabase.current-org-id';

export function OrganizationMembersPage() {
    const toast = useRBACToast();
    const { organizationId = '' } = useParams({ strict: false }) as { organizationId?: string };
    const setOrganizationId = useSetAtom(organizationIdAtom);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<OrganizationMemberRecord | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const {
        data: response,
        isLoading,
        isRefetching,
        error,
        refetch,
    } = useOrganizationMembers(organizationId, currentPage);
    const members: OrganizationMemberRecord[] = response?.data ?? [];
    const pagination = response?.pagination;
    const { label: lastRefreshedLabel, touch: touchRefreshed } = useLastRefreshed({
        isReady: !isLoading && !error,
    });
    const inviteMutation = useInviteMember();
    const updateMemberMutation = useUpdateMember();
    const updateRoleMutation = useUpdateMemberRole();
    const updateStatusMutation = useUpdateMemberStatus();
    const removeMutation = useRemoveMember();

    useEffect(() => {
        if (!organizationId) return;
        setOrganizationId(organizationId);
        setCurrentPage(1);
        try {
            localStorage.setItem(CURRENT_ORG_KEY, organizationId);
        } catch {
            // ignore storage failures
        }
    }, [organizationId, setOrganizationId]);

    const handleRefresh = async () => {
        await refetch();
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

    const handleDelete = async (userId: string) => {
        setDeleteDialog(userId);
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;

        const userId = deleteDialog;
        removeMutation.mutate(
            { userId, organizationId },
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

    // Optimistic role change with instant UI feedback
    const handleQuickRoleChange = async (userId: string, newRole: MemberRole) => {
        updateRoleMutation.mutate(
            { userId, role: newRole, organizationId },
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

    const handleQuickStatusChange = async (userId: string, newStatus: 'active' | 'invited' | 'suspended') => {
        updateStatusMutation.mutate(
            { userId, status: newStatus, organizationId },
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
                    organizationId,
                    userId: editingMember.userId,
                    role: data.role,
                    status: data.status ?? editingMember.status,
                });
                toast.rbac.memberUpdated();
            } else {
                await inviteMutation.mutateAsync({
                    ...data,
                    organizationId,
                });
                toast.rbac.memberInvited();
            }
            setIsDialogOpen(false);
            setEditingMember(null);
        } catch (err) {
            throw new Error(isApiError(err) ? err.message : 'Failed to invite member');
        }
    };

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to={'/admin/access/organizations' as never}>
                        <ArrowLeft className="h-4 w-4" />
                        Back to Organizations
                    </Link>
                </Button>

                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1.5">
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Organization Members</h1>
                        <p className="max-w-3xl text-muted-foreground">Manage members and their roles</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <span className="pr-1 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            {lastRefreshedLabel}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={handleRefresh}
                            disabled={isLoading || isRefetching}
                        >
                            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button onClick={handleInvite} className="gap-2">
                            <UserPlus className="h-4 w-4" />
                            Invite Member
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {error && (
                    <ApiErrorDisplay
                        error={error instanceof Error ? error : new Error('Failed to load members')}
                        onRetry={() => refetch()}
                    />
                )}

                {isLoading ? (
                    <div className="space-y-3" aria-busy="true">
                        <span className="sr-only">Loading members…</span>
                        {Array.from({ length: 5 }, (_, index) => (
                            <div key={index} className="h-12 animate-pulse rounded-xl bg-muted/40" />
                        ))}
                    </div>
                ) : members.length === 0 ? (
                    <div className="rounded-xl bg-muted/40 py-12 text-center">
                        <p className="text-sm text-muted-foreground">No members found. Invite the first member!</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border/60">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="border-border/60 hover:bg-transparent">
                                    <TableHead className="h-auto px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        User
                                    </TableHead>
                                    <TableHead className="h-auto px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Role
                                    </TableHead>
                                    <TableHead className="h-auto px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Status
                                    </TableHead>
                                    <TableHead className="h-auto px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Invited
                                    </TableHead>
                                    <TableHead className="h-auto px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Joined
                                    </TableHead>
                                    <TableHead className="h-auto px-4 py-3 text-right text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map((member) => (
                                    <TableRow
                                        key={member.id}
                                        className="border-border/60 transition-colors duration-normal hover:bg-muted/40"
                                    >
                                        <TableCell className="px-4 py-3">
                                            <div className="min-w-0 space-y-0.5">
                                                <div className="truncate font-medium">
                                                    {member.user?.name || 'Unknown user'}
                                                </div>
                                                <div className="truncate text-xs text-muted-foreground">
                                                    {member.user?.email || member.userId}
                                                </div>
                                                <code className="text-[0.6875rem] text-muted-foreground">
                                                    {member.userId}
                                                </code>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <Select
                                                value={member.role}
                                                onValueChange={(value: MemberRole) =>
                                                    handleQuickRoleChange(member.userId, value)
                                                }
                                                disabled={
                                                    updateRoleMutation.isPending || updateStatusMutation.isPending
                                                }
                                            >
                                                <SelectTrigger className="h-9 w-32">
                                                    <span className="capitalize">{member.role}</span>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="owner">Owner</SelectItem>
                                                    <SelectItem value="admin">Admin</SelectItem>
                                                    <SelectItem value="member">Member</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <Select
                                                value={member.status}
                                                onValueChange={(value: 'active' | 'invited' | 'suspended') =>
                                                    handleQuickStatusChange(member.userId, value)
                                                }
                                                disabled={
                                                    updateRoleMutation.isPending || updateStatusMutation.isPending
                                                }
                                            >
                                                <SelectTrigger className="h-9 w-36">
                                                    <span className="capitalize">{member.status}</span>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="active">Active</SelectItem>
                                                    <SelectItem value="invited">Invited</SelectItem>
                                                    <SelectItem value="suspended">Suspended</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                            {member.invitedAt ? new Date(member.invitedAt).toLocaleDateString() : '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                            {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-foreground"
                                                    onClick={() => handleEdit(member)}
                                                    disabled={
                                                        updateRoleMutation.isPending ||
                                                        updateStatusMutation.isPending ||
                                                        updateMemberMutation.isPending
                                                    }
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleDelete(member.userId)}
                                                    disabled={removeMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {!isLoading && pagination && pagination.total > pagination.perPage && (
                <div className="flex items-center justify-between">
                    <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Showing {(pagination.page - 1) * pagination.perPage + 1}–
                        {Math.min(pagination.page * pagination.perPage, pagination.total)} of {pagination.total} members
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={pagination.page <= 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Prev
                        </Button>
                        <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => setCurrentPage((p) => p + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                        >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Invite/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingMember ? 'Edit Member' : 'Invite Member'}</DialogTitle>
                        <DialogDescription>
                            {editingMember
                                ? 'Update member role and status'
                                : 'Invite a new member to this organization'}
                        </DialogDescription>
                    </DialogHeader>
                    <InviteMemberForm
                        organizationId={organizationId}
                        editingMember={editingMember}
                        onSubmit={handleSubmit}
                        onCancel={() => setIsDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
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
        </div>
    );
}
