/**
 * User RBAC Assignment Page
 *
 * Assign users to organizations with roles
 * GitHub-like minimal UI with dark mode support
 */

import { useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
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
} from '@ottabase/ui-shadcn';
import { Shield, Building2, Plus, Trash2, Loader2 } from 'lucide-react';
import { useRBACToast } from '@/hooks/useToast';
import { useOrganizations } from '@/hooks/useRBAC';
import type { MemberRole, BadgeVariant } from '@/types/rbac';

interface UserOrganization {
    id: string;
    organizationId: string;
    organizationName: string;
    role: MemberRole;
    joinedAt: Date;
}

export function UserRBACPage() {
    const { userId } = useParams({ from: '/admin/users/$userId/rbac' });
    const toast = useRBACToast();
    const { data: orgs = [] } = useOrganizations();

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedOrg, setSelectedOrg] = useState('');
    const [selectedRole, setSelectedRole] = useState<MemberRole>('member');
    const [isAdding, setIsAdding] = useState(false);

    // TODO: Replace with actual API call
    const mockUser = {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com',
        image: null,
    };

    const mockUserOrgs: UserOrganization[] = [
        {
            id: 'member-1',
            organizationId: 'org-1',
            organizationName: 'Acme Corp',
            role: 'admin',
            joinedAt: new Date('2024-01-15'),
        },
        {
            id: 'member-2',
            organizationId: 'org-2',
            organizationName: 'Tech Startup',
            role: 'member',
            joinedAt: new Date('2024-02-20'),
        },
    ];

    const availableOrgs = orgs.filter(
        (org) => !mockUserOrgs.some((uo) => uo.organizationId === org.id)
    );

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

    const handleAddToOrg = async () => {
        if (!selectedOrg) {
            toast.error('Validation error', 'Please select an organization');
            return;
        }

        setIsAdding(true);
        try {
            // TODO: Implement API call
            await new Promise((resolve) => setTimeout(resolve, 1000));
            toast.rbac.memberInvited();
            setIsDialogOpen(false);
            setSelectedOrg('');
            setSelectedRole('member');
        } catch (error) {
            toast.error('Failed to add', 'Could not add user to organization');
        } finally {
            setIsAdding(false);
        }
    };

    const handleRemove = async (membershipId: string, orgName: string) => {
        if (!confirm(`Remove user from ${orgName}?`)) return;

        try {
            // TODO: Implement API call
            await new Promise((resolve) => setTimeout(resolve, 500));
            toast.rbac.memberRemoved();
        } catch (error) {
            toast.error('Failed to remove', 'Could not remove user from organization');
        }
    };

    const handleRoleChange = async (membershipId: string, newRole: MemberRole) => {
        try {
            // TODO: Implement API call
            await new Promise((resolve) => setTimeout(resolve, 500));
            toast.rbac.memberUpdated();
        } catch (error) {
            toast.error('Failed to update', 'Could not update role');
        }
    };

    const userInitials = mockUser.name
        ? mockUser.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
        : mockUser.email[0].toUpperCase();

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
                    <Link to="/admin/users">← Back to Users</Link>
                </Button>
            </div>

            {/* User Info */}
            <Card>
                <CardHeader>
                    <CardTitle>User Profile</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={mockUser.image || undefined} />
                            <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h3 className="font-semibold text-lg">{mockUser.name}</h3>
                            <p className="text-sm text-muted-foreground">{mockUser.email}</p>
                            <code className="text-xs bg-muted px-2 py-1 rounded mt-1 inline-block">
                                {mockUser.id}
                            </code>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Organizations */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Organization Memberships</CardTitle>
                            <CardDescription>
                                Organizations this user has access to
                            </CardDescription>
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
                                    <DialogDescription>
                                        Grant this user access to an organization
                                    </DialogDescription>
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
                                            onValueChange={(value) =>
                                                setSelectedRole(value as MemberRole)
                                            }
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
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button
                                        onClick={handleAddToOrg}
                                        disabled={isAdding || !selectedOrg}
                                        className="w-full"
                                    >
                                        {isAdding ? (
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
                    {mockUserOrgs.length === 0 ? (
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
                                {mockUserOrgs.map((membership) => (
                                    <TableRow key={membership.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">
                                                    {membership.organizationName}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Select
                                                value={membership.role}
                                                onValueChange={(value) =>
                                                    handleRoleChange(
                                                        membership.id,
                                                        value as MemberRole
                                                    )
                                                }
                                            >
                                                <SelectTrigger className="w-32">
                                                    <Badge
                                                        variant={getRoleBadgeVariant(
                                                            membership.role
                                                        )}
                                                    >
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
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {new Date(membership.joinedAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() =>
                                                    handleRemove(
                                                        membership.id,
                                                        membership.organizationName
                                                    )
                                                }
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
        </div>
    );
}
