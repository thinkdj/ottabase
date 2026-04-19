import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import {
    useCurrentOrganizationUpdate,
    useDeleteOrganization,
    useOrganization,
    usePlatformUpdateOrganization,
} from '@/hooks/useRBAC';
import { useRBACToast } from '@/hooks/useToast';
import { organizationIdAtom } from '@/ottabase/state/appState';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Alert,
    AlertDescription,
    AlertTitle,
    Badge,
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
import { useAtomValue } from 'jotai';
import { AlertTriangle, Building2, Loader2, Trash2 } from 'lucide-react';
import type { OrganizationStatus } from '@/types/rbac';
import { useEffect, useState } from 'react';

export function OrganizationSettingsPage() {
    const toast = useRBACToast();
    const { organizationId } = useParams({ strict: false }) as { organizationId?: string };
    const currentOrganizationId = useAtomValue(organizationIdAtom);
    const isPlatformMode = Boolean(organizationId);
    const scopedOrganizationId = isPlatformMode ? organizationId : undefined;
    const hasOrganizationContext = isPlatformMode ? !!organizationId : !!currentOrganizationId;

    const {
        data: org,
        isLoading,
        error,
        refetch,
    } = useOrganization(scopedOrganizationId, {
        enabled: hasOrganizationContext,
    });
    const currentUpdateMutation = useCurrentOrganizationUpdate();
    const platformUpdateMutation = usePlatformUpdateOrganization();
    const deleteMutation = useDeleteOrganization();

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        plan: 'free' as 'free' | 'pro' | 'enterprise',
        status: 'active' as OrganizationStatus,
    });
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

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

    const activeUpdateMutation = isPlatformMode ? platformUpdateMutation : currentUpdateMutation;

    const handleChange = (field: string, value: string) => {
        setFormData((previous) => ({ ...previous, [field]: value }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        if (!org) return;

        if (isPlatformMode && scopedOrganizationId) {
            platformUpdateMutation.mutate(
                {
                    id: scopedOrganizationId,
                    data: formData,
                },
                {
                    onSuccess: () => {
                        toast.rbac.organizationUpdated();
                        setHasChanges(false);
                    },
                    onError: (updateError) => {
                        toast.error(
                            'Failed to update',
                            updateError instanceof Error ? updateError.message : 'Unknown error',
                        );
                    },
                },
            );
            return;
        }

        currentUpdateMutation.mutate(
            { name: formData.name },
            {
                onSuccess: () => {
                    toast.rbac.organizationUpdated();
                    setHasChanges(false);
                },
                onError: (updateError) => {
                    toast.error(
                        'Failed to update',
                        updateError instanceof Error ? updateError.message : 'Unknown error',
                    );
                },
            },
        );
    };

    const handleDelete = async () => {
        if (!scopedOrganizationId) return;

        deleteMutation.mutate(scopedOrganizationId, {
            onSuccess: () => {
                toast.rbac.organizationDeleted();
                window.location.href = '/admin/platform/organizations';
            },
            onError: (deleteError) => {
                toast.error('Failed to delete', deleteError instanceof Error ? deleteError.message : 'Unknown error');
            },
        });
    };

    if (!hasOrganizationContext) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>No organization selected</CardTitle>
                    <CardDescription>
                        Select an organization from the switcher or create one to edit settings.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Button asChild>
                        <Link to="/onboarding/organization">Create Organization</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link to="/dashboard">Back to Dashboard</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <TableSkeleton rows={3} columns={1} />
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
        <div className="max-w-3xl space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">
                        {isPlatformMode ? 'Tenant Settings' : 'Organization Settings'}
                    </h1>
                    <p className="mt-1 text-muted-foreground">
                        {isPlatformMode
                            ? 'Platform-admin controls for tenant profile, lifecycle, and support actions.'
                            : 'Update the current organization profile. Billing and lifecycle controls stay at platform scope.'}
                    </p>
                </div>
                <Button variant="outline" asChild>
                    {isPlatformMode ? (
                        <Link to="/admin/platform/organizations">← Back to Tenant Directory</Link>
                    ) : (
                        <Link to="/admin/organization/members">← Back to Members</Link>
                    )}
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        General
                    </CardTitle>
                    <CardDescription>
                        {isPlatformMode
                            ? 'Basic tenant profile and lifecycle controls.'
                            : 'Basic details for the current organization.'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Organization ID</Label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm">{org.id}</code>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    navigator.clipboard.writeText(org.id);
                                    toast.success('Copied', 'Organization ID copied to clipboard');
                                }}
                            >
                                Copy
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                        <Label htmlFor="name">Organization Name</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(event) => handleChange('name', event.target.value)}
                            disabled={activeUpdateMutation.isPending}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="slug">URL Slug</Label>
                        <Input
                            id="slug"
                            value={formData.slug}
                            onChange={(event) => handleChange('slug', event.target.value)}
                            disabled={!isPlatformMode || activeUpdateMutation.isPending}
                        />
                        <p className="text-sm text-muted-foreground">URL: /org/{formData.slug}</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="plan">Plan</Label>
                        <Select
                            value={formData.plan}
                            onValueChange={(value) => handleChange('plan', value)}
                            disabled={!isPlatformMode || activeUpdateMutation.isPending}
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

                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select
                            value={formData.status}
                            onValueChange={(value) => handleChange('status', value)}
                            disabled={!isPlatformMode || activeUpdateMutation.isPending}
                        >
                            <SelectTrigger id="status">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="default">Active</Badge>
                                    </div>
                                </SelectItem>
                                <SelectItem value="cancelled">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary">Cancelled</Badge>
                                    </div>
                                </SelectItem>
                                <SelectItem value="suspended">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="destructive">Suspended</Badge>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {!isPlatformMode && (
                        <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Platform-only fields</AlertTitle>
                            <AlertDescription>
                                Slug, plan, status, offboarding, and deletion are reserved for the platform tenant
                                directory.
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label>Created</Label>
                        <p className="text-sm text-muted-foreground">{new Date(org.createdAt).toLocaleString()}</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Last Updated</Label>
                        <p className="text-sm text-muted-foreground">{new Date(org.updatedAt).toLocaleString()}</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Owner ID</Label>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm">{org.ownerId}</code>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    navigator.clipboard.writeText(org.ownerId);
                                    toast.success('Copied', 'Owner ID copied to clipboard');
                                }}
                            >
                                Copy
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Settings</Label>
                        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                            {JSON.stringify(org.settings ?? {}, null, 2)}
                        </pre>
                    </div>

                    <div className="space-y-2">
                        <Label>Metadata</Label>
                        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                            {JSON.stringify(org.metadata ?? {}, null, 2)}
                        </pre>
                    </div>

                    {hasChanges && (
                        <div className="pt-4">
                            <Button
                                onClick={handleSave}
                                disabled={activeUpdateMutation.isPending}
                                className="w-full sm:w-auto"
                            >
                                {activeUpdateMutation.isPending ? (
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

            {isPlatformMode && (
                <Card className="border-destructive">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Danger Zone
                        </CardTitle>
                        <CardDescription>Irreversible platform-admin actions.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Delete Organization</AlertTitle>
                            <AlertDescription>
                                This permanently deletes the tenant and all associated data. This action cannot be
                                undone.
                            </AlertDescription>
                        </Alert>

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
            )}

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
