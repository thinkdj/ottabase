import type { RoleRecord } from '@/types/rbac';
import { findGrantingPermission, PERMISSION_CATALOG, type PermissionDefinition } from '@ottabase/utils/permissions';
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
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { useRBACToast } from '@/hooks/useToast';
import { useRoles, useTogglePermission } from '@/hooks/useRBAC';
import { LoadingState, EmptyState } from '@ottabase/ui-components';

const CHIP_CLASS =
    'rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border';

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

    /** Directly granted on this role (togglable) */
    const hasPermission = (role: RoleRecord, permissionId: string): boolean => {
        return role.permissions?.includes(permissionId) || false;
    };
    /** Covered by a wildcard grant such as `*:*` or `posts:*` (shown checked, not togglable here) */
    const wildcardFor = (role: RoleRecord, permissionId: string): string | null => {
        const via = findGrantingPermission(role.permissions, permissionId);
        return via && via !== permissionId ? via : null;
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

    // Group the enforced permissions by section
    const permissionsByCategory = PERMISSION_CATALOG.reduce<Record<string, PermissionDefinition[]>>((acc, perm) => {
        (acc[perm.group] ??= []).push(perm);
        return acc;
    }, {});

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
                        <LoadingState count={1} height="h-9" className="w-72 max-w-full" />
                        <LoadingState count={4} height="h-24" />
                    </div>
                ) : roles.length === 0 ? (
                    <EmptyState title="No roles found. Create roles first to manage permissions." />
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
                                <EmptyState title="No roles found for this filter." />
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
                                                                    {permission.label}
                                                                    <div className="text-xs font-normal text-muted-foreground">
                                                                        {permission.description}{' '}
                                                                        <code className="font-mono">
                                                                            {permission.id}
                                                                        </code>
                                                                    </div>
                                                                </TableCell>
                                                                {filteredRoles.map((role) => {
                                                                    const hasIt = hasPermission(role, permission.id);
                                                                    const via = hasIt
                                                                        ? null
                                                                        : wildcardFor(role, permission.id);
                                                                    return (
                                                                        <TableCell
                                                                            key={role.id}
                                                                            className="px-4 py-3 text-center"
                                                                        >
                                                                            <div className="flex flex-col items-center gap-1">
                                                                                <Checkbox
                                                                                    checked={hasIt || !!via}
                                                                                    onCheckedChange={() =>
                                                                                        handleToggle(
                                                                                            role,
                                                                                            permission.id,
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        !!via ||
                                                                                        togglePermission.isPending
                                                                                    }
                                                                                    aria-label={
                                                                                        via
                                                                                            ? `${permission.label} for ${role.name}: included in ${via}`
                                                                                            : `${permission.label} for ${role.name}`
                                                                                    }
                                                                                />
                                                                                {via && (
                                                                                    <span className="text-[0.6875rem] text-muted-foreground">
                                                                                        via{' '}
                                                                                        <code className="font-mono">
                                                                                            {via}
                                                                                        </code>
                                                                                    </span>
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
                                        </div>
                                    ))}

                                    <p className="border-t border-border/60 pt-4 text-sm text-muted-foreground">
                                        Only permissions the server checks are listed. A greyed tick is already included
                                        in a wildcard grant on that role, such as <code>*:*</code> or{' '}
                                        <code>posts:*</code>.
                                    </p>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                )}
            </div>
        </div>
    );
}
