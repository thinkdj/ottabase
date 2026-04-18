/**
 * Organization Settings Page
 *
 * Manage organization profile and settings
 * GitHub-like minimal UI with dark mode support
 */

import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { useDeleteOrganization, useOrganization, useUpdateOrganization } from '@/hooks/useRBAC';
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
import { useSetAtom } from 'jotai';
import { AlertTriangle, Building2, Loader2, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const CURRENT_ORG_KEY = 'ottabase.current-org-id';

export function OrganizationSettingsPage() {
    const { organizationId } = useParams({ from: '/organizations/$organizationId/settings' });
    const toast = useRBACToast();
    const setOrganizationId = useSetAtom(organizationIdAtom);

    const { data: org, isLoading, error, refetch } = useOrganization(organizationId);
    const updateMutation = useUpdateOrganization();
    const deleteMutation = useDeleteOrganization();

    const [formData, setFormData] = useState({
        name: '',
        slug: '',
        plan: 'free' as 'free' | 'pro' | 'enterprise',
        status: 'active' as 'active' | 'suspended' | 'trial',
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
            status: org.status === 'deleted' ? 'suspended' : org.status,
        });
        setHasChanges(false);
    }, [org]);

    const handleChange = (field: string, value: string) => {
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
                window.location.href = '/organizations';
            },
            onError: (error) => {
                toast.error('Failed to delete', error instanceof Error ? error.message : 'Unknown error');
            },
        });
    };

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
        <div className="space-y-6 max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Organization Settings</h1>
                    <p className="text-muted-foreground mt-1">Manage your organization profile and preferences</p>
                </div>
                <Button variant="outline" asChild>
                    <Link to="/organizations">← Back</Link>
                </Button>
            </div>

            {/* General Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5" />
                        General
                    </CardTitle>
                    <CardDescription>Basic organization information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Organization ID */}
                    <div className="space-y-2">
                        <Label>Organization ID</Label>
                        <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-3 py-2 rounded flex-1">{org.id}</code>
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
                            onValueChange={(value) => handleChange('plan', value)}
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
                            onValueChange={(value) => handleChange('status', value)}
                            disabled={updateMutation.isPending}
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
                                <SelectItem value="trial">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="secondary">Trial</Badge>
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

                    {/* Created At */}
                    <div className="space-y-2">
                        <Label>Created</Label>
                        <p className="text-sm text-muted-foreground">{new Date(org.createdAt).toLocaleString()}</p>
                    </div>

                    {/* Updated At */}
                    <div className="space-y-2">
                        <Label>Last Updated</Label>
                        <p className="text-sm text-muted-foreground">{new Date(org.updatedAt).toLocaleString()}</p>
                    </div>

                    {/* Owner ID */}
                    <div className="space-y-2">
                        <Label>Owner ID</Label>
                        <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-3 py-2 rounded flex-1">{org.ownerId}</code>
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

                    {/* Settings */}
                    <div className="space-y-2">
                        <Label>Settings</Label>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                            {JSON.stringify(org.settings ?? {}, null, 2)}
                        </pre>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-2">
                        <Label>Metadata</Label>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
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
            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        Danger Zone
                    </CardTitle>
                    <CardDescription>Irreversible actions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Delete Organization</AlertTitle>
                        <AlertDescription>
                            This will permanently delete the organization and all associated data including members,
                            roles, and audit logs. This action cannot be undone.
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
