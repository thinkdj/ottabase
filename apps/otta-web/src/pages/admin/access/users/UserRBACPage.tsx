/**
 * User RBAC Assignment Page
 *
 * Assign users to organizations with roles
 * GitHub-like minimal UI with dark mode support
 *
 * Membership data uses GET /api/admin/users/:id (includes memberships).
 * Mutations use /api/admin/organizations/:orgId/members/* (last-owner guards).
 */

import { TableSkeleton } from '@/components/LoadingSkeletons';
import { useInviteMember, usePlatformOrganizations, useRemoveMember, useUpdateMemberRole } from '@/hooks/useRBAC';
import { useRBACToast } from '@/hooks/useToast';
import type { BadgeVariant, MemberRole, OrganizationMemberRecord } from '@/types/rbac';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
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
    DialogTrigger,
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
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { Building2, Loader2, Plus, Shield, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface AdminUserDetailResponse {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    memberships?: OrganizationMemberRecord[];
}

interface UserOrganization {
    organizationId: string;
    organizationName: string;
    role: MemberRole;
    joinedAt: string;
}

export function UserRBACPage() {
    const { userId } = useParams({ from: '/admin/access/users/$userId/rbac' });
    const toast = useRBACToast();
    const queryClient = useQueryClient();
    const { data: orgs = [] } = usePlatformOrganizations();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState('');
    const [selectedRole, setSelectedRole] = useState<MemberRole>('member');
    const [removeMembership, setRemoveMembership] = useState<{ organizationId: string; orgName: string } | null>(null);

    const userDetailQueryKey = ['users', 'admin', userId] as const;

    const { data: userDetail, isLoading: isUserLoading } = useApiQuery<
        { data: AdminUserDetailResponse },
        AdminUserDetailResponse
    >({
        entity: 'users',
        queryKey: ['admin', userId],
        endpoint: `/api/admin/users/${userId}`,
        transform: (r) => ({
            id: r.data.id,
            name: r.data.name,
            email: r.data.email,
            image: r.data.image,
            memberships: r.data.memberships ?? [],
        }),
        queryOptions: { enabled: !!userId },
    });

    const rawMemberships = userDetail?.memberships ?? [];

    const userOrgs: UserOrganization[] = rawMemberships.map((m) => {
        const org = orgs.find((o) => o.id === m.organizationId);
        return {
            organizationId: m.organizationId,
            organizationName: org?.name || m.organizationId,
            role: m.role,
            joinedAt: typeof m.joinedAt === 'string' ? m.joinedAt : String(m.joinedAt ?? ''),
        };
    });

    const isLoading = isUserLoading;

    const availableOrgs = orgs.filter((org) => !userOrgs.some((uo) => uo.organizationId === org.id));

    const getRoleBadgeVariant = (role: MemberRole): BadgeVariant => {
        switch (role) {
            case 'owner':
                return 'default';
            case 'admin':
                return 'secondary';
            default:
                return 'outline';
        }
    };

    const inviteMutation = useInviteMember();
    const removeMutation = useRemoveMember();
    const updateRoleMutation = useUpdateMemberRole();

    const invalidateUserDetail = () => {
        void queryClient.invalidateQueries({ queryKey: userDetailQueryKey });
    };

    const handleAddToOrg = () => {
        if (!selectedOrg) {
            toast.error('Validation error', 'Please select an organization');
            return;
        }
        inviteMutation.mutate(
            {
                organizationId: selectedOrg,
                userId,
                role: selectedRole,
                status: 'active',
            },
            {
                onSuccess: () => {
                    toast.rbac.memberInvited();
                    setIsDialogOpen(false);
                    setSelectedOrg('');
                    setSelectedRole('member');
                    invalidateUserDetail();
                },
                onError: (err) =>
                    toast.error(
                        'Failed to add',
                        err instanceof Error ? err.message : 'Could not add user to organization',
                    ),
            },
        );
    };

    const handleRemove = (organizationId: string, orgName: string) => {
        setRemoveMembership({ organizationId, orgName });
    };

    const handleConfirmRemove = () => {
        if (!removeMembership) return;
        removeMutation.mutate(
            { userId, organizationId: removeMembership.organizationId },
            {
                onSuccess: () => {
                    toast.rbac.memberRemoved();
                    setRemoveMembership(null);
                    invalidateUserDetail();
                },
                onError: (err) =>
                    toast.error(
                        'Failed to remove',
                        err instanceof Error ? err.message : 'Could not remove user from organization',
                    ),
            },
        );
    };

    const handleRoleChange = (organizationId: string, newRole: MemberRole) => {
        updateRoleMutation.mutate(
            { userId, role: newRole, organizationId },
            {
                onSuccess: () => {
                    toast.rbac.memberUpdated();
                    invalidateUserDetail();
                },
                onError: (err) =>
                    toast.error('Failed to update role', err instanceof Error ? err.message : 'Could not update role'),
            },
        );
    };

    const displayUser = userDetail || { id: userId, name: null, email: '', image: null };
    const userInitials = displayUser.name
        ? displayUser.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
        : (displayUser.email?.[0] || '?').toUpperCase();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Shield className="h-6 w-6" />
                        User Access Control
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage organization memberships and roles for this user
                    </p>
                </div>
                <Button variant="outline" asChild>
                    <Link to="/admin/access/users">← Back to Users</Link>
                </Button>
            </div>

            {/* User Info */}
            <Card>
                <CardHeader>
                    <CardTitle>User Profile</CardTitle>
                </CardHeader>
                <CardContent>
                    {isUserLoading ? (
                        <TableSkeleton rows={1} columns={3} />
                    ) : (
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16">
                                <AvatarImage src={displayUser.image || undefined} />
                                <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h3 className="font-semibold text-lg">{displayUser.name || 'No name'}</h3>
                                <p className="text-sm text-muted-foreground">{displayUser.email || '—'}</p>
                                <code className="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block">
                                    {displayUser.id}
                                </code>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Organizations */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Organization Memberships</CardTitle>
                            <CardDescription>Organizations this user has access to</CardDescription>
                        </div>
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Add to Organization
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Add to Organization</DialogTitle>
                                    <DialogDescription>Grant this user access to an organization</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="org">Organization</Label>
                                        <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                                            <SelectTrigger id="org">
                                                <SelectValue placeholder="Select organization" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableOrgs.length === 0 ? (
                                                    <div className="p-2 text-sm text-muted-foreground text-center">
                                                        No available organizations
                                                    </div>
                                                ) : (
                                                    availableOrgs.map((org) => (
                                                        <SelectItem key={org.id} value={org.id}>
                                                            {org.name}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="role">Role</Label>
                                        <Select
                                            value={selectedRole}
                                            onValueChange={(value) => setSelectedRole(value as MemberRole)}
                                        >
                                            <SelectTrigger id="role">
                                                <SelectValue />
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
                                                <SelectItem value="viewer">
                                                    <Badge variant="outline">Viewer</Badge>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button
                                        onClick={handleAddToOrg}
                                        disabled={inviteMutation.isPending || !selectedOrg}
                                        className="w-full"
                                    >
                                        {inviteMutation.isPending ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Adding...
                                            </>
                                        ) : (
                                            'Add to Organization'
                                        )}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <TableSkeleton rows={3} columns={4} />
                    ) : userOrgs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            User is not a member of any organizations
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Organization</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Joined</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {userOrgs.map((membership) => (
                                    <TableRow key={membership.organizationId}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{membership.organizationName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={membership.role}
                                                onValueChange={(value) =>
                                                    handleRoleChange(membership.organizationId, value as MemberRole)
                                                }
                                                disabled={updateRoleMutation.isPending}
                                            >
                                                <SelectTrigger className="w-32">
                                                    <Badge variant={getRoleBadgeVariant(membership.role)}>
                                                        {membership.role}
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
                                                    <SelectItem value="viewer">
                                                        <Badge variant="outline">Viewer</Badge>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {membership.joinedAt
                                                ? new Date(membership.joinedAt).toLocaleDateString()
                                                : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleRemove(membership.organizationId, membership.organizationName)
                                                }
                                                disabled={removeMutation.isPending}
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

            <ConfirmDialog
                open={removeMembership !== null}
                onOpenChange={(open) => !open && setRemoveMembership(null)}
                title="Remove from Organization?"
                description={`Remove this user from ${removeMembership?.orgName ?? 'the organization'}? They will lose access to all resources in this organization.`}
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText={removeMutation.isPending ? 'Removing…' : 'Remove'}
                onConfirm={handleConfirmRemove}
                confirmProps={{ disabled: removeMutation.isPending }}
                cancelProps={{ disabled: removeMutation.isPending }}
            />
        </div>
    );
}
