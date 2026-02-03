import type { RoleRecord } from '@/types/rbac';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Checkbox,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@ottabase/ui-shadcn';
import { Check, Shield, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { useRBACToast } from '@/hooks/useToast';
import { useRoles, useTogglePermission } from '@/hooks/useRBAC';

// Predefined permissions for the system
const SYSTEM_PERMISSIONS = [
    // Organization permissions
    { id: 'org:read', name: 'View Organization', category: 'Organization' },
    { id: 'org:write', name: 'Manage Organization', category: 'Organization' },
    { id: 'org:delete', name: 'Delete Organization', category: 'Organization' },

    // Member permissions
    { id: 'member:read', name: 'View Members', category: 'Members' },
    { id: 'member:invite', name: 'Invite Members', category: 'Members' },
    { id: 'member:write', name: 'Manage Members', category: 'Members' },
    { id: 'member:delete', name: 'Remove Members', category: 'Members' },

    // Role permissions
    { id: 'role:read', name: 'View Roles', category: 'RBAC' },
    { id: 'role:write', name: 'Manage Roles', category: 'RBAC' },
    { id: 'role:delete', name: 'Delete Roles', category: 'RBAC' },
    { id: 'permission:grant', name: 'Grant Permissions', category: 'RBAC' },
    { id: 'permission:revoke', name: 'Revoke Permissions', category: 'RBAC' },

    // Audit permissions
    { id: 'audit:read', name: 'View Audit Logs', category: 'Audit' },

    // App permissions
    { id: 'app:read', name: 'View Apps', category: 'Apps' },
    { id: 'app:write', name: 'Manage Apps', category: 'Apps' },
    { id: 'app:delete', name: 'Delete Apps', category: 'Apps' },
];

export function PermissionsMatrixPage() {
    const toast = useRBACToast();
    const [activeTab, setActiveTab] = useState('all');

    // TanStack Query hooks with optimistic updates
    const { data: roles = [], isLoading, error, refetch } = useRoles();
    const togglePermission = useTogglePermission();

    const filterRoles = (filter: string) => {
        switch (filter) {
            case 'system':
                return roles.filter(r => r.isSystem || (!r.organizationId && !r.appId));
            case 'org':
                return roles.filter(r => r.organizationId && !r.appId);
            case 'app':
                return roles.filter(r => r.appId);
            default:
                return roles;
        }
    };

    const filteredRoles = filterRoles(activeTab);

    const hasPermission = (role: RoleRecord, permissionId: string): boolean => {
        return role.permissions?.includes(permissionId) || false;
    };

    // Optimistic permission toggle with instant UI feedback
    const handleToggle = async (role: RoleRecord, permissionId: string) => {
        const hasIt = hasPermission(role, permissionId);

        togglePermission.mutate(
            {
                roleId: role.id,
                permissionId,
                hasPermission: hasIt,
            },
            {
                onSuccess: () => {
                    toast.rbac[hasIt ? 'permissionRevoked' : 'permissionGranted']();
                },
                onError: (err) => {
                    toast.error(
                        'Permission update failed',
                        err instanceof Error ? err.message : 'Unknown error'
                    );
                },
            }
        );
    };

    // Group permissions by category
    const permissionsByCategory = SYSTEM_PERMISSIONS.reduce((acc, perm) => {
        if (!acc[perm.category]) {
            acc[perm.category] = [];
        }
        acc[perm.category].push(perm);
        return acc;
    }, {} as Record<string, typeof SYSTEM_PERMISSIONS>);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Permissions Matrix
                            </CardTitle>
                            <CardDescription>
                                Manage role permissions across the hierarchy
                            </CardDescription>
                        </div>
                        <Button variant="outline" asChild>
                            <Link to="/admin/rbac">← Back to RBAC</Link>
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <ApiErrorDisplay
                            error={error instanceof Error ? error : new Error('Failed to load roles')}
                            onRetry={() => refetch()}
                            className="mb-4"
                        />
                    )}

                    {isLoading ? (
                        <TableSkeleton rows={8} columns={5} />
                    ) : roles.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No roles found. Create roles first to manage permissions.
                        </div>
                    ) : (
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="mb-4">
                                <TabsTrigger value="all">All Roles ({roles.length})</TabsTrigger>
                                <TabsTrigger value="system">
                                    System ({filterRoles('system').length})
                                </TabsTrigger>
                                <TabsTrigger value="org">
                                    Organization ({filterRoles('org').length})
                                </TabsTrigger>
                                <TabsTrigger value="app">
                                    App ({filterRoles('app').length})
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value={activeTab} className="overflow-x-auto">
                                {filteredRoles.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No roles found for this filter.
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                                            <div key={category}>
                                                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                                                    {category}
                                                </h3>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead className="w-1/4">
                                                                Permission
                                                            </TableHead>
                                                            {filteredRoles.map((role) => (
                                                                <TableHead key={role.id} className="text-center">
                                                                    <div className="space-y-1">
                                                                        <Badge
                                                                            variant={
                                                                                role.isSystem
                                                                                    ? 'default'
                                                                                    : role.organizationId
                                                                                    ? 'secondary'
                                                                                    : 'outline'
                                                                            }
                                                                        >
                                                                            {role.name}
                                                                        </Badge>
                                                                        {role.isSystem && (
                                                                            <div className="text-xs text-muted-foreground">
                                                                                System
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </TableHead>
                                                            ))}
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {permissions.map((permission) => (
                                                            <TableRow key={permission.id}>
                                                                <TableCell className="font-medium">
                                                                    {permission.name}
                                                                    <div className="text-xs text-muted-foreground">
                                                                        <code>{permission.id}</code>
                                                                    </div>
                                                                </TableCell>
                                                                {filteredRoles.map((role) => {
                                                                    const hasIt = hasPermission(role, permission.id);
                                                                    return (
                                                                        <TableCell
                                                                            key={role.id}
                                                                            className="text-center"
                                                                        >
                                                                            <div className="flex justify-center">
                                                                                <Checkbox
                                                                                    checked={hasIt}
                                                                                    onCheckedChange={() =>
                                                                                        handleToggle(
                                                                                            role,
                                                                                            permission.id
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        togglePermission.isPending
                                                                                    }
                                                                                    aria-label={`Toggle ${permission.name} for ${role.name}`}
                                                                                />
                                                                            </div>
                                                                        </TableCell>
                                                                    );
                                                                })}
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        ))}

                                        {/* Legend */}
                                        <div className="flex gap-4 items-center text-sm text-muted-foreground pt-4 border-t">
                                            <div className="flex items-center gap-2">
                                                <Check className="h-4 w-4 text-green-600" />
                                                <span>Permission Granted</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <X className="h-4 w-4 text-red-600" />
                                                <span>Permission Denied</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
