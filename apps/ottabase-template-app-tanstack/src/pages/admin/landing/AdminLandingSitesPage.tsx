'use client';

import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
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
    Input,
} from '@ottabase/ui-shadcn';
import { Globe, Plus, Settings, Trash2 } from 'lucide-react';
import { landingSiteHooks, type LandingSiteItem } from '@/hooks/landingHooks';

export function AdminLandingSitesPage() {
    const navigate = useNavigate();
    const { data, isLoading, error, refetch } = landingSiteHooks.useList({ perPage: 50 });
    const createMutation = landingSiteHooks.useCreate();
    const deleteMutation = landingSiteHooks.useDelete();

    const [deleteTarget, setDeleteTarget] = useState<LandingSiteItem | null>(null);

    const sites = (Array.isArray(data) ? data : []) as LandingSiteItem[];

    const handleCreate = async () => {
        try {
            const result = await createMutation.mutateAsync({
                name: 'New Site',
                tagline: 'Edit this site to get started',
                themeId: 'atlas',
            } as any);
            refetch();
            if (result?.id) {
                navigate({ to: '/admin/landing/sites/$siteId', params: { siteId: result.id } });
            }
        } catch {
            // handled by mutation
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteMutation.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
            refetch();
        } catch {
            // handled by mutation
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Landing Sites</h1>
                    <p className="text-muted-foreground mt-1">Manage your marketing landing page sites.</p>
                </div>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Site
                </Button>
            </div>

            {/* Error */}
            {error && (
                <Card className="border-destructive">
                    <CardContent className="pt-6">
                        <p className="text-sm text-destructive">Failed to load sites: {error.message}</p>
                    </CardContent>
                </Card>
            )}

            {/* Sites list */}
            <Card>
                <CardHeader>
                    <CardTitle>Sites</CardTitle>
                    <CardDescription>Each site has its own pages, sections, theme, and navigation.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
                    ) : sites.length === 0 ? (
                        <div className="text-center py-12">
                            <Globe className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mt-4 text-lg font-semibold">No sites yet</h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                Create your first landing site to get started.
                            </p>
                            <Button className="mt-4" onClick={handleCreate} disabled={createMutation.isPending}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Site
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sites.map((site) => (
                                <div
                                    key={site.id}
                                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                                >
                                    <Link
                                        to="/admin/landing/sites/$siteId"
                                        params={{ siteId: site.id }}
                                        className="flex-1 min-w-0"
                                    >
                                        <div className="flex items-center gap-3">
                                            <Globe className="h-5 w-5 text-muted-foreground shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-foreground truncate">
                                                    {site.name}
                                                </p>
                                                {site.tagline && (
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {site.tagline}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                    <div className="flex items-center gap-2 ml-4 shrink-0">
                                        <Badge variant="secondary">{site.themeId}</Badge>
                                        <Link to="/admin/landing/sites/$siteId" params={{ siteId: site.id }}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <Settings className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                            onClick={() => setDeleteTarget(site)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete confirmation */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete site?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{deleteTarget?.name}" and all its pages and sections. This
                            action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
