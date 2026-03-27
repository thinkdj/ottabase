/**
 * Admin Blog Categories Page
 *
 * Table view of categories with tree/hierarchy display and right-panel edit/create Sheet.
 */
import { generateSlug } from '@ottabase/ottablog';
import { createModelHooks } from '@ottabase/ottaorm/client';
import { OttaSelect, type OttaSelectItem } from '@ottabase/ottaselect';
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
import { ChevronRight, Edit, FolderTree, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BlogAdminNav } from './BlogAdminNav';

interface BlogCategory {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    parentId: string | null;
    sortOrder: number | null;
    type: string | null;
    createdAt: string;
}

const blogCategoryHooks = createModelHooks<BlogCategory>({ entityName: 'categories' });

// Build a nested tree from flat list
interface TreeCategory extends BlogCategory {
    children: TreeCategory[];
    depth: number;
}

function buildTree(categories: BlogCategory[]): TreeCategory[] {
    const map = new Map<string, TreeCategory>();
    const roots: TreeCategory[] = [];

    // First pass: create tree nodes
    for (const cat of categories) {
        map.set(cat.id, { ...cat, children: [], depth: 0 });
    }

    // Second pass: wire parent → child
    for (const cat of categories) {
        const node = map.get(cat.id)!;
        if (cat.parentId && map.has(cat.parentId)) {
            const parent = map.get(cat.parentId)!;
            node.depth = parent.depth + 1;
            parent.children.push(node);
        } else {
            roots.push(node);
        }
    }

    // Sort children by sortOrder
    const sortChildren = (nodes: TreeCategory[]) => {
        nodes.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        for (const node of nodes) sortChildren(node.children);
    };
    sortChildren(roots);

    return roots;
}

// Flatten tree into display order
function flattenTree(nodes: TreeCategory[]): TreeCategory[] {
    const result: TreeCategory[] = [];
    const walk = (list: TreeCategory[], depth: number) => {
        for (const node of list) {
            result.push({ ...node, depth });
            walk(node.children, depth + 1);
        }
    };
    walk(nodes, 0);
    return result;
}

export function AdminBlogCategoriesPage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [editingCategory, setEditingCategory] = useState<BlogCategory | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formSlug, setFormSlug] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formParentId, setFormParentId] = useState<string | null>(null);
    const [formSortOrder, setFormSortOrder] = useState(0);
    const [formType, setFormType] = useState('post');

    const { data: categoriesData, isLoading } = blogCategoryHooks.useList(undefined, { staleTime: 30_000 });
    const categories: BlogCategory[] = useMemo(() => {
        if (Array.isArray(categoriesData)) return categoriesData;
        return (categoriesData as { data?: BlogCategory[] } | undefined)?.data ?? [];
    }, [categoriesData]);

    const createCategory = blogCategoryHooks.useCreate();
    const updateCategory = blogCategoryHooks.useUpdate();
    const deleteCategory = blogCategoryHooks.useDelete();

    const tree = useMemo(() => buildTree(categories), [categories]);
    const flatList = useMemo(() => flattenTree(tree), [tree]);

    const filteredList = searchQuery
        ? flatList.filter(
              (cat) =>
                  cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  cat.slug.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : flatList;

    const sheetOpen = isCreating || editingCategory !== null;

    // Build parent label for display
    const categoryLabel = useCallback(
        (cat: BlogCategory): string => {
            if (!cat.parentId) return cat.name;
            const parent = categories.find((c) => c.id === cat.parentId);
            return parent ? `${categoryLabel(parent)} > ${cat.name}` : cat.name;
        },
        [categories],
    );

    // OttaSelect items for parent picker (exclude self and descendants when editing)
    const parentItems = useMemo<OttaSelectItem[]>(() => {
        let eligible = categories;
        if (editingCategory) {
            // Collect all descendant IDs to prevent circular nesting
            const descendantIds = new Set<string>();
            const collectDescendants = (parentId: string) => {
                for (const cat of categories) {
                    if (cat.parentId === parentId && !descendantIds.has(cat.id)) {
                        descendantIds.add(cat.id);
                        collectDescendants(cat.id);
                    }
                }
            };
            descendantIds.add(editingCategory.id);
            collectDescendants(editingCategory.id);
            eligible = categories.filter((c) => !descendantIds.has(c.id));
        }
        return eligible.map((c) => ({ id: c.id, name: categoryLabel(c) }));
    }, [categories, editingCategory, categoryLabel]);

    const selectedParentItem = useMemo<OttaSelectItem | null>(() => {
        if (!formParentId) return null;
        return parentItems.find((p) => p.id === formParentId) ?? null;
    }, [formParentId, parentItems]);

    // Populate form when editing
    useEffect(() => {
        if (editingCategory) {
            setFormName(editingCategory.name);
            setFormSlug(editingCategory.slug);
            setFormDescription(editingCategory.description ?? '');
            setFormParentId(editingCategory.parentId);
            setFormSortOrder(editingCategory.sortOrder ?? 0);
            setFormType(editingCategory.type ?? 'post');
        }
    }, [editingCategory]);

    const resetForm = () => {
        setFormName('');
        setFormSlug('');
        setFormDescription('');
        setFormParentId(null);
        setFormSortOrder(0);
        setFormType('post');
    };

    const openCreate = () => {
        resetForm();
        setEditingCategory(null);
        setIsCreating(true);
    };

    const closeSheet = () => {
        setIsCreating(false);
        setEditingCategory(null);
    };

    const handleSave = async () => {
        if (!formName.trim()) return;
        const slug = formSlug.trim() || generateSlug(formName.trim());
        const payload = {
            name: formName.trim(),
            slug,
            description: formDescription.trim() || undefined,
            parentId: formParentId || undefined,
            sortOrder: formSortOrder,
            type: formType || 'post',
        };

        if (editingCategory) {
            await updateCategory.mutateAsync({ id: editingCategory.id, data: payload });
        } else {
            await createCategory.mutateAsync(payload);
        }
        closeSheet();
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;
        try {
            await deleteCategory.mutateAsync(deleteDialog.id);
        } catch {
            // handled
        } finally {
            setDeleteDialog(null);
        }
    };

    const isSaving = createCategory.isPending || updateCategory.isPending;

    return (
        <div className="space-y-6">
            <BlogAdminNav />

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
                    <p className="text-muted-foreground mt-1">Manage blog categories</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Category
                </Button>
            </div>

            {/* Search */}
            <Card>
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Search categories..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Categories Tree Table */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <FolderTree className="h-5 w-5" />
                            Categories
                        </span>
                        {isLoading && <span className="text-sm font-normal text-muted-foreground">Loading...</span>}
                    </CardTitle>
                    <CardDescription>
                        {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredList.length === 0 ? (
                        <div className="text-center py-12">
                            <FolderTree className="mx-auto h-12 w-12 text-muted-foreground/50" />
                            <h3 className="mt-4 text-lg font-semibold">No categories found</h3>
                            <p className="mt-2 text-muted-foreground">
                                {categories.length === 0
                                    ? 'Get started by creating your first category.'
                                    : 'Try adjusting your search.'}
                            </p>
                            {categories.length === 0 && (
                                <Button className="mt-4" onClick={openCreate}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Category
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredList.map((cat) => (
                                <div
                                    key={cat.id}
                                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                                    style={{ paddingLeft: `${cat.depth * 24 + 12}px` }}
                                    onClick={() => setEditingCategory(cat)}
                                >
                                    <div className="flex items-center gap-2">
                                        {cat.depth > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                        <span className="font-medium">{cat.name}</span>
                                        <Badge variant="outline" className="text-xs">
                                            {cat.slug}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingCategory(cat);
                                            }}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDeleteDialog({ id: cat.id, name: cat.name });
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
                        <SheetTitle>{editingCategory ? 'Edit Category' : 'New Category'}</SheetTitle>
                        <SheetDescription>
                            {editingCategory ? 'Update this category' : 'Create a new blog category'}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-4 mt-6">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="Category name"
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
                            <Label>Description</Label>
                            <Textarea
                                value={formDescription}
                                onChange={(e) => setFormDescription(e.target.value)}
                                placeholder="Brief description..."
                                rows={3}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Parent Category</Label>
                            <OttaSelect
                                mode="single"
                                items={parentItems}
                                value={selectedParentItem}
                                onChange={(value) => {
                                    setFormParentId((value as OttaSelectItem | null)?.id ?? null);
                                }}
                                searchable
                                clearable
                                placeholder="None (root category)"
                                emptyMessage="No categories available"
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
                        <div className="space-y-2">
                            <Label>Type</Label>
                            <Input value={formType} onChange={(e) => setFormType(e.target.value)} placeholder="post" />
                        </div>
                        <Button onClick={handleSave} disabled={!formName.trim() || isSaving} className="w-full">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {editingCategory ? 'Update Category' : 'Create Category'}
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Delete Confirmation */}
            <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Category</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete &quot;{deleteDialog?.name}&quot;? Child categories will
                            become root-level. This cannot be undone.
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
