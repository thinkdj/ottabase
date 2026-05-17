import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
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
import { Link, useParams } from '@tanstack/react-router';
import { useSetAtom } from 'jotai';
import { ChevronLeft, ChevronRight, Edit, RefreshCw, Trash2, UserPlus } from 'lucide-react';
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

    const handleDelete = async (memberId: string) => {
        setDeleteDialog(memberId);
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;

        const memberId = deleteDialog;
        removeMutation.mutate(
            { userId: memberId, organizationId },
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
    const handleQuickRoleChange = async (memberId: string, newRole: MemberRole) => {
        updateRoleMutation.mutate(
            { userId: memberId, role: newRole, organizationId },
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

    const handleQuickStatusChange = async (memberId: string, newStatus: 'active' | 'invited' | 'suspended') => {
        updateStatusMutation.mutate(
            { userId: memberId, status: newStatus, organizationId },
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
                    userId: editingMember.id,
                    role: data.role,
                    status: data.status,
                });
                toast.rbac.memberUpdated();
            } else {
                await inviteMutation.mutateAsync({
                    userId: data.userId,
                    invitedEmail: data.invitedEmail,
                    role: data.role,
                    status: data.status,
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
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Organization Members</CardTitle>
                            <CardDescription>Manage members and their roles</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex items-center text-xs text-muted-foreground pr-1">
                                {lastRefreshedLabel}
                            </div>
                            <Button variant="outline" onClick={handleRefresh} disabled={isLoading || isRefetching}>
                                <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button variant="outline" asChild>
                                <Link to={'/admin/access/organizations' as never}>← Back to Organizations</Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <Link
                                    to={'/admin/access/organizations/$organizationId/groups' as never}
                                    params={{ organizationId } as never}
                                >
                                    Groups
                                </Link>
                            </Button>
                            <Button onClick={handleInvite} className="gap-2">
                                <UserPlus className="h-4 w-4" />
                                Invite Member
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <ApiErrorDisplay
                            error={error instanceof Error ? error : new Error('Failed to load members')}
                            onRetry={() => refetch()}
                            className="mb-4"
                        />
                    )}

                    {isLoading ? (
                        <TableSkeleton rows={5} columns={6} />
                    ) : members.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No members found. Invite the first member!
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
                                {members.map((member) => (
                                    <TableRow key={member.id}>
                                        <TableCell>
                                            <div className="min-w-0 space-y-0.5">
                                                <div className="truncate font-medium">
                                                    {member.user?.name || member.invitedEmail || 'Unknown user'}
                                                </div>
                                                <div className="truncate text-xs text-muted-foreground">
                                                    {member.user?.email || member.invitedEmail || member.userId}
                                                </div>
                                                {member.userId && (
                                                    <code className="text-[11px] text-muted-foreground">
                                                        {member.userId}
                                                    </code>
                                                )}
                                                {!member.userId && (
                                                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                                        pending invite
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={member.role}
                                                onValueChange={(value: MemberRole) =>
                                                    handleQuickRoleChange(member.id, value)
                                                }
                                                disabled={
                                                    updateRoleMutation.isPending || updateStatusMutation.isPending
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
                                                    handleQuickStatusChange(member.id, value)
                                                }
                                                disabled={
                                                    updateRoleMutation.isPending || updateStatusMutation.isPending
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
                                            {member.invitedAt ? new Date(member.invitedAt).toLocaleDateString() : '-'}
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
                                                    onClick={() => handleDelete(member.id)}
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
                    )}
                </CardContent>
            </Card>

            {/* Pagination Controls */}
            {!isLoading && pagination && pagination.total > pagination.perPage && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Showing {(pagination.page - 1) * pagination.perPage + 1}–
                        {Math.min(pagination.page * pagination.perPage, pagination.total)} of {pagination.total} members
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={pagination.page <= 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Prev
                        </Button>
                        <span className="text-sm text-muted-foreground">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
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
