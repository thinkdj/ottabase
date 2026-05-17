import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { useCreateUserGroup, useDeleteUserGroup, useUpdateUserGroup, useUserGroups } from '@/hooks/useUserGroups';
import { useRBACToast } from '@/hooks/useToast';
import { isApiError } from '@/lib/api';
import { organizationIdAtom } from '@/ottabase/state/appState';
import type { CreateUserGroupInput, UpdateUserGroupInput, UserGroupRecord } from '@/types/rbac';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Textarea,
} from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { useAtomValue } from 'jotai';
import { Edit, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';

interface GroupFormData {
    name: string;
    slug: string;
    description: string;
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function GroupForm({
    initialData,
    onSubmit,
    onCancel,
    loading,
}: {
    initialData?: GroupFormData;
    onSubmit: (data: GroupFormData) => Promise<void>;
    onCancel: () => void;
    loading: boolean;
}) {
    const [form, setForm] = useState<GroupFormData>(initialData ?? { name: '', slug: '', description: '' });

    const handleNameChange = (name: string) => {
        // Auto-fill slug when creating (slug is empty)
        setForm((prev) => ({
            ...prev,
            name,
            slug: prev.slug && prev.slug !== slugify(prev.name) ? prev.slug : slugify(name),
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim() || !form.slug.trim()) return;
        await onSubmit(form);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="group-name">Name*</Label>
                <Input
                    id="group-name"
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Beta Testers"
                    disabled={loading}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="group-slug">Slug*</Label>
                <Input
                    id="group-slug"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                    placeholder="e.g. beta-testers"
                    disabled={loading}
                />
                <p className="text-xs text-muted-foreground">URL-safe identifier. Auto-generated from name.</p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="group-description">Description</Label>
                <Textarea
                    id="group-description"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Optional description"
                    rows={3}
                    disabled={loading}
                />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    Cancel
                </Button>
                <Button type="submit" disabled={loading || !form.name.trim() || !form.slug.trim()}>
                    {loading ? 'Saving...' : initialData ? 'Save Changes' : 'Create Group'}
                </Button>
            </div>
        </form>
    );
}

export function UserGroupsPage() {
    const toast = useRBACToast();
    const { organizationId: paramOrgId } = useParams({ strict: false }) as { organizationId?: string };
    // Fall back to global org atom if not in org context
    const globalOrgId = useAtomValue(organizationIdAtom);
    const organizationId = paramOrgId || globalOrgId || '';

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<UserGroupRecord | null>(null);
    const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
    const [formLoading, setFormLoading] = useState(false);

    const { data: groups = [], isLoading, error, refetch } = useUserGroups();
    const createMutation = useCreateUserGroup();
    const updateMutation = useUpdateUserGroup();
    const deleteMutation = useDeleteUserGroup();

    // Filter groups to current org
    const orgGroups = organizationId ? groups.filter((g) => g.organizationId === organizationId) : groups;

    const handleCreate = () => {
        setEditingGroup(null);
        setIsDialogOpen(true);
    };

    const handleEdit = (group: UserGroupRecord) => {
        setEditingGroup(group);
        setIsDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (!deleteDialog) return;
        deleteMutation.mutate(deleteDialog, {
            onSuccess: () => {
                toast.success('Group deleted');
                setDeleteDialog(null);
            },
            onError: (err) => {
                toast.error('Failed to delete group', err instanceof Error ? err.message : 'Unknown error');
            },
        });
    };

    const handleSubmit = async (data: GroupFormData) => {
        setFormLoading(true);
        try {
            if (editingGroup) {
                const input: UpdateUserGroupInput = {
                    name: data.name,
                    slug: data.slug,
                    description: data.description || undefined,
                };
                await updateMutation.mutateAsync({ id: editingGroup.id, data: input });
                toast.success('Group updated');
            } else {
                const input: CreateUserGroupInput = {
                    name: data.name,
                    slug: data.slug,
                    description: data.description || undefined,
                    organizationId,
                };
                await createMutation.mutateAsync(input);
                toast.success('Group created');
            }
            setIsDialogOpen(false);
            setEditingGroup(null);
        } catch (err) {
            throw new Error(isApiError(err) ? err.message : 'Failed to save group');
        } finally {
            setFormLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>User Groups</CardTitle>
                            <CardDescription>
                                Organize members into groups for access control and feature flags.
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            {paramOrgId && (
                                <Button variant="outline" asChild>
                                    <Link
                                        to={'/admin/access/organizations/$organizationId/members' as never}
                                        params={{ organizationId: paramOrgId } as never}
                                    >
                                        ← Members
                                    </Link>
                                </Button>
                            )}
                            <Button onClick={handleCreate} className="gap-2" disabled={!organizationId}>
                                <Plus className="h-4 w-4" />
                                New Group
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {error && (
                        <ApiErrorDisplay
                            error={error instanceof Error ? error : new Error('Failed to load groups')}
                            onRetry={() => refetch()}
                            className="mb-4"
                        />
                    )}

                    {isLoading ? (
                        <TableSkeleton rows={4} columns={4} />
                    ) : orgGroups.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No groups yet.{' '}
                            {organizationId ? (
                                <button
                                    className="underline underline-offset-2 hover:text-foreground"
                                    onClick={handleCreate}
                                >
                                    Create the first group.
                                </button>
                            ) : (
                                'Select an organization first.'
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Slug</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>App</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {orgGroups.map((group) => (
                                    <TableRow key={group.id}>
                                        <TableCell className="font-medium">{group.name}</TableCell>
                                        <TableCell>
                                            <code className="text-xs">{group.slug}</code>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm max-w-64 truncate">
                                            {group.description || '-'}
                                        </TableCell>
                                        <TableCell>
                                            {group.appId ? (
                                                <Badge variant="outline" className="text-xs">
                                                    {group.appId}
                                                </Badge>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">all apps</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" asChild>
                                                    <Link
                                                        to={
                                                            '/admin/access/organizations/$organizationId/groups/$groupId/members' as never
                                                        }
                                                        params={
                                                            {
                                                                organizationId: group.organizationId,
                                                                groupId: group.id,
                                                            } as never
                                                        }
                                                        title="View members"
                                                    >
                                                        <Users className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleEdit(group)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setDeleteDialog(group.id)}
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
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingGroup ? 'Edit Group' : 'New Group'}</DialogTitle>
                        <DialogDescription>
                            {editingGroup
                                ? 'Update group name, slug, or description.'
                                : 'Create a new user group for this organization.'}
                        </DialogDescription>
                    </DialogHeader>
                    <GroupForm
                        key={editingGroup?.id ?? 'new'}
                        initialData={
                            editingGroup
                                ? {
                                      name: editingGroup.name,
                                      slug: editingGroup.slug,
                                      description: editingGroup.description ?? '',
                                  }
                                : undefined
                        }
                        onSubmit={handleSubmit}
                        onCancel={() => setIsDialogOpen(false)}
                        loading={formLoading}
                    />
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={!!deleteDialog}
                onOpenChange={(open) => !open && setDeleteDialog(null)}
                title="Delete Group?"
                description="This will delete the group and remove all its members. This action cannot be undone."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
