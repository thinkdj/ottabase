import { api, isApiError } from '@/lib/api';
import type { RoleRecord } from '@/types/rbac';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Badge,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Textarea,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import { ArrowLeft, Edit, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { useRBACToast } from '@/hooks/useToast';

const CHIP_CLASS =
    'rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border';
const TH_CLASS = 'h-auto px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';

interface RoleFormData {
    name: string;
    displayName: string;
    description: string;
    permissions: string;
}

export function RBACRolesPage() {
    const toast = useRBACToast();
    const [roles, setRoles] = useState<RoleRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

    const [formData, setFormData] = useState<RoleFormData>({
        name: '',
        displayName: '',
        description: '',
        permissions: '',
    });

    const fetchRoles = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api<{ data: RoleRecord[] }>('/api/admin/roles');
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

    const handleCreate = () => {
        setEditingRole(null);
        setFormData({
            name: '',
            displayName: '',
            description: '',
            permissions: '',
        });
        setIsDialogOpen(true);
    };

    const handleEdit = (role: RoleRecord) => {
        setEditingRole(role);
        setFormData({
            name: role.name,
            displayName: role.displayName || '',
            description: role.description || '',
            permissions: (role.permissions || []).join(', '),
        });
        setIsDialogOpen(true);
    };

    const handleDelete = (id: string) => {
        setDeleteDialog(id);
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;

        try {
            await api(`/api/admin/roles/${deleteDialog}`, { method: 'DELETE' });
            toast.rbac.roleDeleted();
            await fetchRoles();
            setDeleteDialog(null);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to delete role');
            toast.error('Failed to delete role', error.message);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const data = {
            name: formData.name,
            displayName: formData.displayName,
            description: formData.description,
            permissions: formData.permissions
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean),
        };

        try {
            if (editingRole) {
                await api(`/api/admin/roles/${editingRole.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(data),
                });
                toast.rbac.roleUpdated();
            } else {
                await api('/api/admin/roles', {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
                toast.rbac.roleCreated();
            }
            await fetchRoles();
            setIsDialogOpen(false);
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Failed to save role');
            toast.error('Failed to save role', error.message);
        }
    };

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

                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1.5">
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">RBAC Roles</h1>
                        <p className="max-w-3xl text-muted-foreground">Manage roles and their permissions</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                            <Link to="/admin/access/rbac/permissions">View Permissions Matrix</Link>
                        </Button>
                        <Button onClick={handleCreate} className="gap-2">
                            <Plus className="h-4 w-4" />
                            New Role
                        </Button>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {error && (
                    <ApiErrorDisplay error={error} onRetry={() => fetchRoles()} onDismiss={() => setError(null)} />
                )}

                {loading && roles.length === 0 ? (
                    <div className="space-y-3" aria-busy="true">
                        <span className="sr-only">Loading roles…</span>
                        {Array.from({ length: 5 }, (_, index) => (
                            <div key={index} className="h-12 animate-pulse rounded-xl bg-muted/40" />
                        ))}
                    </div>
                ) : roles.length === 0 ? (
                    <div className="rounded-xl bg-muted/40 py-12 text-center">
                        <p className="text-sm text-muted-foreground">No roles found. Create your first one!</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border/60">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="border-border/60 hover:bg-transparent">
                                    <TableHead className={TH_CLASS}>Name</TableHead>
                                    <TableHead className={TH_CLASS}>Display Name</TableHead>
                                    <TableHead className={TH_CLASS}>Description</TableHead>
                                    <TableHead className={TH_CLASS}>Permissions</TableHead>
                                    <TableHead className={TH_CLASS}>Type</TableHead>
                                    <TableHead className={`${TH_CLASS} text-right`}>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roles.map((role) => (
                                    <TableRow
                                        key={role.id}
                                        className="border-border/60 transition-colors duration-normal hover:bg-muted/40"
                                    >
                                        <TableCell className="px-4 py-3">
                                            <code className="rounded bg-background px-1.5 py-0.5 font-mono text-xs ring-1 ring-border">
                                                {role.name}
                                            </code>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 font-medium">
                                            {role.displayName || '-'}
                                        </TableCell>
                                        <TableCell className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                                            {role.description || '-'}
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <Badge variant="outline" className={CHIP_CLASS}>
                                                {role.permissions?.length || 0} permissions
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            {role.isSystem ? (
                                                <Badge variant="outline" className={CHIP_CLASS}>
                                                    System
                                                </Badge>
                                            ) : role.organizationId ? (
                                                <Badge variant="outline" className={CHIP_CLASS}>
                                                    Organization
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className={CHIP_CLASS}>
                                                    Custom
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-foreground"
                                                    onClick={() => handleEdit(role)}
                                                    disabled={role.isSystem}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-destructive"
                                                    onClick={() => handleDelete(role.id)}
                                                    disabled={role.isSystem}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
                        <DialogDescription>
                            {editingRole ? 'Update role details and permissions' : 'Create a new role with permissions'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Role Name*</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="editor"
                                    required
                                    disabled={!!editingRole}
                                />
                                <p className="text-sm text-muted-foreground">
                                    {editingRole
                                        ? 'Role name cannot be changed'
                                        : 'Unique role identifier (lowercase, no spaces)'}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="displayName">Display Name*</Label>
                                <Input
                                    id="displayName"
                                    value={formData.displayName}
                                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                    placeholder="Editor"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Can create and edit content..."
                                    rows={3}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="permissions">Permissions (comma-separated)</Label>
                                <Textarea
                                    id="permissions"
                                    value={formData.permissions}
                                    onChange={(e) => setFormData({ ...formData, permissions: e.target.value })}
                                    placeholder="posts:read, posts:write, posts:delete"
                                    rows={4}
                                />
                                <p className="text-sm text-muted-foreground">
                                    Enter permissions separated by commas. Format: resource:action
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 border-t border-border/60 pt-4">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit">{editingRole ? 'Update Role' : 'Create Role'}</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={!!deleteDialog}
                onOpenChange={(open) => !open && setDeleteDialog(null)}
                title="Delete Role?"
                description="This will permanently delete the role and remove it from all users. This action cannot be undone."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
