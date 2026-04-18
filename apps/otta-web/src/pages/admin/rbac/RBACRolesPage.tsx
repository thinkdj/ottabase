import { api, isApiError } from '@/lib/api';
import type { RoleRecord } from '@/types/rbac';
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
    Textarea,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import { Edit, Plus, Shield, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { useRBACToast } from '@/hooks/useToast';

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
            await api(`/api/rbac/roles/${deleteDialog}`, { method: 'DELETE' });
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
                await api(`/api/rbac/roles/${editingRole.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(data),
                });
                toast.rbac.roleUpdated();
            } else {
                await api('/api/rbac/roles', {
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
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                RBAC Roles
                            </CardTitle>
                            <CardDescription>Manage roles and their permissions</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" asChild>
                                <Link to="/admin/rbac/permissions">View Permissions Matrix</Link>
                            </Button>
                            <Button variant="outline" asChild>
                                <Link to="/admin/rbac">← Back to RBAC</Link>
                            </Button>
                            <Button onClick={handleCreate} className="gap-2">
                                <Plus className="h-4 w-4" />
                                New Role
                            </Button>
                        </div>
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
                        <TableSkeleton rows={5} columns={6} />
                    ) : roles.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No roles found. Create your first one!
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Display Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Permissions</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roles.map((role) => (
                                    <TableRow key={role.id}>
                                        <TableCell>
                                            <code className="text-sm bg-muted px-2 py-1 rounded">{role.name}</code>
                                        </TableCell>
                                        <TableCell className="font-medium">{role.displayName || '-'}</TableCell>
                                        <TableCell className="max-w-xs truncate">{role.description || '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{role.permissions?.length || 0} permissions</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {role.isSystem ? (
                                                <Badge>System</Badge>
                                            ) : role.organizationId ? (
                                                <Badge variant="secondary">Organization</Badge>
                                            ) : (
                                                <Badge variant="outline">Custom</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(role)}
                                                    disabled={role.isSystem}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
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
                    )}
                </CardContent>
            </Card>

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

                        <div className="flex justify-end gap-4 pt-4 border-t">
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
