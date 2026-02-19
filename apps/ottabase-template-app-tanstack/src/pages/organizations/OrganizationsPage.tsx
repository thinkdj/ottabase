import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { useCreateOrganization, useDeleteOrganization, useOrganizations, useUpdateOrganization } from '@/hooks/useRBAC';
import { useRBACToast } from '@/hooks/useToast';
import { isApiError } from '@/lib/api';
import type { BadgeVariant, OrganizationRecord } from '@/types/rbac';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { Edit, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { OrganizationForm, type OrganizationFormData } from './components/OrganizationForm';

export function OrganizationsPage() {
    const toast = useRBACToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<OrganizationRecord | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
    const [formKey, setFormKey] = useState(0);

    // TanStack Query hooks
    const { data: organizations = [], isLoading, error, refetch } = useOrganizations();
    const createMutation = useCreateOrganization();
    const updateMutation = useUpdateOrganization();
    const deleteMutation = useDeleteOrganization();

    const handleCreate = () => {
        setEditingOrg(null);
        setFormKey((key) => key + 1);
        setIsDialogOpen(true);
    };

    const handleEdit = (org: OrganizationRecord) => {
        setEditingOrg(org);
        setFormKey((key) => key + 1);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        setDeleteDialog(id);
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;

        const id = deleteDialog;
        deleteMutation.mutate(id, {
            onSuccess: () => {
                toast.rbac.organizationDeleted();
                setDeleteDialog(null);
            },
            onError: (err) => {
                toast.error('Delete failed', err instanceof Error ? err.message : 'Unknown error');
            },
        });
    };

    const handleSubmit = async (data: OrganizationFormData) => {
        try {
            if (editingOrg) {
                await updateMutation.mutateAsync({
                    id: editingOrg.id,
                    data,
                });
                toast.rbac.organizationUpdated();
            } else {
                await createMutation.mutateAsync(data);
                toast.rbac.organizationCreated();
            }
            setIsDialogOpen(false);
            setEditingOrg(null);
        } catch (err) {
            throw new Error(isApiError(err) ? err.message : 'Failed to save organization');
        }
    };

    const getPlanBadgeVariant = (plan: string): BadgeVariant => {
        switch (plan) {
            case 'enterprise':
                return 'default';
            case 'pro':
                return 'secondary';
            default:
                return 'outline';
        }
    };

    const getStatusBadgeVariant = (status: string): BadgeVariant => {
        switch (status) {
            case 'active':
                return 'default';
            case 'suspended':
                return 'destructive';
            default:
                return 'outline';
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Organizations</CardTitle>
                            <CardDescription>Manage organization tenants and settings</CardDescription>
                        </div>
                        <Button onClick={handleCreate} className="gap-2">
                            <Plus className="h-4 w-4" />
                            New Organization
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <ApiErrorDisplay
                            error={error instanceof Error ? error : new Error('Failed to load organizations')}
                            onRetry={() => refetch()}
                            className="mb-4"
                        />
                    )}

                    {isLoading ? (
                        <TableSkeleton rows={5} columns={6} />
                    ) : organizations.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No organizations found. Create your first one!
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Slug</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {organizations.map((org) => (
                                    <TableRow key={org.id}>
                                        <TableCell className="font-medium">{org.name}</TableCell>
                                        <TableCell>
                                            <code className="text-sm bg-muted px-2 py-1 rounded">{org.slug}</code>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={getPlanBadgeVariant(org.plan)}>{org.plan}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={getStatusBadgeVariant(org.status)}>{org.status}</Badge>
                                        </TableCell>
                                        <TableCell>{new Date(org.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link to={`/organizations/${org.id}/members`}>
                                                        <Users className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEdit(org)}
                                                    disabled={updateMutation.isPending}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(org.id)}
                                                    disabled={deleteMutation.isPending}
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
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingOrg ? 'Edit Organization' : 'Create Organization'}</DialogTitle>
                        <DialogDescription>
                            {editingOrg
                                ? 'Update organization details and settings'
                                : 'Create a new organization tenant'}
                        </DialogDescription>
                    </DialogHeader>
                    <OrganizationForm
                        key={formKey}
                        organization={editingOrg as any}
                        onSubmit={handleSubmit}
                        onCancel={() => setIsDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Organization?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the organization and all associated data. This action cannot be
                            undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
