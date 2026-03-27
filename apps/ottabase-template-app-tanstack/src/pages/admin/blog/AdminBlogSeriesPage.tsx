/**
 * Admin Blog Series Page
 *
 * Table view of series with right-panel edit/create Sheet.
 */
import { generateSlug } from '@ottabase/ottablog';
import { createModelHooks } from '@ottabase/ottaorm/client';
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
    Label,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    Textarea,
} from '@ottabase/ui-shadcn';
import { CheckCircle, Edit, Layers, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BlogAdminNav } from './BlogAdminNav';

interface BlogSeries {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    isComplete: boolean;
    sortOrder: number | null;
    createdAt: string;
}

const blogSeriesHooks = createModelHooks<BlogSeries>({ entityName: 'series' });

export function AdminBlogSeriesPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [editingSeries, setEditingSeries] = useState<BlogSeries | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<{ id: string; title: string } | null>(null);

    // Form state
    const [formTitle, setFormTitle] = useState('');
    const [formSlug, setFormSlug] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formIsComplete, setFormIsComplete] = useState(false);
    const [formSortOrder, setFormSortOrder] = useState(0);

    const { data: seriesData, isLoading } = blogSeriesHooks.useList(undefined, { staleTime: 30_000 });
    const seriesList: BlogSeries[] = useMemo(() => {
        if (Array.isArray(seriesData)) return seriesData;
        return (seriesData as { data?: BlogSeries[] } | undefined)?.data ?? [];
    }, [seriesData]);

    const createSeries = blogSeriesHooks.useCreate();
    const updateSeries = blogSeriesHooks.useUpdate();
    const deleteSeries = blogSeriesHooks.useDelete();

    const filteredSeries = searchQuery
        ? seriesList.filter(
              (s) =>
                  s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  s.slug.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : seriesList;

    const sheetOpen = isCreating || editingSeries !== null;

    // Populate form when editing
    useEffect(() => {
        if (editingSeries) {
            setFormTitle(editingSeries.title);
            setFormSlug(editingSeries.slug);
            setFormDescription(editingSeries.description ?? '');
            setFormIsComplete(editingSeries.isComplete);
            setFormSortOrder(editingSeries.sortOrder ?? 0);
        }
    }, [editingSeries]);

    const resetForm = () => {
        setFormTitle('');
        setFormSlug('');
        setFormDescription('');
        setFormIsComplete(false);
        setFormSortOrder(0);
    };

    const openCreate = () => {
        resetForm();
        setEditingSeries(null);
        setIsCreating(true);
    };

    const closeSheet = () => {
        setIsCreating(false);
        setEditingSeries(null);
    };

    const handleSave = async () => {
        if (!formTitle.trim()) return;
        const slug = formSlug.trim() || generateSlug(formTitle.trim());
        const payload = {
            title: formTitle.trim(),
            slug,
            description: formDescription.trim() || undefined,
            isComplete: formIsComplete,
            sortOrder: formSortOrder,
        };

        if (editingSeries) {
            await updateSeries.mutateAsync({ id: editingSeries.id, data: payload });
        } else {
            await createSeries.mutateAsync(payload);
        }
        closeSheet();
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;
        try {
            await deleteSeries.mutateAsync(deleteDialog.id);
        } catch {
            // handled
        } finally {
            setDeleteDialog(null);
        }
    };

    const isSaving = createSeries.isPending || updateSeries.isPending;

    return (
        <div className="space-y-6">
            <BlogAdminNav />

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Series</h1>
                    <p className="text-muted-foreground mt-1">Manage blog series</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Series
                </Button>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search series..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Series List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Layers className="h-5 w-5" />
                            Series
                        </span>
                        {isLoading && <span className="text-sm font-normal text-muted-foreground">Loading...</span>}
                    </CardTitle>
                    <CardDescription>{filteredSeries.length} series</CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredSeries.length === 0 ? (
                        <div className="text-center py-12">
                            <Layers className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mt-4 text-lg font-semibold">No series found</h3>
                            <p className="mt-2 text-muted-foreground">
                                {seriesList.length === 0
                                    ? 'Get started by creating your first series.'
                                    : 'Try adjusting your search.'}
                            </p>
                            {seriesList.length === 0 && (
                                <Button className="mt-4" onClick={openCreate}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Series
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredSeries.map((series) => (
                                <div
                                    key={series.id}
                                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                                    onClick={() => setEditingSeries(series)}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="font-medium">{series.title}</span>
                                        <Badge variant="outline" className="text-xs">
                                            {series.slug}
                                        </Badge>
                                        {series.isComplete && (
                                            <Badge variant="default" className="text-xs gap-1">
                                                <CheckCircle className="h-3 w-3" />
                                                Complete
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingSeries(series);
                                            }}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteDialog({ id: series.id, title: series.title });
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit / Create Sheet */}
            <Sheet open={sheetOpen} onOpenChange={(open) => !open && closeSheet()}>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>{editingSeries ? 'Edit Series' : 'New Series'}</SheetTitle>
                        <SheetDescription>
                            {editingSeries ? 'Update this series' : 'Create a new blog series'}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-4 mt-6">
                        <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                                value={formTitle}
                                onChange={(e) => setFormTitle(e.target.value)}
                                placeholder="Series title"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Slug</Label>
                            <Input
                                value={formSlug}
                                onChange={(e) => setFormSlug(e.target.value)}
                                placeholder={formTitle ? generateSlug(formTitle) : 'auto-generated'}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="What is this series about?"
                                rows={3}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Sort Order</Label>
                            <Input
                                type="number"
                                value={formSortOrder}
                                onChange={(e) => setFormSortOrder(parseInt(e.target.value, 10) || 0)}
                                placeholder="0"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="isComplete"
                                checked={formIsComplete}
                                onChange={(e) => setFormIsComplete(e.target.checked)}
                                className="rounded border-input"
                                aria-label="Mark as complete"
                            />
                            <Label htmlFor="isComplete">Mark as complete</Label>
                        </div>
                        <Button onClick={handleSave} disabled={!formTitle.trim() || isSaving} className="w-full">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingSeries ? 'Update Series' : 'Create Series'}
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Series</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{deleteDialog?.title}&quot;? Posts in this series will
                            be unlinked. This cannot be undone.
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
