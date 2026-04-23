import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import {
    useDeleteOrganization,
    useOrganizationOffboard,
    usePlatformCreateOrganization,
    usePlatformOrganizations,
    usePlatformUpdateOrganization,
} from '@/hooks/useRBAC';
import { useRBACToast } from '@/hooks/useToast';
import { isApiError } from '@/lib/api';
import type { BadgeVariant, OrganizationRecord } from '@/types/rbac';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import { IconDoorExit } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { Edit, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { OrganizationForm, type OrganizationFormData } from './components/OrganizationForm';

export function OrganizationsPage() {
    const toast = useRBACToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<OrganizationRecord | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
    const [offboardDialog, setOffboardDialog] = useState<string | null>(null);
    const [formKey, setFormKey] = useState(0);

    // TanStack Query hooks
    const { data: organizations = [], isLoading, error, refetch } = usePlatformOrganizations();
    const createMutation = usePlatformCreateOrganization();
    const updateMutation = usePlatformUpdateOrganization();
    const deleteMutation = useDeleteOrganization();
    const offboardMutation = useOrganizationOffboard();

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

    const handleOffboard = (id: string) => {
        setOffboardDialog(id);
    };

    const handleConfirmOffboard = () => {
        if (!offboardDialog) return;
        offboardMutation.mutate(offboardDialog, {
            onSuccess: () => {
                toast.success('Organization offboarded', 'The tenant was marked as cancelled.');
                setOffboardDialog(null);
            },
            onError: (err) => {
                toast.error('Offboard failed', err instanceof Error ? err.message : 'Unknown error');
            },
        });
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
            case 'cancelled':
                return 'secondary';
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
                            <CardTitle>Tenant Directory</CardTitle>
                            <CardDescription>
                                Platform-admin directory for tenant lifecycle and support actions
                            </CardDescription>
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
                                                <Button variant="outline" size="sm" className="gap-2" asChild>
                                                    <Link
                                                        to={`/admin-platform/organizations/${org.id}/members` as never}
                                                    >
                                                        <Users className="h-4 w-4" />
                                                        View Members
                                                    </Link>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleOffboard(org.id)}
                                                    disabled={offboardMutation.isPending}
                                                    title="Offboard tenant (system admin)"
                                                    className="dark:text-slate-300"
                                                >
                                                    <IconDoorExit className="h-4 w-4" />
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
                        organization={editingOrg}
                        onSubmit={handleSubmit}
                        onCancel={() => setIsDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={!!deleteDialog}
                onOpenChange={(open) => !open && setDeleteDialog(null)}
                title="Delete Organization?"
                description="This will permanently delete the organization and all associated data. This action cannot be undone."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={handleConfirmDelete}
            />

            <ConfirmDialog
                open={!!offboardDialog}
                onOpenChange={(open) => !open && setOffboardDialog(null)}
                title="Offboard organization?"
                description="Marks the tenant as cancelled. Requires system-admin access; use for customer churn or shutdown without deleting historical data."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Offboard"
                onConfirm={handleConfirmOffboard}
            />
        </div>
    );
}
