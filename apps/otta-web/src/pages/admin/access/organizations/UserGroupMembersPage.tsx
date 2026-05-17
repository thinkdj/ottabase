import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import {
    useAddGroupMember,
    useRemoveGroupMember,
    useUpdateGroupMember,
    useUserGroup,
    useUserGroupMembers,
} from '@/hooks/useUserGroups';
import { useRBACToast } from '@/hooks/useToast';
import type { InviteGroupMemberInput, UserGroupMemberRecord } from '@/types/rbac';
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
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { ChevronLeft, Edit, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { searchInvitableUsers, type InviteMemberFormData } from './components/InviteMemberForm';
import { OttaSelect, type ItemRendererProps, type OttaSelectItem } from '@ottabase/ottaselect';
import { Avatar, AvatarFallback, AvatarImage } from '@ottabase/ui-shadcn';

// ─── Inline user option renderer (same as InviteMemberForm) ──────────────────

interface InvitableUserOption extends OttaSelectItem {
    email?: string;
    image?: string | null;
}

function getUserInitials(item: { name: string; email?: string }): string {
    const base = item.name || item.email || '?';
    return (
        base
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() || '')
            .join('') || '?'
    );
}

function UserOptionRow({ item }: ItemRendererProps) {
    const option = item as InvitableUserOption;
    return (
        <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
                <AvatarImage src={option.image || undefined} alt={option.name} />
                <AvatarFallback>{getUserInitials(option)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <div className="truncate text-sm font-medium">{option.name}</div>
                <div className="truncate text-xs text-muted-foreground">{option.email || option.id}</div>
            </div>
        </div>
    );
}

// ─── Add member form ──────────────────────────────────────────────────────────

function AddMemberForm({
    onSubmit,
    onCancel,
    loading,
}: {
    onSubmit: (data: InviteGroupMemberInput) => Promise<void>;
    onCancel: () => void;
    loading: boolean;
}) {
    const [inviteMode, setInviteMode] = useState<'user' | 'email'>('user');
    const [selectedUser, setSelectedUser] = useState<InvitableUserOption | null>(null);
    const [emailInput, setEmailInput] = useState('');
    const [role, setRole] = useState('member');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const hasIdentity =
            (inviteMode === 'user' && !!selectedUser) || (inviteMode === 'email' && !!emailInput.trim());
        if (!hasIdentity) return;

        await onSubmit({
            userId: inviteMode === 'user' ? selectedUser?.id : undefined,
            invitedEmail: inviteMode === 'email' ? emailInput.trim() : undefined,
            role,
        });
    };

    const isDisabled =
        loading || (inviteMode === 'user' && !selectedUser) || (inviteMode === 'email' && !emailInput.trim());

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Invite mode toggle */}
            <div className="flex rounded-md border overflow-hidden">
                <button
                    type="button"
                    onClick={() => {
                        setInviteMode('user');
                        setEmailInput('');
                    }}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                        inviteMode === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                >
                    Existing User
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setInviteMode('email');
                        setSelectedUser(null);
                    }}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                        inviteMode === 'email'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                >
                    Email Invite
                </button>
            </div>

            {inviteMode === 'user' ? (
                <div className="space-y-2">
                    <Label>User*</Label>
                    <OttaSelect
                        mode="single"
                        value={selectedUser}
                        onChange={(value) => setSelectedUser(value as InvitableUserOption | null)}
                        fetchCollection={(query) => searchInvitableUsers(query)}
                        placeholder="Search by name, email, or user ID"
                        searchPlaceholder="Type at least 2 characters..."
                        loadingMessage="Searching users..."
                        emptyMessage="No matching users found"
                        renderItem={UserOptionRow}
                        renderValue={(item) => {
                            const option = item as InvitableUserOption;
                            return (
                                <span className="flex min-w-0 flex-col text-left leading-tight">
                                    <span className="truncate text-sm font-medium">{option.name}</span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {option.email || option.id}
                                    </span>
                                </span>
                            );
                        }}
                        className="w-full"
                        disabled={loading}
                    />
                </div>
            ) : (
                <div className="space-y-2">
                    <Label htmlFor="member-email">Email address*</Label>
                    <Input
                        id="member-email"
                        type="email"
                        placeholder="member@example.com"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        disabled={loading}
                        autoComplete="email"
                    />
                </div>
            )}

            <div className="space-y-2">
                <Label htmlFor="member-role">Role</Label>
                <Select value={role} onValueChange={setRole}>
                    <SelectTrigger id="member-role">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isDisabled}>
                    {loading ? 'Adding...' : 'Add Member'}
                </Button>
            </div>
        </form>
    );
}

// ─── Status badge helper ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const variant = status === 'active' ? 'default' : status === 'invited' ? 'secondary' : 'destructive';
    return (
        <Badge variant={variant as 'default' | 'secondary' | 'destructive'} className="capitalize">
            {status}
        </Badge>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function UserGroupMembersPage() {
    const toast = useRBACToast();
    const { organizationId = '', groupId = '' } = useParams({ strict: false }) as {
        organizationId?: string;
        groupId?: string;
    };

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
    const [addLoading, setAddLoading] = useState(false);

    const { data: group, isLoading: groupLoading } = useUserGroup(groupId);
    const { data: members = [], isLoading: membersLoading, error, refetch } = useUserGroupMembers(groupId);

    const addMemberMutation = useAddGroupMember(groupId);
    const removeMemberMutation = useRemoveGroupMember();

    const isLoading = groupLoading || membersLoading;

    const handleAdd = () => setIsDialogOpen(true);

    const handleConfirmDelete = () => {
        if (!deleteDialog) return;
        removeMemberMutation.mutate(deleteDialog, {
            onSuccess: () => {
                toast.success('Member removed');
                setDeleteDialog(null);
            },
            onError: (err) => {
                toast.error('Failed to remove member', err instanceof Error ? err.message : 'Unknown error');
            },
        });
    };

    const handleAddSubmit = async (data: InviteGroupMemberInput) => {
        setAddLoading(true);
        try {
            await addMemberMutation.mutateAsync({ ...data, organizationId });
            toast.success('Member added');
            setIsDialogOpen(false);
        } catch (err) {
            toast.error('Failed to add member', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setAddLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>{group?.name ?? 'Group'} — Members</CardTitle>
                            <CardDescription>Manage who belongs to this group.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" asChild>
                                <Link
                                    to={'/admin/access/organizations/$organizationId/groups' as never}
                                    params={{ organizationId } as never}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" />
                                    Back to Groups
                                </Link>
                            </Button>
                            <Button onClick={handleAdd} className="gap-2">
                                <UserPlus className="h-4 w-4" />
                                Add Member
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
                        <TableSkeleton rows={4} columns={5} />
                    ) : members.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No members in this group yet.{' '}
                            <button className="underline underline-offset-2 hover:text-foreground" onClick={handleAdd}>
                                Add the first member.
                            </button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
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
                                                    {member.user?.name || member.invitedEmail || 'Unknown'}
                                                </div>
                                                <div className="truncate text-xs text-muted-foreground">
                                                    {member.user?.email || member.invitedEmail || member.userId}
                                                </div>
                                                {!member.userId && (
                                                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                                                        pending invite
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="capitalize text-sm">{member.role}</span>
                                        </TableCell>
                                        <TableCell>
                                            <StatusBadge status={member.status} />
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setDeleteDialog(member.id)}
                                                disabled={removeMemberMutation.isPending}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Add Member Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add Member</DialogTitle>
                        <DialogDescription>
                            Add an existing user or send an email invite to this group.
                        </DialogDescription>
                    </DialogHeader>
                    <AddMemberForm
                        onSubmit={handleAddSubmit}
                        onCancel={() => setIsDialogOpen(false)}
                        loading={addLoading}
                    />
                </DialogContent>
            </Dialog>

            {/* Remove Confirmation */}
            <ConfirmDialog
                open={!!deleteDialog}
                onOpenChange={(open) => !open && setDeleteDialog(null)}
                title="Remove Member?"
                description="This will remove the member from this group."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Remove"
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
