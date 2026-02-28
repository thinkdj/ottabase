// ---------------------------------------------------------------------------
// Menu detail – Edit menu, add/edit/delete items (Ottamenu)
// ---------------------------------------------------------------------------

import type { MenuItemTreeNode } from '@ottabase/ottamenu';
import { buildItemTree, renderMenu } from '@ottabase/ottamenu';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
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
    Switch,
} from '@ottabase/ui-shadcn';
import { IconEye, IconPlus, IconTrash, IconUpload, IconX } from '@tabler/icons-react';
import { useBrand } from '@ottabase/brand-engine-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { menuApi, type MenuItemDto, type MenuRenderType, type MenuWithItemsDto } from './menus/menuApi';

export function AdminMenuDetailPage() {
    const { menuId } = useParams({ strict: false, from: '/admin/menus/$menuId' });
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isNew = menuId === 'new';

    const [previewType, setPreviewType] = useState<MenuRenderType>('sidebar');

    const { data: menu, isLoading } = useQuery({
        queryKey: ['menus', menuId],
        queryFn: () => menuApi.get(menuId!),
        enabled: !!menuId && !isNew,
    });

    useEffect(() => {
        if (menu) setPreviewType(menu.type);
    }, [menu?.type]);

    const createMenuMutation = useMutation({
        mutationFn: (body: { name: string; slug: string; type?: MenuRenderType }) => menuApi.create(body),
        onSuccess: (m) => {
            toast.success('Menu created');
            queryClient.invalidateQueries({ queryKey: ['menus'] });
            navigate({ to: '/admin/menus/$menuId', params: { menuId: m.id } });
        },
        onError: () => toast.error('Failed to create'),
    });

    if (isNew) {
        return (
            <MenuCreateView
                onSubmit={(body) => createMenuMutation.mutate({ ...body, slug: body.slug || 'sidebar' })}
                submitting={createMenuMutation.isPending}
            />
        );
    }

    if (isLoading || !menu) {
        return (
            <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Loading menu...</p>
            </div>
        );
    }

    return (
        <div className="flex gap-6">
            <div className="flex-1 min-w-0 space-y-6">
                <div>
                    <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/admin/menus' })}>
                        ← Back to menus
                    </Button>
                </div>
                <MenuEditForm menu={menu} onTypeChange={setPreviewType} />
                <MenuItemsEditor menu={menu} />
            </div>
            <div className="w-72 shrink-0">
                <MenuPreviewPanel menu={menu} type={previewType} />
            </div>
        </div>
    );
}

function MenuCreateView({
    onSubmit,
    submitting,
}: {
    onSubmit: (body: { name: string; slug: string; type: MenuRenderType }) => void;
    submitting: boolean;
}) {
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('sidebar');
    const [type, setType] = useState<MenuRenderType>('sidebar');

    return (
        <div className="flex gap-6">
            <div className="flex-1 min-w-0">
                <div className="space-y-6">
                    <div>
                        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                            ← Back
                        </Button>
                    </div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Create Menu</CardTitle>
                            <CardDescription>
                                Create a new menu. Use slug &quot;sidebar&quot; to override the main sidebar nav.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Main Navigation"
                                />
                            </div>
                            <div>
                                <Label htmlFor="slug">Slug</Label>
                                <Input
                                    id="slug"
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value)}
                                    placeholder="sidebar"
                                />
                            </div>
                            <div>
                                <Label htmlFor="type">Default render type</Label>
                                <Select value={type} onValueChange={(v) => setType(v as MenuRenderType)}>
                                    <SelectTrigger id="type">
                                        <SelectValue placeholder="Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="sidebar">Sidebar</SelectItem>
                                        <SelectItem value="flyout">Flyout</SelectItem>
                                        <SelectItem value="mega">Mega Menu</SelectItem>
                                        <SelectItem value="navbar">Navbar</SelectItem>
                                        <SelectItem value="dropdown">Dropdown</SelectItem>
                                        <SelectItem value="footer">Footer</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                onClick={() =>
                                    name.trim()
                                        ? onSubmit({ name: name.trim(), slug: slug.trim(), type })
                                        : toast.error('Name required')
                                }
                                disabled={submitting || !name.trim()}
                            >
                                Create
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
            <div className="w-72 shrink-0">
                <MenuPreviewPanel menu={null} type={type} />
            </div>
        </div>
    );
}

function MenuPreviewPanel({ menu, type }: { menu: MenuWithItemsDto | null; type: MenuRenderType }) {
    const location = useLocation();
    const pathname = location.pathname;
    // Horizontal menu types need more width for a meaningful preview
    const isWide = type === 'mega' || type === 'navbar' || type === 'footer';

    return (
        <Card className="sticky top-4">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    <IconEye className="h-4 w-4" />
                    Preview
                </CardTitle>
                <CardDescription>Preview as {type} (default render type)</CardDescription>
            </CardHeader>
            <CardContent>
                {menu && menu.items.length > 0 ? (
                    <div
                        className={`rounded-md border bg-muted/30 p-3 dark:bg-muted/10 ${
                            isWide ? 'overflow-x-auto' : ''
                        }`}
                    >
                        {renderMenu(menu, type, {
                            isAuthenticated: true,
                            pathname,
                            expanded: isWide,
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {menu ? 'Add items to see preview.' : 'Create the menu and add items to see preview.'}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

function MenuEditForm({ menu, onTypeChange }: { menu: MenuWithItemsDto; onTypeChange?: (t: MenuRenderType) => void }) {
    const queryClient = useQueryClient();
    const { refresh: refreshBrand } = useBrand();
    const [name, setName] = useState(menu.name);
    const [slug, setSlug] = useState(menu.slug);
    const [type, setType] = useState<MenuRenderType>(menu.type);

    useEffect(() => {
        setName(menu.name);
        setSlug(menu.slug);
        setType(menu.type);
    }, [menu.id, menu.name, menu.slug, menu.type]);

    const handleTypeChange = (v: MenuRenderType) => {
        setType(v);
        onTypeChange?.(v);
    };

    const updateMutation = useMutation({
        mutationFn: (body: { name: string; slug: string; type: MenuRenderType }) => menuApi.update(menu.id, body),
        onSuccess: () => {
            toast.success('Menu updated');
            queryClient.invalidateQueries({ queryKey: ['menus'] });
            refreshBrand(); // Layout uses menuSlots with menu data
        },
        onError: () => toast.error('Failed to update'),
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Menu settings</CardTitle>
                <CardDescription>
                    Name, slug, and default render type. Supports sidebar, flyout, mega menu, navbar, dropdown, and
                    footer layouts.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                        id="edit-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Main Navigation"
                    />
                </div>
                <div>
                    <Label htmlFor="edit-slug">Slug</Label>
                    <Input
                        id="edit-slug"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="sidebar"
                    />
                </div>
                <div>
                    <Label htmlFor="edit-type">Default render type</Label>
                    <Select value={type} onValueChange={(v) => handleTypeChange(v as MenuRenderType)}>
                        <SelectTrigger id="edit-type">
                            <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="sidebar">Sidebar</SelectItem>
                            <SelectItem value="flyout">Flyout</SelectItem>
                            <SelectItem value="mega">Mega Menu</SelectItem>
                            <SelectItem value="navbar">Navbar</SelectItem>
                            <SelectItem value="dropdown">Dropdown</SelectItem>
                            <SelectItem value="footer">Footer</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={() => updateMutation.mutate({ name, slug, type })} disabled={updateMutation.isPending}>
                    Save
                </Button>
            </CardContent>
        </Card>
    );
}

function MenuItemsEditor({ menu }: { menu: MenuWithItemsDto }) {
    const queryClient = useQueryClient();
    const { refresh: refreshBrand } = useBrand();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newItemParentId, setNewItemParentId] = useState<string | null | undefined>(undefined);
    const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

    const refreshMenuAndBrand = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['menus', menu.id] });
        refreshBrand(); // Layout (header/sidebar/footer) uses menuSlots from brand config
    }, [queryClient, menu.id, refreshBrand]);

    const createItemMutation = useMutation({
        mutationFn: (body: Partial<MenuItemDto>) => menuApi.createItem(menu.id, body),
        onSuccess: () => {
            toast.success('Item added');
            refreshMenuAndBrand();
            setNewItemParentId(undefined);
        },
        onError: () => toast.error('Failed to add'),
    });

    const deleteItemMutation = useMutation({
        mutationFn: async (itemId: string) => {
            // Delete children first (post-order) to satisfy FK
            const idsToDelete = collectDescendantIds(tree, itemId);
            for (const id of idsToDelete) {
                await menuApi.deleteItem(menu.id, id);
            }
            await menuApi.deleteItem(menu.id, itemId);
        },
        onSuccess: () => {
            toast.success('Item removed');
            refreshMenuAndBrand();
        },
        onError: () => toast.error('Failed to remove'),
    });

    const tree = buildItemTree(menu.items);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Menu items</CardTitle>
                <CardDescription>
                    Items can be nested. Use &quot;Add child&quot; to create sub-items. Each item: name, link, optional
                    newTab, authRequired.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                {tree.map((node) => (
                    <ItemTreeNode
                        key={node.item.id}
                        node={node}
                        menuId={menu.id}
                        allItems={menu.items}
                        editingId={editingId}
                        setEditingId={setEditingId}
                        onAddChild={(parentId) => setNewItemParentId(parentId)}
                        onDelete={(id) => setDeleteItemId(id)}
                        onSaved={() => {
                            setEditingId(null);
                            refreshMenuAndBrand();
                        }}
                    />
                ))}
                {newItemParentId !== undefined ? (
                    <ItemForm
                        menuId={menu.id}
                        parentId={newItemParentId ?? null}
                        allItems={menu.items}
                        onSubmit={(body) => createItemMutation.mutate(body)}
                        onCancel={() => setNewItemParentId(undefined)}
                        submitting={createItemMutation.isPending}
                    />
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setNewItemParentId(null)}
                        disabled={menu.items.length >= 100}
                        title={menu.items.length >= 100 ? 'Maximum 100 items per menu' : undefined}
                    >
                        <IconPlus className="h-4 w-4 mr-2" />
                        Add item (top level)
                    </Button>
                )}
            </CardContent>

            <AlertDialog open={deleteItemId !== null} onOpenChange={(open) => !open && setDeleteItemId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Menu Item?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This item and all its children will be removed. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteItemMutation.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deleteItemId) deleteItemMutation.mutate(deleteItemId);
                                setDeleteItemId(null);
                            }}
                            disabled={deleteItemMutation.isPending}
                        >
                            {deleteItemMutation.isPending ? 'Removing…' : 'Remove'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

function ItemTreeNode({
    node,
    menuId,
    allItems,
    editingId,
    setEditingId,
    onAddChild,
    onDelete,
    onSaved,
    depth = 0,
}: {
    node: MenuItemTreeNode;
    menuId: string;
    allItems: MenuItemDto[];
    editingId: string | null;
    setEditingId: (id: string | null) => void;
    onAddChild: (parentId: string) => void;
    onDelete: (id: string) => void;
    onSaved: () => void;
    depth?: number;
}) {
    return (
        <div key={node.item.id} className={depth > 0 ? 'ml-4 border-l border-muted pl-3' : ''}>
            <ItemRow
                item={node.item}
                menuId={menuId}
                allItems={allItems}
                depth={depth}
                editing={editingId === node.item.id}
                onEdit={() => setEditingId(editingId === node.item.id ? null : node.item.id)}
                onAddChild={() => onAddChild(node.item.id)}
                onDelete={() => onDelete(node.item.id)}
                onSaved={onSaved}
            />
            {node.children.map((child) => (
                <ItemTreeNode
                    key={child.item.id}
                    node={child}
                    menuId={menuId}
                    allItems={allItems}
                    editingId={editingId}
                    setEditingId={setEditingId}
                    onAddChild={onAddChild}
                    onDelete={onDelete}
                    onSaved={onSaved}
                    depth={depth + 1}
                />
            ))}
        </div>
    );
}

function ItemRow({
    item,
    menuId,
    allItems,
    depth,
    editing,
    onEdit,
    onAddChild,
    onDelete,
    onSaved,
}: {
    item: MenuItemDto;
    menuId: string;
    allItems: MenuItemDto[];
    depth: number;
    editing: boolean;
    onEdit: () => void;
    onAddChild: () => void;
    onDelete: () => void;
    onSaved: () => void;
}) {
    const updateMutation = useMutation({
        mutationFn: (body: Partial<MenuItemDto>) => menuApi.updateItem(menuId, item.id, body),
        onSuccess: () => {
            toast.success('Item updated');
            onSaved();
        },
        onError: () => toast.error('Failed to update'),
    });

    if (editing) {
        return (
            <ItemForm
                menuId={menuId}
                item={item}
                parentId={item.parentId ?? null}
                allItems={allItems}
                onSubmit={(body) => updateMutation.mutate(body)}
                onCancel={onEdit}
                submitting={updateMutation.isPending}
            />
        );
    }

    return (
        <div className="flex items-center justify-between rounded-lg border p-3">
            {item.image && <img src={item.image} alt="" className="mr-3 h-8 w-8 shrink-0 rounded object-cover" />}
            <div className="min-w-0 flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">
                    {item.link}
                    {item.newTab && ' (new tab)'}
                    {item.authRequired && ' [auth]'}
                </p>
            </div>
            <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="sm" onClick={onEdit}>
                    Edit
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onAddChild}
                    disabled={allItems.length >= 100}
                    title={allItems.length >= 100 ? 'Maximum 100 items per menu' : undefined}
                >
                    Add child
                </Button>
                <Button variant="ghost" size="icon" onClick={onDelete}>
                    <IconTrash className="h-4 w-4 text-destructive" />
                </Button>
            </div>
        </div>
    );
}

function ItemForm({
    menuId,
    item,
    parentId,
    allItems,
    onSubmit,
    onCancel,
    submitting = false,
}: {
    menuId: string;
    item?: MenuItemDto;
    parentId?: string | null;
    allItems: MenuItemDto[];
    onSubmit: (body: Partial<MenuItemDto>) => void;
    onCancel: () => void;
    submitting?: boolean;
}) {
    const [name, setName] = useState(item?.name ?? '');
    const [link, setLink] = useState(item?.link ?? '/');
    const [selectedParentId, setSelectedParentId] = useState<string | null>(parentId ?? null);
    const [newTab, setNewTab] = useState(item?.newTab ?? false);
    const [authRequired, setAuthRequired] = useState(item?.authRequired ?? false);
    const [description, setDescription] = useState(item?.description ?? '');
    const [tooltip, setTooltip] = useState(item?.tooltip ?? '');
    const [image, setImage] = useState(item?.image ?? '');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (parentId !== undefined) setSelectedParentId(parentId ?? null);
    }, [parentId]);

    /** Upload image to R2 via /api/upload, then store the URL */
    const handleImageUpload = useCallback(async (file: File) => {
        if (!file.type.startsWith('image/')) {
            toast.error('Please select an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Image must be under 5 MB');
            return;
        }
        setUploading(true);
        try {
            const res = await menuApi.uploadImage(file);
            setImage(res.url);
            toast.success('Image uploaded');
        } catch {
            toast.error('Upload failed');
        } finally {
            setUploading(false);
        }
    }, []);

    // Parents: items that are not the current item and not descendants (avoid cycles)
    const tree = buildItemTree(allItems);
    const parentOptions = flattenTreeForSelect(tree, item?.id ?? null);

    const handleSubmit = () => {
        if (!name.trim()) {
            toast.error('Name required');
            return;
        }
        onSubmit({
            name: name.trim(),
            link: link.trim() || '/',
            parentId: selectedParentId,
            newTab,
            authRequired,
            description: description || null,
            tooltip: tooltip || null,
            image: image || null,
        });
    };

    return (
        <div className="space-y-3 rounded-lg border p-4">
            <div>
                <Label>Parent</Label>
                <Select
                    value={selectedParentId ?? 'root'}
                    onValueChange={(v) => setSelectedParentId(v === 'root' ? null : v)}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Top level" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="root">Top level</SelectItem>
                        {parentOptions.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>
                                {opt.indent}
                                {opt.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Link (route or URL)" value={link} onChange={(e) => setLink(e.target.value)} />
            <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                    <Switch checked={newTab} onCheckedChange={setNewTab} />
                    <span className="text-sm">Open in new tab</span>
                </label>
                <label className="flex items-center gap-2">
                    <Switch checked={authRequired} onCheckedChange={setAuthRequired} />
                    <span className="text-sm">Auth required</span>
                </label>
            </div>
            <Input
                placeholder="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
            />
            <Input placeholder="Tooltip (optional)" value={tooltip} onChange={(e) => setTooltip(e.target.value)} />

            {/* Image upload */}
            <div>
                <Label>Image (optional)</Label>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    aria-label="Upload menu item image"
                    className="hidden"
                    onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageUpload(f);
                        e.target.value = '';
                    }}
                />
                {image ? (
                    <div className="mt-1 flex items-center gap-2">
                        <img src={image} alt="" className="h-10 w-10 rounded border object-cover" />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setImage('')}
                            title="Remove image"
                        >
                            <IconX className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-1"
                        disabled={uploading}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <IconUpload className="mr-2 h-4 w-4" />
                        {uploading ? 'Uploading...' : 'Upload image'}
                    </Button>
                )}
            </div>

            <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={submitting}>
                    {item ? 'Save' : 'Add'}
                </Button>
                <Button variant="outline" onClick={onCancel} disabled={submitting}>
                    Cancel
                </Button>
            </div>
        </div>
    );
}

/** Collect descendant IDs in post-order (children before parent) for cascade delete */
function collectDescendantIds(tree: MenuItemTreeNode[], parentId: string): string[] {
    const result: string[] = [];
    for (const node of tree) {
        if (node.item.id === parentId) {
            const collect = (n: MenuItemTreeNode): void => {
                for (const child of n.children) {
                    collect(child);
                    result.push(child.item.id);
                }
            };
            collect(node);
            break;
        }
        const fromChild = collectDescendantIds(node.children, parentId);
        if (fromChild.length > 0) {
            result.push(...fromChild);
            break;
        }
    }
    return result;
}

/** Flatten tree for parent select; exclude item and its descendants */
function flattenTreeForSelect(
    tree: MenuItemTreeNode[],
    excludeId: string | null,
    depth = 0,
): { id: string; name: string; indent: string }[] {
    const result: { id: string; name: string; indent: string }[] = [];
    for (const node of tree) {
        if (node.item.id === excludeId) continue;
        result.push({
            id: node.item.id,
            name: node.item.name,
            indent: '—'.repeat(depth) + (depth > 0 ? ' ' : ''),
        });
        result.push(...flattenTreeForSelect(node.children, excludeId, depth + 1));
    }
    return result;
}
