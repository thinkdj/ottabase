import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { useRBACToast } from '@/hooks/useToast';
import { api } from '@/lib/api';
import { organizationIdAtom } from '@/ottabase/state/appState';
import type { OrganizationMemberRecord, RoleRecord } from '@/types/rbac';
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
    SelectValue,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { useAtomValue } from 'jotai';
import { Plus, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface UserRoleAssignment {
    userId: string;
    roleId: string;
    roleName: string | null;
    roleDescription: string | null;
    isSystemRole: boolean;
    organizationId: string;
    assignedAt: string | null;
    assignedBy: string | null;
    assignedByName: string | null;
}

const DEFAULT_SYSTEM_ROLE_NAMES = new Set(['owner', 'admin', 'member', 'viewer']);

/**
 * Shows non-membership role assignments. Membership roles (owner/admin/member/
 * viewer) are managed on the Organization Members page and reflected in the
 * `organization_members.role` column; we hide them here to avoid duplication.
 */
function visibleCustomRoles(assignments: UserRoleAssignment[]): UserRoleAssignment[] {
    return assignments.filter((a) => !a.roleName || !DEFAULT_SYSTEM_ROLE_NAMES.has(a.roleName));
}

export function UserRolesPage() {
    const toast = useRBACToast();
    const organizationId = useAtomValue(organizationIdAtom);

    const [members, setMembers] = useState<OrganizationMemberRecord[]>([]);
    const [roles, setRoles] = useState<RoleRecord[]>([]);
    const [assignmentsByUser, setAssignmentsByUser] = useState<Record<string, UserRoleAssignment[]>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const [assignDialogUserId, setAssignDialogUserId] = useState<string | null>(null);
    const [selectedRoleId, setSelectedRoleId] = useState<string>('');
    const [assigning, setAssigning] = useState(false);
    const [removeDialog, setRemoveDialog] = useState<{ userId: string; roleId: string; roleName: string } | null>(null);

    const fetchData = useCallback(async () => {
        if (!organizationId) return;

        try {
            setLoading(true);
            setError(null);

            const [memberRes, rolesRes] = await Promise.all([
                api<{ data: OrganizationMemberRecord[] }>(`/api/admin/organization/members?page=1&per_page=100`),
                api<{ data: RoleRecord[] }>(`/api/rbac/roles`),
            ]);

            const memberList = memberRes.data ?? [];
            setMembers(memberList);
            setRoles(rolesRes.data ?? []);

            const assignments = await Promise.all(
                memberList.map(async (m) => {
                    const res = await api<{ data: UserRoleAssignment[] }>(
                        `/api/rbac/user-roles?userId=${encodeURIComponent(m.userId)}`,
                    );
                    return [m.userId, res.data ?? []] as const;
                }),
            );
            setAssignmentsByUser(Object.fromEntries(assignments));
        } catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load user roles'));
        } finally {
            setLoading(false);
        }
    }, [organizationId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const assignableRoles = useMemo(() => roles.filter((r) => !DEFAULT_SYSTEM_ROLE_NAMES.has(r.name)), [roles]);

    const alreadyAssignedRoleIds = useMemo(() => {
        if (!assignDialogUserId) return new Set<string>();
        return new Set((assignmentsByUser[assignDialogUserId] ?? []).map((a) => a.roleId));
    }, [assignDialogUserId, assignmentsByUser]);

    const handleOpenAssign = (userId: string) => {
        setAssignDialogUserId(userId);
        setSelectedRoleId('');
    };

    const handleAssign = async () => {
        if (!assignDialogUserId || !selectedRoleId) return;
        try {
            setAssigning(true);
            await api('/api/rbac/user-roles', {
                method: 'POST',
                body: { userId: assignDialogUserId, roleId: selectedRoleId },
            });
            toast.rbac.permissionGranted();
            setAssignDialogUserId(null);
            await fetchData();
        } catch (err) {
            toast.error('Failed to assign role', err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setAssigning(false);
        }
    };

    const handleConfirmRemove = async () => {
        if (!removeDialog) return;
        try {
            await api(
                `/api/rbac/user-roles/${encodeURIComponent(removeDialog.userId)}/${encodeURIComponent(removeDialog.roleId)}`,
                { method: 'DELETE' },
            );
            toast.rbac.permissionRevoked();
            setRemoveDialog(null);
            await fetchData();
        } catch (err) {
            toast.error('Failed to revoke role', err instanceof Error ? err.message : 'Unknown error');
        }
    };

    if (!organizationId) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                    Select an organization to manage user role assignments.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                User Roles
                            </CardTitle>
                            <CardDescription>
                                Assign custom roles to members beyond their organization-membership role.
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" asChild>
                                <Link to="/admin/access/rbac/roles">Manage Roles</Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <Link to="/admin/access/rbac">← Back to RBAC</Link>
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <ApiErrorDisplay
                            error={error}
                            onRetry={fetchData}
                            onDismiss={() => setError(null)}
                            className="mb-4"
                        />
                    )}

                    {loading && members.length === 0 ? (
                        <TableSkeleton rows={5} columns={4} />
                    ) : members.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No members in this organization yet.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Membership</TableHead>
                                    <TableHead>Custom Roles</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {members.map((member) => {
                                    const assignments = visibleCustomRoles(assignmentsByUser[member.userId] ?? []);
                                    return (
                                        <TableRow key={member.userId}>
                                            <TableCell>
                                                <div className="font-medium">
                                                    {member.user?.name || member.user?.email || member.userId}
                                                </div>
                                                {member.user?.email && (
                                                    <div className="text-xs text-muted-foreground">
                                                        {member.user.email}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="capitalize">
                                                    {member.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {assignments.length === 0 ? (
                                                    <span className="text-sm text-muted-foreground">—</span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {assignments.map((a) => (
                                                            <Badge
                                                                key={a.roleId}
                                                                variant="outline"
                                                                className="gap-1 pr-1"
                                                            >
                                                                {a.roleName || a.roleId}
                                                                <button
                                                                    type="button"
                                                                    aria-label={`Remove ${a.roleName || a.roleId}`}
                                                                    onClick={() =>
                                                                        setRemoveDialog({
                                                                            userId: a.userId,
                                                                            roleId: a.roleId,
                                                                            roleName: a.roleName || a.roleId,
                                                                        })
                                                                    }
                                                                    className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-1"
                                                    onClick={() => handleOpenAssign(member.userId)}
                                                    disabled={assignableRoles.length === 0}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                    Assign
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!assignDialogUserId} onOpenChange={(open) => !open && setAssignDialogUserId(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Assign Role</DialogTitle>
                        <DialogDescription>
                            Grant an additional custom role to this member. They keep their organization-membership role
                            alongside it.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                {assignableRoles.map((role) => {
                                    const alreadyAssigned = alreadyAssignedRoleIds.has(role.id);
                                    return (
                                        <SelectItem key={role.id} value={role.id} disabled={alreadyAssigned}>
                                            <span className="font-mono text-sm">{role.name}</span>
                                            {alreadyAssigned && (
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    (already assigned)
                                                </span>
                                            )}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                        {assignableRoles.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                                No custom roles exist yet.{' '}
                                <Link to="/admin/access/rbac/roles" className="underline">
                                    Create one
                                </Link>
                                .
                            </p>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button variant="outline" onClick={() => setAssignDialogUserId(null)} disabled={assigning}>
                            Cancel
                        </Button>
                        <Button onClick={handleAssign} disabled={!selectedRoleId || assigning}>
                            {assigning ? 'Assigning…' : 'Assign Role'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!removeDialog}
                onOpenChange={(open) => !open && setRemoveDialog(null)}
                title="Remove role assignment?"
                description={
                    removeDialog
                        ? `Remove the "${removeDialog.roleName}" role from this user in the current organization.`
                        : ''
                }
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Remove"
                onConfirm={handleConfirmRemove}
            />
        </div>
    );
}
