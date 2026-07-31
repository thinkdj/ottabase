/**
 * User RBAC Assignment Page
 *
 * Assign users to organizations with roles
 *
 * Membership data uses GET /api/admin/users/:id (includes memberships).
 * Mutations use /api/admin/organizations/:orgId/members/* (last-owner guards).
 */

import { useInviteMember, useOrganizations, useRemoveMember, useUpdateMemberRole } from '@/hooks/useRBAC';
import { useRBACToast } from '@/hooks/useToast';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Label,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import type { MemberRole, OrganizationMemberRecord } from '@/types/rbac';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Building2, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

const CHIP_CLASS =
    'rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border';
const TH_CLASS = 'px-4 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';

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
    joinedAt: string | number | null;
}

/**
 * Membership timestamps come from BaseModel.toJson(), which serializes Date fields to epoch-ms
 * NUMBERS — so `joinedAt` arrives as a number (or, from some callers, a numeric string).
 * `new Date('1780639598433')` parses a digit-string as a *date string* → "Invalid Date", so
 * coerce all-digit values to a number before constructing the Date.
 */
function formatJoinedDate(value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '-';
    const ms = typeof value === 'number' ? value : /^-?\d+$/.test(value.trim()) ? Number(value) : Date.parse(value);
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
}

export function UserRBACPage() {
    const { userId } = useParams({ from: '/admin/access/users/$userId/rbac' });
    const toast = useRBACToast();
    const queryClient = useQueryClient();
    const { data: orgs = [] } = useOrganizations();

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
        select: (r) => ({
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
            // Keep the raw value (toJson() gives epoch-ms numbers) — do NOT stringify it, or
            // `new Date('<digits>')` below would yield "Invalid Date".
            joinedAt: m.joinedAt ?? null,
        };
    });

    const isLoading = isUserLoading;

    const availableOrgs = orgs.filter((org) => !userOrgs.some((uo) => uo.organizationId === org.id));

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
        <div className="space-y-8">
            {/* Header */}
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to="/admin/access/users">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Users
                    </Link>
                </Button>

                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">User Access Control</h1>
                    <p className="max-w-3xl text-muted-foreground">
                        Manage organization memberships and roles for this user
                    </p>
                </div>
            </div>

            {/* User Info */}
            <section className="rounded-xl bg-muted/40 p-6">
                <p className="mb-4 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                    User Profile
                </p>
                {isUserLoading ? (
                    <div className="flex items-center gap-4" aria-busy="true">
                        <span className="sr-only">Loading user profile…</span>
                        <div className="h-16 w-16 animate-pulse rounded-full bg-muted/70" />
                        <div className="space-y-2">
                            <div className="h-4 w-40 animate-pulse rounded-lg bg-muted/70" />
                            <div className="h-3 w-56 animate-pulse rounded-lg bg-muted/70" />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 ring-1 ring-border">
                            <AvatarImage src={displayUser.image || undefined} />
                            <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h2 className="text-[0.9375rem] font-semibold">{displayUser.name || 'No name'}</h2>
                            <p className="text-sm text-muted-foreground">{displayUser.email || '—'}</p>
                            <code className="mt-1 inline-block rounded bg-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground ring-1 ring-border">
                                {displayUser.id}
                            </code>
                        </div>
                    </div>
                )}
            </section>

            {/* Organizations */}
            <section className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <h2 className="text-[0.9375rem] font-semibold">Organization Memberships</h2>
                        <p className="text-sm text-muted-foreground">Organizations this user has access to</p>
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
                                                <div className="p-2 text-center text-sm text-muted-foreground">
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
                                                <Badge variant="outline" className={CHIP_CLASS}>
                                                    Owner
                                                </Badge>
                                            </SelectItem>
                                            <SelectItem value="admin">
                                                <Badge variant="outline" className={CHIP_CLASS}>
                                                    Admin
                                                </Badge>
                                            </SelectItem>
                                            <SelectItem value="member">
                                                <Badge variant="outline" className={CHIP_CLASS}>
                                                    Member
                                                </Badge>
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

                {isLoading ? (
                    <div className="space-y-3" aria-busy="true">
                        <span className="sr-only">Loading memberships…</span>
                        {Array.from({ length: 3 }, (_, index) => (
                            <div key={index} className="h-12 animate-pulse rounded-xl bg-muted/40" />
                        ))}
                    </div>
                ) : userOrgs.length === 0 ? (
                    <div className="rounded-xl bg-muted/40 py-12 text-center">
                        <p className="text-sm text-muted-foreground">User is not a member of any organizations</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border/60">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="border-border/60 hover:bg-transparent">
                                    <TableHead className={TH_CLASS}>Organization</TableHead>
                                    <TableHead className={TH_CLASS}>Role</TableHead>
                                    <TableHead className={TH_CLASS}>Joined</TableHead>
                                    <TableHead className={`${TH_CLASS} text-right`}>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {userOrgs.map((membership) => (
                                    <TableRow
                                        key={membership.organizationId}
                                        className="border-border/60 transition-colors duration-normal hover:bg-muted/40"
                                    >
                                        <TableCell className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{membership.organizationName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <Select
                                                value={membership.role}
                                                onValueChange={(value) =>
                                                    handleRoleChange(membership.organizationId, value as MemberRole)
                                                }
                                                disabled={updateRoleMutation.isPending}
                                            >
                                                <SelectTrigger className="h-9 w-32">
                                                    <Badge variant="outline" className={CHIP_CLASS}>
                                                        {membership.role}
                                                    </Badge>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="owner">
                                                        <Badge variant="outline" className={CHIP_CLASS}>
                                                            Owner
                                                        </Badge>
                                                    </SelectItem>
                                                    <SelectItem value="admin">
                                                        <Badge variant="outline" className={CHIP_CLASS}>
                                                            Admin
                                                        </Badge>
                                                    </SelectItem>
                                                    <SelectItem value="member">
                                                        <Badge variant="outline" className={CHIP_CLASS}>
                                                            Member
                                                        </Badge>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                                            {formatJoinedDate(membership.joinedAt)}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-destructive"
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
                    </div>
                )}
            </section>

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
