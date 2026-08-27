import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { useCreateOrganization, useDeleteOrganization, useOrganizations, useUpdateOrganization } from '@/hooks/useRBAC';
import { useRBACToast } from '@/hooks/useToast';
import { isApiError } from '@/lib/api';
import type { OrganizationRecord } from '@/types/rbac';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Badge,
    Button,
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

    const getStatusDotClass = (status: string): string => {
        switch (status) {
            case 'active':
                return 'bg-success';
            case 'suspended':
                return 'bg-destructive';
            default:
                return 'bg-muted-foreground';
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Organizations</h1>
                    <p className="max-w-3xl text-muted-foreground">Manage organization tenants and settings</p>
                </div>
                <Button onClick={handleCreate} className="shrink-0 gap-2">
                    <Plus className="h-4 w-4" />
                    New Organization
                </Button>
            </div>

            <div className="space-y-4">
                {error && (
                    <ApiErrorDisplay
                        error={error instanceof Error ? error : new Error('Failed to load organizations')}
                        onRetry={() => refetch()}
                    />
                )}

                {isLoading ? (
                    <div className="space-y-3" aria-busy="true">
                        <span className="sr-only">Loading organizations…</span>
                        {Array.from({ length: 5 }, (_, index) => (
                            <div key={index} className="h-12 animate-pulse rounded-xl bg-muted/40" />
                        ))}
                    </div>
                ) : organizations.length === 0 ? (
                    <div className="rounded-xl bg-muted/40 py-12 text-center">
                        <p className="text-sm text-muted-foreground">No organizations found. Create your first one!</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border/60">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="border-border/60 hover:bg-transparent">
                                    <TableHead className="h-auto px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Name
                                    </TableHead>
                                    <TableHead className="h-auto px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Slug
                                    </TableHead>
                                    <TableHead className="h-auto px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Plan
                                    </TableHead>
                                    <TableHead className="h-auto px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Status
                                    </TableHead>
                                    <TableHead className="h-auto px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Created
                                    </TableHead>
                                    <TableHead className="h-auto px-4 py-3 text-right text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {organizations.map((org) => (
                                    <TableRow
                                        key={org.id}
                                        className="border-border/60 transition-colors duration-normal hover:bg-muted/40"
                                    >
                                        <TableCell className="px-4 py-3 font-medium">{org.name}</TableCell>
                                        <TableCell className="px-4 py-3">
                                            <code className="rounded-md bg-background px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border">
                                                {org.slug}
                                            </code>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <Badge
                                                variant="outline"
                                                className="rounded-full border-transparent bg-background px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border"
                                            >
                                                {org.plan}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-4 py-3">
                                            <Badge
                                                variant="outline"
                                                className="gap-1.5 rounded-full border-transparent bg-background px-2.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border"
                                            >
                                                <span
                                                    className={`h-1.5 w-1.5 rounded-full ${getStatusDotClass(org.status)}`}
                                                    aria-hidden="true"
                                                />
                                                {org.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                            {new Date(org.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="gap-2 text-muted-foreground hover:text-foreground"
                                                    asChild
                                                >
                                                    <Link
                                                        to="/admin/access/organizations/$organizationId/members"
                                                        params={{ organizationId: org.id }}
                                                    >
                                                        <Users className="h-4 w-4" />
                                                        View Members
                                                    </Link>
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-foreground"
                                                    onClick={() => handleEdit(org)}
                                                    disabled={updateMutation.isPending}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-destructive"
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
                    </div>
                )}
            </div>

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
        </div>
    );
}
