/**
 * Admin Blog Tags Page
 *
 * Table view of all tags with right-panel edit/create Sheet.
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
} from '@ottabase/ui-shadcn';
import { Edit, Loader2, Plus, Search, Tag, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { BlogAdminNav } from './BlogAdminNav';

interface BlogTag {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    type: string | null;
    createdAt: string;
}

const blogTagHooks = createModelHooks<BlogTag>({ entityName: 'post_tags' });

export function AdminBlogTagsPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [editingTag, setEditingTag] = useState<BlogTag | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null);

    // Form state for Sheet
    const [formName, setFormName] = useState('');
    const [formSlug, setFormSlug] = useState('');
    const [formColor, setFormColor] = useState('');
    const [formType, setFormType] = useState('post');

    const { data: tagsData, isLoading } = blogTagHooks.useList(undefined, { staleTime: 30_000 });
    const tags: BlogTag[] = useMemo(() => {
        if (Array.isArray(tagsData)) return tagsData;
        return (tagsData as { data?: BlogTag[] } | undefined)?.data ?? [];
    }, [tagsData]);

    const createTag = blogTagHooks.useCreate();
    const updateTag = blogTagHooks.useUpdate();
    const deleteTag = blogTagHooks.useDelete();

    const filteredTags = searchQuery
        ? tags.filter(
              (tag) =>
                  tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  tag.slug.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : tags;

    const sheetOpen = isCreating || editingTag !== null;

    // Populate form when editing
    useEffect(() => {
        if (editingTag) {
            setFormName(editingTag.name);
            setFormSlug(editingTag.slug);
            setFormColor(editingTag.color ?? '');
            setFormType(editingTag.type ?? 'post');
        }
    }, [editingTag]);

    const resetForm = () => {
        setFormName('');
        setFormSlug('');
        setFormColor('');
        setFormType('post');
    };

    const openCreate = () => {
        resetForm();
        setEditingTag(null);
        setIsCreating(true);
    };

    const closeSheet = () => {
        setIsCreating(false);
        setEditingTag(null);
    };

    const handleSave = async () => {
        if (!formName.trim()) return;
        const slug = formSlug.trim() || generateSlug(formName.trim());
        const payload = {
            name: formName.trim(),
            slug,
            color: formColor.trim() || undefined,
            type: formType || 'post',
        };

        if (editingTag) {
            await updateTag.mutateAsync({ id: editingTag.id, data: payload });
        } else {
            await createTag.mutateAsync(payload);
        }
        closeSheet();
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;
        try {
            await deleteTag.mutateAsync(deleteDialog.id);
        } catch {
            // handled
        } finally {
            setDeleteDialog(null);
        }
    };

    const isSaving = createTag.isPending || updateTag.isPending;

    return (
        <div className="space-y-6">
            <BlogAdminNav />

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Tags</h1>
                    <p className="text-muted-foreground mt-1">Manage blog tags</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Tag
                </Button>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search tags..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Tags Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <Tag className="h-5 w-5" />
                            Tags
                        </span>
                        {isLoading && <span className="text-sm font-normal text-muted-foreground">Loading...</span>}
                    </CardTitle>
                    <CardDescription>
                        {filteredTags.length} tag{filteredTags.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredTags.length === 0 ? (
                        <div className="text-center py-12">
                            <Tag className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mt-4 text-lg font-semibold">No tags found</h3>
                            <p className="mt-2 text-muted-foreground">
                                {tags.length === 0
                                    ? 'Get started by creating your first tag.'
                                    : 'Try adjusting your search.'}
                            </p>
                            {tags.length === 0 && (
                                <Button className="mt-4" onClick={openCreate}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Tag
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredTags.map((tag) => (
                                <div
                                    key={tag.id}
                                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                                    onClick={() => setEditingTag(tag)}
                                >
                                    <div className="flex items-center gap-3">
                                        {tag.color && (
                                            <span
                                                className="h-4 w-4 rounded-full border"
                                                style={{ backgroundColor: tag.color }}
                                            />
                                        )}
                                        <span className="font-medium">{tag.name}</span>
                                        <Badge variant="outline" className="text-xs">
                                            {tag.slug}
                                        </Badge>
                                        {tag.type && tag.type !== 'post' && (
                                            <Badge variant="secondary" className="text-xs">
                                                {tag.type}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingTag(tag);
                                            }}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteDialog({ id: tag.id, name: tag.name });
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
                        <SheetTitle>{editingTag ? 'Edit Tag' : 'New Tag'}</SheetTitle>
                        <SheetDescription>{editingTag ? 'Update this tag' : 'Create a new blog tag'}</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-4 mt-6">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="Tag name"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Slug</Label>
                            <Input
                                value={formSlug}
                                onChange={(e) => setFormSlug(e.target.value)}
                                placeholder={formName ? generateSlug(formName) : 'auto-generated'}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={formColor}
                                    onChange={(e) => setFormColor(e.target.value)}
                                    placeholder="#3b82f6"
                                    className="flex-1"
                                />
                                {formColor && (
                                    <span
                                        className="h-10 w-10 rounded-md border"
                                        style={{ backgroundColor: formColor }}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Input value={formType} onChange={(e) => setFormType(e.target.value)} placeholder="post" />
                        </div>
                        <Button onClick={handleSave} disabled={!formName.trim() || isSaving} className="w-full">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingTag ? 'Update Tag' : 'Create Tag'}
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Tag</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{deleteDialog?.name}&quot;? This cannot be undone.
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
