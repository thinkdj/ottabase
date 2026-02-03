import { api, isApiError } from '@/lib/api';
import type { RoleRecord, PermissionRecord } from '@/types/rbac';
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
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { useRBACToast } from '@/hooks/useToast';

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

interface PermissionMatrixData {
    roles: RoleRecord[];
    permissions: typeof SYSTEM_PERMISSIONS;
}

export function PermissionsMatrixPage() {
    const toast = useRBACToast();
    const [roles, setRoles] = useState<RoleRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [updatingCell, setUpdatingCell] = useState<string | null>(null); // roleId:permissionId

    const fetchRoles = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api<{ data: RoleRecord[] }>('/api/rbac/roles');
            if (response.data) {
                setRoles(response.data);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to load roles');
            setError(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRoles();
    }, [fetchRoles]);

    const hasPermission = (role: RoleRecord, permissionId: string): boolean => {
        return role.permissions?.includes(permissionId) ?? false;
    };

    const togglePermission = async (role: RoleRecord, permissionId: string) => {
        const cellKey = `${role.id}:${permissionId}`;
        setUpdatingCell(cellKey);

        try {
            const currentPermissions = role.permissions || [];
            const hasIt = currentPermissions.includes(permissionId);
            const newPermissions = hasIt
                ? currentPermissions.filter(p => p !== permissionId)
                : [...currentPermissions, permissionId];

            await api(`/api/rbac/roles/${role.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ permissions: newPermissions }),
            });

            if (hasIt) {
                toast.rbac.permissionRevoked();
            } else {
                toast.rbac.permissionGranted();
            }

            await fetchRoles();
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to update permission');
            toast.error('Failed to update permission', error.message);
        } finally {
            setUpdatingCell(null);
        }
    };

    const groupPermissionsByCategory = () => {
        const grouped: Record<string, typeof SYSTEM_PERMISSIONS> = {};
        SYSTEM_PERMISSIONS.forEach(perm => {
            if (!grouped[perm.category]) {
                grouped[perm.category] = [];
            }
            grouped[perm.category].push(perm);
        });
        return grouped;
    };

    const filterRoles = (filter: 'system' | 'org' | 'app') => {
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

    const renderMatrix = (filteredRoles: RoleRecord[]) => {
        const groupedPermissions = groupPermissionsByCategory();

        return (
            <div className="space-y-6">
                {Object.entries(groupedPermissions).map(([category, permissions]) => (
                    <Card key={category}>
                        <CardHeader>
                            <CardTitle className="text-lg">{category}</CardTitle>
                            <CardDescription>
                                {permissions.length} permission{permissions.length !== 1 ? 's' : ''}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-64">Permission</TableHead>
                                            {filteredRoles.map(role => (
                                                <TableHead key={role.id} className="text-center min-w-32">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className="font-semibold">{role.displayName || role.name}</div>
                                                        {role.isSystem && (
                                                            <Badge variant="outline" className="text-xs">System</Badge>
                                                        )}
                                                        {role.organizationId && (
                                                            <Badge variant="secondary" className="text-xs">Org</Badge>
                                                        )}
                                                        {role.appId && (
                                                            <Badge variant="default" className="text-xs">App</Badge>
                                                        )}
                                                    </div>
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {permissions.map(permission => (
                                            <TableRow key={permission.id}>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{permission.name}</span>
                                                        <code className="text-xs text-muted-foreground">{permission.id}</code>
                                                    </div>
                                                </TableCell>
                                                {filteredRoles.map(role => {
                                                    const cellKey = `${role.id}:${permission.id}`;
                                                    const isChecked = hasPermission(role, permission.id);
                                                    const isUpdating = updatingCell === cellKey;
                                                    const isSystemRole = role.isSystem;

                                                    return (
                                                        <TableCell key={cellKey} className="text-center">
                                                            <div className="flex justify-center">
                                                                {isSystemRole ? (
                                                                    // Read-only for system roles
                                                                    isChecked ? (
                                                                        <Check className="h-5 w-5 text-green-600" />
                                                                    ) : (
                                                                        <X className="h-5 w-5 text-muted-foreground/30" />
                                                                    )
                                                                ) : (
                                                                    // Editable checkbox for custom roles
                                                                    <Checkbox
                                                                        checked={isChecked}
                                                                        disabled={isUpdating}
                                                                        onCheckedChange={() => togglePermission(role, permission.id)}
                                                                        className="h-5 w-5"
                                                                    />
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    );
                                                })}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    };

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
                                Manage role permissions across the hierarchy: System → Organization → App
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
                            error={error}
                            onRetry={() => fetchRoles()}
                            onDismiss={() => setError(null)}
                            className="mb-4"
                        />
                    )}

                    {loading && roles.length === 0 ? (
                        <TableSkeleton rows={10} columns={4} />
                    ) : roles.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No roles found. Create roles first to manage permissions.
                        </div>
                    ) : (
                        <Tabs defaultValue="all" className="space-y-4">
                            <TabsList>
                                <TabsTrigger value="all">All Roles ({roles.length})</TabsTrigger>
                                <TabsTrigger value="system">
                                    System Roles ({filterRoles('system').length})
                                </TabsTrigger>
                                <TabsTrigger value="org">
                                    Organization Roles ({filterRoles('org').length})
                                </TabsTrigger>
                                <TabsTrigger value="app">
                                    App Roles ({filterRoles('app').length})
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="all" className="space-y-4">
                                {renderMatrix(roles)}
                            </TabsContent>

                            <TabsContent value="system" className="space-y-4">
                                {filterRoles('system').length > 0 ? (
                                    renderMatrix(filterRoles('system'))
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No system roles found.
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="org" className="space-y-4">
                                {filterRoles('org').length > 0 ? (
                                    renderMatrix(filterRoles('org'))
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No organization-scoped roles found.
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="app" className="space-y-4">
                                {filterRoles('app').length > 0 ? (
                                    renderMatrix(filterRoles('app'))
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No app-scoped roles found.
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Understanding the Hierarchy</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                    <p>
                        <Badge variant="outline">System Roles</Badge> - Global roles with no tenant/app restrictions
                    </p>
                    <p>
                        <Badge variant="secondary">Organization Roles</Badge> - Scoped to a specific organization (multi-tenant SaaS)
                    </p>
                    <p>
                        <Badge variant="default">App Roles</Badge> - Scoped to a specific app (can be org-scoped or global)
                    </p>
                    <div className="pt-2 mt-2 border-t text-muted-foreground">
                        <p>System roles are read-only. Custom organization and app roles can be modified.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
