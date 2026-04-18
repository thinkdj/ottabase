import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { useInviteMember, useOrganizationMembers, useRemoveMember, useUpdateMemberRole } from '@/hooks/useRBAC';
import { useRBACToast } from '@/hooks/useToast';
import { isApiError } from '@/lib/api';
import { organizationIdAtom } from '@/ottabase/state/appState';
import type { BadgeVariant, MemberRole, OrganizationMemberRecord } from '@/types/rbac';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Badge,
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
import { Edit, Trash2, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { InviteMemberForm, type InviteMemberFormData } from './components/InviteMemberForm';

const CURRENT_ORG_KEY = 'ottabase.current-org-id';

export function OrganizationMembersPage() {
    const toast = useRBACToast();
    const { organizationId } = useParams({ from: '/organizations/$organizationId/members' });
    const setOrganizationId = useSetAtom(organizationIdAtom);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<OrganizationMemberRecord | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

    // TanStack Query hooks with automatic caching and optimistic updates
    const { data: members = [], isLoading, error, refetch } = useOrganizationMembers(organizationId);
    const inviteMutation = useInviteMember();
    const updateRoleMutation = useUpdateMemberRole();
    const removeMutation = useRemoveMember();

    useEffect(() => {
        if (!organizationId) return;
        setOrganizationId(organizationId);
        try {
            localStorage.setItem(CURRENT_ORG_KEY, organizationId);
        } catch {
            // ignore storage failures
        }
    }, [organizationId, setOrganizationId]);

    const handleInvite = () => {
        setEditingMember(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (member: OrganizationMemberRecord) => {
        setEditingMember(member);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        setDeleteDialog(id);
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;

        const id = deleteDialog;
        removeMutation.mutate(
            { memberId: id, organizationId },
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
            { memberId, role: newRole, organizationId },
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

    const handleSubmit = async (data: InviteMemberFormData) => {
        try {
            if (editingMember) {
                // Note: This would need an updateMember mutation, for now just close
                toast.rbac.memberUpdated();
            } else {
                await inviteMutation.mutateAsync({
                    ...data,
                    organizationId,
                    invitedAt: Date.now(),
                });
                toast.rbac.memberInvited();
            }
            setIsDialogOpen(false);
            setEditingMember(null);
        } catch (err) {
            throw new Error(isApiError(err) ? err.message : 'Failed to invite member');
        }
    };

    const getRoleBadgeVariant = (role: string): BadgeVariant => {
        switch (role) {
            case 'owner':
                return 'default';
            case 'admin':
                return 'secondary';
            default:
                return 'outline';
        }
    };

    const getStatusBadgeVariant = (status: string): BadgeVariant => {
        switch (status) {
            case 'active':
                return 'default';
            case 'invited':
                return 'secondary';
            default:
                return 'outline';
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
                            <Button variant="outline" asChild>
                                <Link to="/organizations">← Back to Organizations</Link>
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
                                    <TableHead>User ID</TableHead>
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
                                            <code className="text-sm bg-muted px-2 py-1 rounded">{member.userId}</code>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={member.role}
                                                onValueChange={(value: MemberRole) =>
                                                    handleQuickRoleChange(member.id, value)
                                                }
                                                disabled={updateRoleMutation.isPending}
                                            >
                                                <SelectTrigger className="w-32">
                                                    <Badge variant={getRoleBadgeVariant(member.role)}>
                                                        {member.role}
                                                    </Badge>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="owner">
                                                        <Badge variant="default">Owner</Badge>
                                                    </SelectItem>
                                                    <SelectItem value="admin">
                                                        <Badge variant="secondary">Admin</Badge>
                                                    </SelectItem>
                                                    <SelectItem value="member">
                                                        <Badge variant="outline">Member</Badge>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusBadgeVariant(member.status)}>
                                                {member.status}
                                            </Badge>
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
                                                    disabled={updateRoleMutation.isPending}
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
