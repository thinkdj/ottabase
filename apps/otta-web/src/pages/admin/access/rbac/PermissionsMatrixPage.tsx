import type { RoleRecord } from '@/types/rbac';
import {
    Badge,
    Button,
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
import { ArrowLeft, Check, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { useRBACToast } from '@/hooks/useToast';
import { useRoles, useTogglePermission } from '@/hooks/useRBAC';

const CHIP_CLASS =
    'rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border';

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
                return roles.filter((r) => r.isSystem || (!r.organizationId && !r.appId));
            case 'org':
                return roles.filter((r) => r.organizationId && !r.appId);
            case 'app':
                return roles.filter((r) => r.appId);
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
                    toast.error('Permission update failed', err instanceof Error ? err.message : 'Unknown error');
                },
            },
        );
    };

    // Group permissions by category
    const permissionsByCategory = SYSTEM_PERMISSIONS.reduce(
        (acc, perm) => {
            if (!acc[perm.category]) {
                acc[perm.category] = [];
            }
            acc[perm.category].push(perm);
            return acc;
        },
        {} as Record<string, typeof SYSTEM_PERMISSIONS>,
    );

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to="/admin/access/rbac">
                        <ArrowLeft className="h-4 w-4" />
                        Back to RBAC
                    </Link>
                </Button>

                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Permissions Matrix</h1>
                    <p className="max-w-3xl text-muted-foreground">Manage role permissions across the hierarchy</p>
                </div>
            </div>

            <div className="space-y-4">
                {error && (
                    <ApiErrorDisplay
                        error={error instanceof Error ? error : new Error('Failed to load roles')}
                        onRetry={() => refetch()}
                    />
                )}

                {isLoading ? (
                    <div className="space-y-3" aria-busy="true">
                        <span className="sr-only">Loading permissions matrix…</span>
                        <div className="h-9 w-72 max-w-full animate-pulse rounded-xl bg-muted/40" />
                        {Array.from({ length: 4 }, (_, index) => (
                            <div key={index} className="h-24 animate-pulse rounded-xl bg-muted/40" />
                        ))}
                    </div>
                ) : roles.length === 0 ? (
                    <div className="rounded-xl bg-muted/40 py-12 text-center">
                        <p className="text-sm text-muted-foreground">
                            No roles found. Create roles first to manage permissions.
                        </p>
                    </div>
                ) : (
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="mb-4">
                            <TabsTrigger value="all">All Roles ({roles.length})</TabsTrigger>
                            <TabsTrigger value="system">System ({filterRoles('system').length})</TabsTrigger>
                            <TabsTrigger value="org">Organization ({filterRoles('org').length})</TabsTrigger>
                            <TabsTrigger value="app">App ({filterRoles('app').length})</TabsTrigger>
                        </TabsList>

                        <TabsContent value={activeTab} className="overflow-x-auto">
                            {filteredRoles.length === 0 ? (
                                <div className="rounded-xl bg-muted/40 py-12 text-center">
                                    <p className="text-sm text-muted-foreground">No roles found for this filter.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {Object.entries(permissionsByCategory).map(([category, permissions]) => (
                                        <div key={category} className="space-y-3">
                                            <h3 className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                {category}
                                            </h3>
                                            <div className="overflow-hidden rounded-xl border border-border/60">
                                                <Table>
                                                    <TableHeader className="bg-muted/40">
                                                        <TableRow className="border-border/60 hover:bg-transparent">
                                                            <TableHead className="w-1/4 px-4 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                                Permission
                                                            </TableHead>
                                                            {filteredRoles.map((role) => (
                                                                <TableHead key={role.id} className="px-4 text-center">
                                                                    <div className="space-y-1 py-2">
                                                                        <Badge variant="outline" className={CHIP_CLASS}>
                                                                            {role.name}
                                                                        </Badge>
                                                                        {role.isSystem && (
                                                                            <div className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
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
                                                            <TableRow
                                                                key={permission.id}
                                                                className="border-border/60 transition-colors duration-normal hover:bg-muted/40"
                                                            >
                                                                <TableCell className="px-4 py-3 font-medium">
                                                                    {permission.name}
                                                                    <div className="text-xs text-muted-foreground">
                                                                        <code className="font-mono">
                                                                            {permission.id}
                                                                        </code>
                                                                    </div>
                                                                </TableCell>
                                                                {filteredRoles.map((role) => {
                                                                    const hasIt = hasPermission(role, permission.id);
                                                                    return (
                                                                        <TableCell
                                                                            key={role.id}
                                                                            className="px-4 py-3 text-center"
                                                                        >
                                                                            <div className="flex justify-center">
                                                                                <Checkbox
                                                                                    checked={hasIt}
                                                                                    onCheckedChange={() =>
                                                                                        handleToggle(
                                                                                            role,
                                                                                            permission.id,
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
                                        </div>
                                    ))}

                                    {/* Legend */}
                                    <div className="flex items-center gap-4 border-t border-border/60 pt-4 text-sm text-muted-foreground">
                                        <div className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-success" />
                                            <span>Permission Granted</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <X className="h-4 w-4 text-destructive" />
                                            <span>Permission Denied</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </div>
    );
}
