import { api, isApiError } from '@/lib/api';
import type { PaginatedResponse, Pagination } from '@/lib/api-types';
import type { OrganizationRecord, BadgeVariant } from '@/types/rbac';
import {
    Badge,
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
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
    DialogTrigger,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@ottabase/ui-shadcn';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit, Plus, Trash2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { OrganizationForm, type OrganizationFormData } from './components/OrganizationForm';

type OrganizationsResponse = PaginatedResponse<OrganizationRecord>;

export function OrganizationsPage() {
    const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<OrganizationRecord | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(15);
    const [pagination, setPagination] = useState<Pagination | null>(null);

    const fetchOrganizations = useCallback(async (page: number = 1, itemsPerPage: number = 15) => {
        try {
            setLoading(true);
            setError(null);
            const response = await api<OrganizationsResponse>(
                `/api/ottaorm/organizations?page=${page}&per_page=${itemsPerPage}`,
            );
            if (response.data) {
                setOrganizations(response.data);
                setPagination(response.pagination);
                setCurrentPage(response.pagination.page);
            }
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Failed to load organizations');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrganizations(currentPage, perPage);
    }, [fetchOrganizations, currentPage, perPage]);

    const handleCreate = () => {
        setEditingOrg(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (org: OrganizationRecord) => {
        setEditingOrg(org);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        setDeleteDialog(id);
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;

        const id = deleteDialog;
        try {
            await api(`/api/ottaorm/organizations/${id}`, { method: 'DELETE' });
            await fetchOrganizations(currentPage, perPage);
            setDeleteDialog(null);
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Failed to delete organization');
        }
    };

    const handleSubmit = async (data: OrganizationFormData) => {
        try {
            if (editingOrg) {
                await api(`/api/ottaorm/organizations/${editingOrg.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(data),
                });
            } else {
                await api('/api/ottaorm/organizations', {
                    method: 'POST',
                    body: JSON.stringify(data),
                });
            }
            await fetchOrganizations(currentPage, perPage);
            setIsDialogOpen(false);
            setEditingOrg(null);
        } catch (err) {
            throw new Error(isApiError(err) ? err.message : 'Failed to save organization');
        }
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handlePerPageChange = (value: string) => {
        setPerPage(parseInt(value));
        setCurrentPage(1);
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
                        <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-md">{error}</div>
                    )}

                    {loading && organizations.length === 0 ? (
                        <div className="text-center py-8">Loading organizations...</div>
                    ) : organizations.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No organizations found. Create your first one!
                        </div>
                    ) : (
                        <>
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
                                                <Badge variant={getPlanBadgeVariant(org.plan)}>
                                                    {org.plan}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusBadgeVariant(org.status)}>
                                                    {org.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {new Date(org.createdAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {}}
                                                        asChild
                                                    >
                                                        <Link to={`/organizations/${org.id}/members`}>
                                                            <Users className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEdit(org)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(org.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {/* Pagination */}
                            {pagination && (
                                <div className="flex items-center justify-between pt-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">Rows per page:</span>
                                        <Select value={perPage.toString()} onValueChange={handlePerPageChange}>
                                            <SelectTrigger className="w-20">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="15">15</SelectItem>
                                                <SelectItem value="25">25</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">
                                            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                                        </span>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handlePageChange(1)}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronsLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage === 1}
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage === pagination.totalPages}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                onClick={() => handlePageChange(pagination.totalPages)}
                                                disabled={currentPage === pagination.totalPages}
                                            >
                                                <ChevronsRight className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingOrg ? 'Edit Organization' : 'Create Organization'}</DialogTitle>
                        <DialogDescription>
                            {editingOrg ? 'Update organization details and settings' : 'Create a new organization tenant'}
                        </DialogDescription>
                    </DialogHeader>
                    <OrganizationForm
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
                            This will permanently delete the organization and all associated data. This action cannot be undone.
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
