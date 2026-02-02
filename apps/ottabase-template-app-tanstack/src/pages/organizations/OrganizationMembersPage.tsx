import { api, isApiError } from '@/lib/api';
import type { PaginatedResponse, Pagination } from '@/lib/api-types';
import type { OrganizationMemberRecord, BadgeVariant } from '@/types/rbac';
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
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit, Plus, Trash2, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { InviteMemberForm, type InviteMemberFormData } from './components/InviteMemberForm';

type MembersResponse = PaginatedResponse<OrganizationMemberRecord>;

export function OrganizationMembersPage() {
    const { organizationId } = useParams({ from: '/organizations/$organizationId/members' });
    const [members, setMembers] = useState<OrganizationMemberRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<OrganizationMemberRecord | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(15);
    const [pagination, setPagination] = useState<Pagination | null>(null);

    const fetchMembers = useCallback(async (page: number = 1, itemsPerPage: number = 15) => {
        try {
            setLoading(true);
            setError(null);
            // Filter by organizationId using query params
            const response = await api<MembersResponse>(
                `/api/ottaorm/organization_members?page=${page}&per_page=${itemsPerPage}&organizationId=${organizationId}`,
            );
            if (response.data) {
                setMembers(response.data);
                setPagination(response.pagination);
                setCurrentPage(response.pagination.page);
            }
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Failed to load members');
        } finally {
            setLoading(false);
        }
    }, [organizationId]);

    useEffect(() => {
        fetchMembers(currentPage, perPage);
    }, [fetchMembers, currentPage, perPage]);

    const handleInvite = () => {
        setEditingMember(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (member: OrganizationMemberRecord) => {
        setEditingMember(member);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        setDeleteDialog(id);
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;

        const id = deleteDialog;
        try {
            await api(`/api/ottaorm/organization_members/${id}`, { method: 'DELETE' });
            await fetchMembers(currentPage, perPage);
            setDeleteDialog(null);
        } catch (err) {
            setError(isApiError(err) ? err.message : 'Failed to remove member');
        }
    };

    const handleSubmit = async (data: InviteMemberFormData) => {
        try {
            if (editingMember) {
                await api(`/api/ottaorm/organization_members/${editingMember.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(data),
                });
            } else {
                await api('/api/ottaorm/organization_members', {
                    method: 'POST',
                    body: JSON.stringify({
                        ...data,
                        organizationId,
                        invitedAt: new Date().toISOString(),
                    }),
                });
            }
            await fetchMembers(currentPage, perPage);
            setIsDialogOpen(false);
            setEditingMember(null);
        } catch (err) {
            throw new Error(isApiError(err) ? err.message : 'Failed to invite member');
        }
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    const handlePerPageChange = (value: string) => {
        setPerPage(parseInt(value));
        setCurrentPage(1);
    };

    const getRoleBadgeVariant = (role: string): BadgeVariant => {
        switch (role) {
            case 'owner':
                return 'default';
            case 'admin':
                return 'secondary';
            default:
                return 'outline';
        }
    };

    const getStatusBadgeVariant = (status: string): BadgeVariant => {
        switch (status) {
            case 'active':
                return 'default';
            case 'invited':
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
                            <CardTitle>Organization Members</CardTitle>
                            <CardDescription>Manage members and their roles</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" asChild>
                                <Link to="/organizations">← Back to Organizations</Link>
                            </Button>
                            <Button onClick={handleInvite} className="gap-2">
                                <UserPlus className="h-4 w-4" />
                                Invite Member
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="mb-4 p-4 bg-destructive/10 text-destructive rounded-md">{error}</div>
                    )}

                    {loading && members.length === 0 ? (
                        <div className="text-center py-8">Loading members...</div>
                    ) : members.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No members found. Invite the first member!
                        </div>
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User ID</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Invited</TableHead>
                                        <TableHead>Joined</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {members.map((member) => (
                                        <TableRow key={member.id}>
                                            <TableCell>
                                                <code className="text-sm bg-muted px-2 py-1 rounded">{member.userId}</code>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getRoleBadgeVariant(member.role)}>
                                                    {member.role}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusBadgeVariant(member.status)}>
                                                    {member.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {member.invitedAt
                                                    ? new Date(member.invitedAt).toLocaleDateString()
                                                    : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {member.joinedAt
                                                    ? new Date(member.joinedAt).toLocaleDateString()
                                                    : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEdit(member)}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(member.id)}
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

            {/* Invite/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingMember ? 'Edit Member' : 'Invite Member'}</DialogTitle>
                        <DialogDescription>
                            {editingMember ? 'Update member role and status' : 'Invite a new member to this organization'}
                        </DialogDescription>
                    </DialogHeader>
                    <InviteMemberForm
                        organizationId={organizationId}
                        onSubmit={handleSubmit}
                        onCancel={() => setIsDialogOpen(false)}
                    />
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Member?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove the member from the organization. They will lose access immediately.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
