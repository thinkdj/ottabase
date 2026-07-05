/**
 * Admin Blog Tags Page
 *
 * Table view of all tags with right-panel edit/create Sheet.
 */
import { generateSlug } from '@ottabase/ottablog';
import { createModelHooks } from '@ottabase/ottaorm/client';
import { ConfirmDialog } from '@ottabase/ui-components';
import {
    Badge,
    Button,
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

const CHIP_CLASS =
    'rounded-full border-transparent bg-background text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border';

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
        <div className="space-y-8">
            <BlogAdminNav />

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Tags</h1>
                    <p className="text-muted-foreground">Manage blog tags</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Tag
                </Button>
            </div>

            {/* Tags list */}
            <section className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        Tags
                        <span className="inline-flex items-center rounded-full bg-background px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground ring-1 ring-border">
                            {filteredTags.length} tag{filteredTags.length !== 1 ? 's' : ''}
                        </span>
                    </h2>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search tags..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 pl-10"
                        />
                    </div>
                </div>

                {isLoading ? (
                    <div className="space-y-3" aria-busy="true">
                        <span className="sr-only">Loading tags...</span>
                        {Array.from({ length: 5 }, (_, index) => (
                            <div key={index} className="h-12 animate-pulse rounded-xl bg-muted/40" />
                        ))}
                    </div>
                ) : filteredTags.length === 0 ? (
                    <div className="rounded-xl bg-muted/40 py-12 text-center">
                        <Tag className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mt-4 text-sm font-medium">No tags found</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
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
                    <div className="overflow-hidden rounded-xl border border-border/60">
                        <div className="divide-y divide-border/60">
                            {filteredTags.map((tag) => (
                                <div
                                    key={tag.id}
                                    className="flex cursor-pointer items-center justify-between p-3 transition-colors duration-normal hover:bg-muted/40"
                                    onClick={() => setEditingTag(tag)}
                                >
                                    <div className="flex items-center gap-3">
                                        {tag.color && (
                                            <span
                                                className="h-4 w-4 rounded-full ring-1 ring-border"
                                                style={{ backgroundColor: tag.color }}
                                            />
                                        )}
                                        <span className="text-sm font-medium">{tag.name}</span>
                                        <Badge variant="outline" className={CHIP_CLASS}>
                                            {tag.slug}
                                        </Badge>
                                        {tag.type && tag.type !== 'post' && (
                                            <Badge
                                                variant="outline"
                                                className={`uppercase tracking-wide ${CHIP_CLASS}`}
                                            >
                                                {tag.type}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
                                            className="h-8 w-8"
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
                    </div>
                )}
            </section>

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
                                        className="h-10 w-10 rounded-md ring-1 ring-border"
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
            <ConfirmDialog
                open={!!deleteDialog}
                onOpenChange={(open) => !open && setDeleteDialog(null)}
                title="Delete Tag"
                description={`Are you sure you want to delete "${deleteDialog?.name}"? This cannot be undone.`}
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText="Delete"
                onConfirm={handleConfirmDelete}
            />
        </div>
    );
}
