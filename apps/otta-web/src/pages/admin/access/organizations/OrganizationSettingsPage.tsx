/**
 * Organization Settings Page
 *
 * Manage organization profile and settings
 */

import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { useDeleteOrganization, useOrganization, useUpdateOrganization } from '@/hooks/useRBAC';
import { useRBACToast } from '@/hooks/useToast';
import type { OrganizationPlan, OrganizationStatus } from '@/types/rbac';
import { organizationIdAtom } from '@/ottabase/state/appState';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
} from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { useSetAtom } from 'jotai';
import { AlertTriangle, ArrowLeft, Building2, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const CURRENT_ORG_KEY = 'ottabase.current-org-id';

interface OrganizationSettingsFormData {
    name: string;
    slug: string;
    plan: OrganizationPlan;
    status: OrganizationStatus;
}

export function OrganizationSettingsPage() {
    const { organizationId } = useParams({ from: '/admin/access/organizations/$organizationId/settings' });
    const toast = useRBACToast();
    const setOrganizationId = useSetAtom(organizationIdAtom);

    const { data: org, isLoading, error, refetch } = useOrganization(organizationId);
    const updateMutation = useUpdateOrganization();
    const deleteMutation = useDeleteOrganization();

    const [formData, setFormData] = useState<OrganizationSettingsFormData>({
        name: '',
        slug: '',
        plan: 'free',
        status: 'active',
    });

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (!organizationId) return;
        setOrganizationId(organizationId);
        try {
            localStorage.setItem(CURRENT_ORG_KEY, organizationId);
        } catch {
            // ignore storage failures
        }
    }, [organizationId, setOrganizationId]);

    // Initialize form data when org loads
    useEffect(() => {
        if (!org) return;

        setFormData({
            name: org.name,
            slug: org.slug,
            plan: org.plan,
            status: org.status,
        });
        setHasChanges(false);
    }, [org]);

    const handleChange = <Field extends keyof OrganizationSettingsFormData>(
        field: Field,
        value: OrganizationSettingsFormData[Field],
    ) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        updateMutation.mutate(
            {
                id: organizationId,
                data: formData,
            },
            {
                onSuccess: () => {
                    toast.rbac.organizationUpdated();
                    setHasChanges(false);
                },
                onError: (error) => {
                    toast.error('Failed to update', error instanceof Error ? error.message : 'Unknown error');
                },
            },
        );
    };

    const handleDelete = async () => {
        deleteMutation.mutate(organizationId, {
            onSuccess: () => {
                toast.rbac.organizationDeleted();
                window.location.href = '/admin/access/organizations';
            },
            onError: (error) => {
                toast.error('Failed to delete', error instanceof Error ? error.message : 'Unknown error');
            },
        });
    };

    if (isLoading) {
        return (
            <div className="max-w-3xl space-y-4" aria-busy="true">
                <span className="sr-only">Loading organization settings…</span>
                <div className="h-8 w-64 animate-pulse rounded-xl bg-muted/40" />
                <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
                <div className="h-40 animate-pulse rounded-xl bg-muted/40" />
            </div>
        );
    }

    if (error || !org) {
        return (
            <ApiErrorDisplay
                error={error instanceof Error ? error : new Error('Organization not found')}
                onRetry={() => refetch()}
            />
        );
    }

    return (
        <div className="max-w-3xl space-y-8">
            {/* Header */}
            <div className="space-y-4">
                <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit gap-1.5 text-muted-foreground">
                    <Link to="/admin/access/organizations">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Organizations
                    </Link>
                </Button>
                <div className="space-y-1.5">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Organization Settings</h1>
                    <p className="max-w-3xl text-muted-foreground">Manage your organization profile and preferences</p>
                </div>
            </div>

            {/* General Settings */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        General
                    </CardTitle>
                    <CardDescription>Basic organization information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Organization ID */}
                    <div className="space-y-2">
                        <Label className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Organization ID
                        </Label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 rounded-md bg-background px-3 py-2 text-sm text-muted-foreground ring-1 ring-border">
                                {org.id}
                            </code>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                    navigator.clipboard.writeText(org.id);
                                    toast.success('Copied', 'Organization ID copied to clipboard');
                                }}
                            >
                                Copy
                            </Button>
                        </div>
                    </div>

                    <Separator className="bg-border/60" />

                    {/* Organization Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Organization Name</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            disabled={updateMutation.isPending}
                        />
                    </div>

                    {/* Slug */}
                    <div className="space-y-2">
                        <Label htmlFor="slug">URL Slug</Label>
                        <Input
                            id="slug"
                            value={formData.slug}
                            onChange={(e) => handleChange('slug', e.target.value)}
                            disabled={updateMutation.isPending}
                        />
                        <p className="text-sm text-muted-foreground">URL: /org/{formData.slug}</p>
                    </div>

                    {/* Plan */}
                    <div className="space-y-2">
                        <Label htmlFor="plan">Plan</Label>
                        <Select
                            value={formData.plan}
                            onValueChange={(value: OrganizationPlan) => handleChange('plan', value)}
                            disabled={updateMutation.isPending}
                        >
                            <SelectTrigger id="plan">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="free">Free</SelectItem>
                                <SelectItem value="pro">Pro</SelectItem>
                                <SelectItem value="enterprise">Enterprise</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                            value={formData.status}
                            onValueChange={(value: OrganizationStatus) => handleChange('status', value)}
                            disabled={updateMutation.isPending}
                        >
                            <SelectTrigger id="status">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">
                                    <div className="flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
                                        Active
                                    </div>
                                </SelectItem>
                                <SelectItem value="cancelled">
                                    <div className="flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
                                        Cancelled
                                    </div>
                                </SelectItem>
                                <SelectItem value="suspended">
                                    <div className="flex items-center gap-2">
                                        <span className="h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />
                                        Suspended
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Created At */}
                    <div className="space-y-2">
                        <Label className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Created
                        </Label>
                        <p className="text-sm text-muted-foreground">{new Date(org.createdAt).toLocaleString()}</p>
                    </div>

                    {/* Updated At */}
                    <div className="space-y-2">
                        <Label className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Last Updated
                        </Label>
                        <p className="text-sm text-muted-foreground">{new Date(org.updatedAt).toLocaleString()}</p>
                    </div>

                    {/* Owner ID */}
                    <div className="space-y-2">
                        <Label className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Owner ID
                        </Label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 rounded-md bg-background px-3 py-2 text-sm text-muted-foreground ring-1 ring-border">
                                {org.ownerId}
                            </code>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                    navigator.clipboard.writeText(org.ownerId);
                                    toast.success('Copied', 'Owner ID copied to clipboard');
                                }}
                            >
                                Copy
                            </Button>
                        </div>
                    </div>

                    {/* Settings */}
                    <div className="space-y-2">
                        <Label className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Settings
                        </Label>
                        <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs text-muted-foreground ring-1 ring-border">
                            {JSON.stringify(org.settings ?? {}, null, 2)}
                        </pre>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-2">
                        <Label className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            Metadata
                        </Label>
                        <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs text-muted-foreground ring-1 ring-border">
                            {JSON.stringify(org.metadata ?? {}, null, 2)}
                        </pre>
                    </div>

                    {/* Save Button */}
                    {hasChanges && (
                        <div className="pt-4">
                            <Button
                                onClick={handleSave}
                                disabled={updateMutation.isPending}
                                className="w-full sm:w-auto"
                            >
                                {updateMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="rounded-xl border-transparent bg-muted/40 shadow-none">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[0.9375rem] font-semibold text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                        Danger Zone
                    </CardTitle>
                    <CardDescription>Irreversible actions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        <p className="font-medium">Delete Organization</p>
                        <p className="mt-1">
                            This will permanently delete the organization and all associated data including members,
                            roles, and audit logs. This action cannot be undone.
                        </p>
                    </div>

                    <Button
                        variant="destructive"
                        onClick={() => setShowDeleteDialog(true)}
                        disabled={deleteMutation.isPending}
                        className="w-full sm:w-auto"
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Organization
                    </Button>
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Are you absolutely sure?"
                description={
                    <>
                        This will permanently delete <strong>{org.name}</strong> and all associated data. This action
                        cannot be undone.
                    </>
                }
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete Permanently"
                onConfirm={handleDelete}
            />
        </div>
    );
}
