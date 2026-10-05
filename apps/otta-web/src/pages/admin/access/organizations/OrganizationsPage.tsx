/**
 * Organizations (admin): every tenant, with its plan and state. Open one to see its members.
 */
import { useCreateOrganization, useDeleteOrganization, useOrganizations, useUpdateOrganization } from '@/hooks/useRBAC';
import { useRBACToast } from '@/hooks/useToast';
import { isApiError } from '@/lib/api';
import type { OrganizationRecord, OrganizationStatus } from '@/types/rbac';
import { Chip, ConfirmDialog, type ChipTone } from '@ottabase/ui-components';
import { useDataTable } from '@ottabase/ui-datatable';
import { actionsColumn, createColumns, DataTable } from '@ottabase/ui-datatable/react';
import {
    Alert,
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@ottabase/ui-shadcn';
import { formatShortDate } from '@ottabase/utils/timezone';
import { useNavigate } from '@tanstack/react-router';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { OrganizationForm, type OrganizationFormData } from './components/OrganizationForm';

const STATUS_DOT: Record<OrganizationStatus, ChipTone> = {
    active: 'success',
    suspended: 'destructive',
    cancelled: 'muted',
};

const NO_ORGS: OrganizationRecord[] = [];

export function OrganizationsPage() {
    const navigate = useNavigate();
    const toast = useRBACToast();
    /** `'new'` opens an empty form; a record opens it filled in */
    const [editing, setEditing] = useState<OrganizationRecord | 'new' | null>(null);
    const [pendingDelete, setPendingDelete] = useState<OrganizationRecord | null>(null);

    const { data: organizations = NO_ORGS, isLoading, error } = useOrganizations();
    const createMutation = useCreateOrganization();
    const updateMutation = useUpdateOrganization();
    const deleteMutation = useDeleteOrganization();

    const openMembers = useCallback(
        (org: OrganizationRecord) =>
            void navigate({
                to: '/admin/access/organizations/$organizationId/members',
                params: { organizationId: org.id },
            }),
        [navigate],
    );

    const save = async (data: OrganizationFormData) => {
        try {
            if (editing && editing !== 'new') {
                await updateMutation.mutateAsync({ id: editing.id, data });
                toast.rbac.organizationUpdated();
            } else {
                await createMutation.mutateAsync(data);
                toast.rbac.organizationCreated();
            }
            setEditing(null);
        } catch (err) {
            throw new Error(isApiError(err) ? err.message : 'Failed to save organization');
        }
    };

    const confirmDelete = () => {
        if (!pendingDelete) return;
        deleteMutation.mutate(pendingDelete.id, {
            onSuccess: () => toast.rbac.organizationDeleted(),
            onError: (err) => toast.error('Delete failed', err instanceof Error ? err.message : 'Unknown error'),
            onSettled: () => setPendingDelete(null),
        });
    };

    const columns = useMemo(
        () => [
            ...createColumns<OrganizationRecord>([
                {
                    key: 'name',
                    header: 'Organization',
                    cell: ({ row }) => <span className="font-medium">{row.name}</span>,
                },
                {
                    key: 'slug',
                    header: 'Slug',
                    cell: ({ row }) => <code className="font-mono text-xs text-muted-foreground">{row.slug}</code>,
                },
                { key: 'plan', header: 'Plan', width: 110, cell: ({ row }) => <Chip>{row.plan}</Chip> },
                {
                    key: 'status',
                    header: 'Status',
                    width: 130,
                    cell: ({ row }) => <Chip dot={STATUS_DOT[row.status] ?? 'muted'}>{row.status}</Chip>,
                },
                {
                    key: 'createdAt',
                    header: 'Created',
                    width: 130,
                    cell: ({ row }) => <span className="text-muted-foreground">{formatShortDate(row.createdAt)}</span>,
                },
            ]),
            actionsColumn<OrganizationRecord>([
                { label: 'Edit', icon: Pencil, onClick: setEditing },
                { label: 'Delete', icon: Trash2, variant: 'destructive', onClick: setPendingDelete },
            ]),
        ],
        [],
    );

    const { table } = useDataTable<OrganizationRecord>({
        data: organizations,
        columns,
        getRowId: (row) => row.id,
        initialPageSize: 25,
    });

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-7 w-7 text-primary" />
                        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Organizations</h1>
                    </div>
                    <p className="text-muted-foreground">Every tenant on this site. Open one to manage its members.</p>
                </div>
                <Button onClick={() => setEditing('new')} className="shrink-0 gap-2">
                    <Plus className="h-4 w-4" />
                    New organization
                </Button>
            </header>

            {error && <Alert variant="destructive">{error.message}</Alert>}

            <DataTable
                table={table}
                isLoading={isLoading}
                onRowClick={openMembers}
                emptyIcon={Building2}
                emptyMessage="No organizations yet. Create the first one."
                searchPlaceholder="Search by name, slug, plan or status"
                pageSizeOptions={[25, 50, 100]}
            />

            <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editing === 'new' ? 'New organization' : 'Edit organization'}</DialogTitle>
                        <DialogDescription>
                            {editing === 'new' ? 'Create a new tenant.' : 'Update the details and settings.'}
                        </DialogDescription>
                    </DialogHeader>
                    {editing && (
                        <OrganizationForm
                            key={editing === 'new' ? 'new' : editing.id}
                            organization={editing === 'new' ? null : editing}
                            onSubmit={save}
                            onCancel={() => setEditing(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={pendingDelete !== null}
                onOpenChange={(open) => !open && setPendingDelete(null)}
                title={`Delete ${pendingDelete?.name ?? 'this organization'}?`}
                description="Its members lose access and everything it owns goes with it. This cannot be undone."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={confirmDelete}
                confirmProps={{ disabled: deleteMutation.isPending }}
            />
        </div>
    );
}
