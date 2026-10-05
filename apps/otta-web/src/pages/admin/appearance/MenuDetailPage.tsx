// ---------------------------------------------------------------------------
// Menu detail: items you can drag, nudge and nest; a side panel edits one (Ottamenu)
// ---------------------------------------------------------------------------

import { useBrand } from '@ottabase/brand-engine-react';
import {
    buildItemTree,
    indentItem,
    moveItem,
    orderChanges,
    outdentItem,
    placeItem,
    type MenuItemMove,
    type MenuItemTreeNode,
} from '@ottabase/ottamenu';
import { renderMenu } from '@ottabase/ottamenu/render';
import { ConfirmDialog, EmptyState, LoadingState } from '@ottabase/ui-components';
import {
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
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    Switch,
} from '@ottabase/ui-shadcn';
import {
    IconArrowDown,
    IconArrowLeft,
    IconArrowUp,
    IconEye,
    IconGripVertical,
    IconIndentDecrease,
    IconIndentIncrease,
    IconPlus,
    IconPuzzle,
    IconTrash,
    IconUpload,
    IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { AssignToSlotsModal } from './menus/AssignToSlotsModal';
import { menuApi, type MenuItemDto, type MenuRenderType, type MenuWithItemsDto } from './menus/menuApi';
import { slotLabel, slotsForMenu } from './menus/menuSlots';

const RENDER_TYPES: { value: MenuRenderType; label: string }[] = [
    { value: 'sidebar', label: 'Sidebar' },
    { value: 'flyout', label: 'Flyout' },
    { value: 'mega', label: 'Mega menu' },
    { value: 'navbar', label: 'Navbar' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'footer', label: 'Footer' },
];
const MAX_ITEMS = 100;
const headingClass = 'text-[0.9375rem] font-semibold';

/** What the item panel is editing: an existing item, or a new one under a parent */
type PanelTarget = { item?: MenuItemDto; parentId: string | null };

export function AdminMenuDetailPage() {
    const { menuId } = useParams({ strict: false });
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: menu, isLoading } = useQuery({
        queryKey: ['menus', menuId],
        queryFn: () => menuApi.get(menuId as string),
        enabled: !!menuId,
    });

    const createMenu = useMutation({
        mutationFn: (body: { name: string; slug: string; type: MenuRenderType }) => menuApi.create(body),
        onSuccess: (created) => {
            toast.success('Menu created');
            queryClient.invalidateQueries({ queryKey: ['menus'] });
            navigate({ to: '/admin/appearance/menus/$menuId', params: { menuId: created.id } });
        },
        onError: () => toast.error('Could not create the menu'),
    });

    if (!menuId)
        return <MenuCreateView onSubmit={(body) => createMenu.mutate(body)} submitting={createMenu.isPending} />;

    if (isLoading || !menu) {
        return (
            <div className="space-y-6">
                <LoadingState kind="text" count={2} label="Loading menu" />
                <LoadingState kind="blocks" count={1} height="h-72" />
            </div>
        );
    }

    return <MenuWorkspace key={menu.id} menu={menu} />;
}

function MenuWorkspace({ menu }: { menu: MenuWithItemsDto }) {
    const queryClient = useQueryClient();
    const { refresh: refreshBrand } = useBrand();
    const [items, setItems] = useState(menu.items);
    const [previewType, setPreviewType] = useState<MenuRenderType>(menu.type);
    const [panel, setPanel] = useState<PanelTarget | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [assignOpen, setAssignOpen] = useState(false);

    // The server copy wins whenever it changes (after any save)
    useEffect(() => setItems(menu.items), [menu.items]);

    const refreshMenuAndBrand = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['menus'] });
        refreshBrand(); // Layout (header, sidebar, footer) reads menus from the brand config
    }, [queryClient, refreshBrand]);

    const reorder = useMutation({
        mutationFn: (moves: MenuItemMove[]) => menuApi.reorder(menu.id, moves),
        onSuccess: refreshMenuAndBrand,
        onError: () => {
            toast.error('Could not save the new order');
            setItems(menu.items);
        },
    });

    /** Show the new order at once, then persist only what moved */
    const apply = (next: MenuItemDto[]) => {
        const moves = orderChanges(items, next);
        if (moves.length === 0) return;
        setItems(next);
        reorder.mutate(moves);
    };

    const deleteItem = useMutation({
        mutationFn: async (id: string) => {
            // Children first, so the parent key never dangles
            for (const childId of descendantIds(buildItemTree(items), id)) await menuApi.deleteItem(menu.id, childId);
            await menuApi.deleteItem(menu.id, id);
        },
        onSuccess: () => {
            toast.success('Item removed');
            refreshMenuAndBrand();
        },
        onError: () => toast.error('Could not remove the item'),
    });

    const tree = buildItemTree(items);
    const full = items.length >= MAX_ITEMS;

    return (
        <div className="space-y-6">
            <MenuHeader menu={menu} onAssign={() => setAssignOpen(true)} />

            <div className="flex flex-col gap-6 lg:flex-row">
                <div className="min-w-0 flex-1 space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                            <div className="space-y-1.5">
                                <CardTitle className={headingClass}>Items</CardTitle>
                                <CardDescription className="leading-relaxed">
                                    Drag a row to move it, or use the arrows. Indent puts an item under the one above
                                    it. Click a name to edit it.
                                </CardDescription>
                            </div>
                            <Button
                                size="sm"
                                onClick={() => setPanel({ parentId: null })}
                                disabled={full}
                                title={full ? `A menu holds at most ${MAX_ITEMS} items` : undefined}
                            >
                                <IconPlus className="mr-1.5 h-4 w-4" />
                                Add item
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {tree.length === 0 ? (
                                <EmptyState
                                    compact
                                    title="No items yet"
                                    description="Add the first link. Items can be nested two or more levels deep."
                                />
                            ) : (
                                <ItemTree
                                    nodes={tree}
                                    items={items}
                                    onApply={apply}
                                    onEdit={(item) => setPanel({ item, parentId: item.parentId ?? null })}
                                    onAddChild={(parentId) => setPanel({ parentId })}
                                    onDelete={setDeleteId}
                                    full={full}
                                />
                            )}
                        </CardContent>
                    </Card>

                    <MenuSettings menu={menu} onTypeChange={setPreviewType} onSaved={refreshMenuAndBrand} />
                </div>

                <div className="w-full shrink-0 lg:w-80">
                    <MenuPreviewPanel items={items} type={previewType} />
                </div>
            </div>

            <ItemPanel
                menu={menu}
                items={items}
                target={panel}
                onClose={() => setPanel(null)}
                onSaved={() => {
                    setPanel(null);
                    refreshMenuAndBrand();
                }}
                onDelete={(id) => {
                    setPanel(null);
                    setDeleteId(id);
                }}
            />

            <AssignToSlotsModal open={assignOpen} onOpenChange={setAssignOpen} preselectedMenuId={menu.id} />

            <ConfirmDialog
                open={deleteId !== null}
                onOpenChange={(open) => !open && setDeleteId(null)}
                title="Remove this item?"
                description="Anything nested under it goes too."
                tone="destructive"
                secondaryActionText="Cancel"
                primaryActionText={deleteItem.isPending ? 'Removing' : 'Remove'}
                onConfirm={async () => {
                    if (deleteId) await deleteItem.mutateAsync(deleteId);
                    setDeleteId(null);
                }}
            />
        </div>
    );
}

function MenuHeader({ menu, onAssign }: { menu: MenuWithItemsDto; onAssign: () => void }) {
    const { config } = useBrand();
    const slots = slotsForMenu(config?.menuSlots, menu.id);
    return (
        <div className="space-y-3">
            <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground" asChild>
                <Link to="/admin/appearance/menus">
                    <IconArrowLeft className="h-4 w-4" />
                    Menus
                </Link>
            </Button>
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{menu.name}</h1>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-mono">{menu.slug}</span>
                        <span aria-hidden="true">·</span>
                        <span>Shown in</span>
                        {slots.length === 0 ? (
                            <span>nowhere yet</span>
                        ) : (
                            slots.map((slot) => (
                                <Badge key={slot} variant="secondary" className="rounded-full font-normal">
                                    {slotLabel(slot)}
                                </Badge>
                            ))
                        )}
                    </div>
                </div>
                <Button variant="outline" onClick={onAssign}>
                    <IconPuzzle className="mr-2 h-4 w-4" />
                    Assign to slots
                </Button>
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
        <div className="space-y-6">
            <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground" asChild>
                <Link to="/admin/appearance/menus">
                    <IconArrowLeft className="h-4 w-4" />
                    Menus
                </Link>
            </Button>
            <Card className="max-w-xl">
                <CardHeader>
                    <CardTitle className={headingClass}>New menu</CardTitle>
                    <CardDescription className="leading-relaxed">
                        Name it, then add items. The slug &quot;sidebar&quot; replaces the main sidebar navigation.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Main navigation"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="slug">Slug</Label>
                        <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="sidebar" />
                    </div>
                    <RenderTypeField id="type" value={type} onChange={setType} />
                    <Button
                        onClick={() => onSubmit({ name: name.trim(), slug: slug.trim() || 'sidebar', type })}
                        disabled={submitting || !name.trim()}
                    >
                        Create
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

function RenderTypeField({
    id,
    value,
    onChange,
}: {
    id: string;
    value: MenuRenderType;
    onChange: (t: MenuRenderType) => void;
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>Default render type</Label>
            <Select value={value} onValueChange={(v) => onChange(v as MenuRenderType)}>
                <SelectTrigger id={id}>
                    <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                    {RENDER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                            {t.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function MenuSettings({
    menu,
    onTypeChange,
    onSaved,
}: {
    menu: MenuWithItemsDto;
    onTypeChange: (t: MenuRenderType) => void;
    onSaved: () => void;
}) {
    const [name, setName] = useState(menu.name);
    const [slug, setSlug] = useState(menu.slug);
    const [type, setType] = useState<MenuRenderType>(menu.type);
    const dirty = name !== menu.name || slug !== menu.slug || type !== menu.type;

    const update = useMutation({
        mutationFn: (body: { name: string; slug: string; type: MenuRenderType }) => menuApi.update(menu.id, body),
        onSuccess: () => {
            toast.success('Menu saved');
            onSaved();
        },
        onError: () => toast.error('Could not save the menu'),
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className={headingClass}>Settings</CardTitle>
                <CardDescription className="leading-relaxed">
                    The render type is how the menu looks when a slot does not choose one.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-name">Name</Label>
                        <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="edit-slug">Slug</Label>
                        <Input
                            id="edit-slug"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            className="font-mono"
                        />
                    </div>
                </div>
                <RenderTypeField
                    id="edit-type"
                    value={type}
                    onChange={(t) => {
                        setType(t);
                        onTypeChange(t);
                    }}
                />
                <Button
                    onClick={() => update.mutate({ name: name.trim(), slug: slug.trim(), type })}
                    disabled={update.isPending || !dirty || !name.trim()}
                >
                    Save
                </Button>
            </CardContent>
        </Card>
    );
}

function MenuPreviewPanel({ items, type }: { items: MenuItemDto[]; type: MenuRenderType }) {
    const { pathname } = useLocation();
    // Horizontal menu types need more width for a meaningful preview
    const isWide = type === 'mega' || type === 'navbar' || type === 'footer';
    return (
        <Card className="lg:sticky lg:top-4">
            <CardHeader className="pb-2">
                <CardTitle className={`flex items-center gap-2 ${headingClass}`}>
                    <IconEye className="h-4 w-4 text-muted-foreground" />
                    Preview
                </CardTitle>
                <CardDescription>As {RENDER_TYPES.find((t) => t.value === type)?.label.toLowerCase()}</CardDescription>
            </CardHeader>
            <CardContent>
                {items.length > 0 ? (
                    <div
                        className={`rounded-lg bg-background p-3 ring-1 ring-border ${isWide ? 'overflow-x-auto' : ''}`}
                    >
                        {renderMenu({ items }, type, { isAuthenticated: true, pathname, expanded: isWide })}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Add items to see the menu.</p>
                )}
            </CardContent>
        </Card>
    );
}

// ── Items tree ───────────────────────────────────────────────

interface ItemTreeProps {
    nodes: MenuItemTreeNode[];
    items: MenuItemDto[];
    onApply: (next: MenuItemDto[]) => void;
    onEdit: (item: MenuItemDto) => void;
    onAddChild: (parentId: string) => void;
    onDelete: (id: string) => void;
    full: boolean;
}

function ItemTree(props: ItemTreeProps) {
    const [dragId, setDragId] = useState<string | null>(null);
    const [drop, setDrop] = useState<{ id: string; position: 'before' | 'after' } | null>(null);

    const dragStart = (e: DragEvent, id: string) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        setDragId(id);
    };
    const dragOver = (e: DragEvent<HTMLDivElement>, id: string) => {
        if (!dragId || dragId === id) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        setDrop({ id, position: e.clientY - rect.top < rect.height / 2 ? 'before' : 'after' });
    };
    const dropOn = (e: DragEvent, id: string) => {
        e.preventDefault();
        if (dragId) props.onApply(placeItem(props.items, dragId, id, drop?.position ?? 'after'));
        setDragId(null);
        setDrop(null);
    };
    const dragEnd = () => {
        setDragId(null);
        setDrop(null);
    };

    const renderNodes = (nodes: MenuItemTreeNode[], depth: number) =>
        nodes.map((node, index) => (
            <div key={node.item.id} className={depth > 0 ? 'ml-3 border-l border-border/60 pl-3' : undefined}>
                <ItemRow
                    item={node.item}
                    first={index === 0}
                    last={index === nodes.length - 1}
                    nested={depth > 0}
                    dragging={dragId === node.item.id}
                    dropPosition={drop?.id === node.item.id ? drop.position : null}
                    onDragStart={(e) => dragStart(e, node.item.id)}
                    onDragOver={(e) => dragOver(e, node.item.id)}
                    onDrop={(e) => dropOn(e, node.item.id)}
                    onDragEnd={dragEnd}
                    onMove={(delta) => props.onApply(moveItem(props.items, node.item.id, delta))}
                    onIndent={() => props.onApply(indentItem(props.items, node.item.id))}
                    onOutdent={() => props.onApply(outdentItem(props.items, node.item.id))}
                    onEdit={() => props.onEdit(node.item)}
                    onAddChild={() => props.onAddChild(node.item.id)}
                    onDelete={() => props.onDelete(node.item.id)}
                    full={props.full}
                />
                {node.children.length > 0 && (
                    <div className="mt-1 space-y-1">{renderNodes(node.children, depth + 1)}</div>
                )}
            </div>
        ));

    return <div className="space-y-1">{renderNodes(props.nodes, 0)}</div>;
}

interface ItemRowProps {
    item: MenuItemDto;
    first: boolean;
    last: boolean;
    nested: boolean;
    dragging: boolean;
    dropPosition: 'before' | 'after' | null;
    onDragStart: (e: DragEvent<HTMLDivElement>) => void;
    onDragOver: (e: DragEvent<HTMLDivElement>) => void;
    onDrop: (e: DragEvent<HTMLDivElement>) => void;
    onDragEnd: () => void;
    onMove: (delta: -1 | 1) => void;
    onIndent: () => void;
    onOutdent: () => void;
    onEdit: () => void;
    onAddChild: () => void;
    onDelete: () => void;
    full: boolean;
}

function ItemRow(p: ItemRowProps) {
    const { item } = p;
    const keys = (e: KeyboardEvent) => {
        if (!e.altKey) return;
        const action = {
            ArrowUp: () => p.onMove(-1),
            ArrowDown: () => p.onMove(1),
            ArrowLeft: p.onOutdent,
            ArrowRight: p.onIndent,
        }[e.key];
        if (!action) return;
        e.preventDefault();
        action();
    };
    const nudge = 'h-7 w-7 text-muted-foreground hover:text-foreground disabled:opacity-30';

    return (
        <div
            draggable
            onDragStart={p.onDragStart}
            onDragOver={p.onDragOver}
            onDrop={p.onDrop}
            onDragEnd={p.onDragEnd}
            data-item-id={item.id}
            className={[
                'group flex items-center gap-2 rounded-lg bg-background px-2 py-1.5 ring-1 ring-border transition-colors',
                p.dragging ? 'opacity-40' : '',
                p.dropPosition === 'before' ? 'shadow-[0_-2px_0_0_hsl(var(--primary))]' : '',
                p.dropPosition === 'after' ? 'shadow-[0_2px_0_0_hsl(var(--primary))]' : '',
            ].join(' ')}
        >
            <button
                type="button"
                aria-label={`Move ${item.name}. Alt with arrow keys moves, indents or outdents it.`}
                onKeyDown={keys}
                className="cursor-grab rounded p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
                <IconGripVertical className="h-4 w-4" />
            </button>
            {item.image && (
                <img src={item.image} alt="" className="h-7 w-7 shrink-0 rounded-md object-cover ring-1 ring-border" />
            )}
            <button
                type="button"
                onClick={p.onEdit}
                aria-label={`Edit ${item.name}`}
                className="min-w-0 flex-1 rounded px-1 text-left hover:bg-muted/60"
            >
                <span className="block truncate text-sm font-medium">{item.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                    {item.link}
                    {item.newTab && ' · new tab'}
                    {item.authRequired && ' · members only'}
                </span>
            </button>
            <div className="flex shrink-0 items-center opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <Button
                    variant="ghost"
                    size="icon"
                    className={nudge}
                    aria-label={`Move ${item.name} up`}
                    disabled={p.first}
                    onClick={() => p.onMove(-1)}
                >
                    <IconArrowUp className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={nudge}
                    aria-label={`Move ${item.name} down`}
                    disabled={p.last}
                    onClick={() => p.onMove(1)}
                >
                    <IconArrowDown className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={nudge}
                    aria-label={`Move ${item.name} out`}
                    disabled={!p.nested}
                    onClick={p.onOutdent}
                >
                    <IconIndentDecrease className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={nudge}
                    aria-label={`Put ${item.name} under the item above`}
                    disabled={p.first}
                    onClick={p.onIndent}
                >
                    <IconIndentIncrease className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className={nudge}
                    aria-label={`Add an item under ${item.name}`}
                    disabled={p.full}
                    onClick={p.onAddChild}
                >
                    <IconPlus className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${item.name}`}
                    onClick={p.onDelete}
                >
                    <IconTrash className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

// ── Item panel ───────────────────────────────────────────────

function ItemPanel({
    menu,
    items,
    target,
    onClose,
    onSaved,
    onDelete,
}: {
    menu: MenuWithItemsDto;
    items: MenuItemDto[];
    target: PanelTarget | null;
    onClose: () => void;
    onSaved: () => void;
    onDelete: (id: string) => void;
}) {
    return (
        <Sheet open={target !== null} onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="right"
                className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
                aria-describedby={undefined}
            >
                <SheetHeader className="border-b border-border px-6 py-4 text-left">
                    <SheetTitle>{target?.item ? 'Edit item' : 'New item'}</SheetTitle>
                </SheetHeader>
                {target && (
                    <ItemForm
                        key={target.item?.id ?? 'new'}
                        menuId={menu.id}
                        items={items}
                        item={target.item}
                        parentId={target.parentId}
                        onSaved={onSaved}
                        onCancel={onClose}
                        onDelete={target.item ? () => onDelete(target.item!.id) : undefined}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}

function ItemForm({
    menuId,
    items,
    item,
    parentId,
    onSaved,
    onCancel,
    onDelete,
}: {
    menuId: string;
    items: MenuItemDto[];
    item?: MenuItemDto;
    parentId: string | null;
    onSaved: () => void;
    onCancel: () => void;
    onDelete?: () => void;
}) {
    const [draft, setDraft] = useState({
        name: item?.name ?? '',
        link: item?.link ?? '/',
        parentId,
        newTab: item?.newTab ?? false,
        authRequired: item?.authRequired ?? false,
        description: item?.description ?? '',
        tooltip: item?.tooltip ?? '',
        image: item?.image ?? '',
    });
    const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
        setDraft((current) => ({ ...current, [key]: value }));
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const save = useMutation({
        mutationFn: (body: Partial<MenuItemDto>) =>
            item ? menuApi.updateItem(menuId, item.id, body) : menuApi.createItem(menuId, body),
        onSuccess: () => {
            toast.success(item ? 'Item saved' : 'Item added');
            onSaved();
        },
        onError: () => toast.error('Could not save the item'),
    });

    const upload = async (file: File) => {
        if (!file.type.startsWith('image/')) return toast.error('Choose an image file');
        if (file.size > 5 * 1024 * 1024) return toast.error('Images must be under 5 MB');
        setUploading(true);
        try {
            set('image', (await menuApi.uploadImage(file)).url);
        } catch {
            toast.error('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    // Parents: anything except the item itself and what sits under it
    const parentOptions = flattenForSelect(buildItemTree(items), item?.id ?? null);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        save.mutate({
            name: draft.name.trim(),
            link: draft.link.trim() || '/',
            parentId: draft.parentId,
            newTab: draft.newTab,
            authRequired: draft.authRequired,
            description: draft.description || null,
            tooltip: draft.tooltip || null,
            image: draft.image || null,
        });
    };
    const busy = save.isPending;

    return (
        <form onSubmit={submit} className="flex flex-1 flex-col">
            <div className="space-y-5 px-6 py-5">
                <div className="space-y-2">
                    <Label htmlFor="item-name">Name</Label>
                    <Input
                        id="item-name"
                        required
                        value={draft.name}
                        onChange={(e) => set('name', e.target.value)}
                        disabled={busy}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="item-link">Link</Label>
                    <Input
                        id="item-link"
                        value={draft.link}
                        onChange={(e) => set('link', e.target.value)}
                        placeholder="/page or https://"
                        disabled={busy}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="item-parent">Under</Label>
                    <Select
                        value={draft.parentId ?? 'root'}
                        onValueChange={(v) => set('parentId', v === 'root' ? null : v)}
                        disabled={busy}
                    >
                        <SelectTrigger id="item-parent">
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
                <div className="space-y-3 rounded-xl bg-muted/40 p-4">
                    <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="item-newtab">Open in a new tab</Label>
                        <Switch
                            id="item-newtab"
                            checked={draft.newTab}
                            onCheckedChange={(v) => set('newTab', v)}
                            disabled={busy}
                        />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="item-auth">Members only</Label>
                        <Switch
                            id="item-auth"
                            checked={draft.authRequired}
                            onCheckedChange={(v) => set('authRequired', v)}
                            disabled={busy}
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="item-description">Description</Label>
                    <Input
                        id="item-description"
                        value={draft.description}
                        onChange={(e) => set('description', e.target.value)}
                        placeholder="Shown in mega and flyout menus"
                        disabled={busy}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="item-tooltip">Tooltip</Label>
                    <Input
                        id="item-tooltip"
                        value={draft.tooltip}
                        onChange={(e) => set('tooltip', e.target.value)}
                        disabled={busy}
                    />
                </div>
                <div className="space-y-2">
                    <Label className="block">Image</Label>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        aria-label="Upload menu item image"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void upload(file);
                            e.target.value = '';
                        }}
                    />
                    {draft.image ? (
                        <div className="flex items-center gap-2">
                            <img
                                src={draft.image}
                                alt=""
                                className="h-10 w-10 rounded-md object-cover ring-1 ring-border"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Remove image"
                                onClick={() => set('image', '')}
                            >
                                <IconX className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploading}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <IconUpload className="mr-2 h-4 w-4" />
                            {uploading ? 'Uploading' : 'Upload image'}
                        </Button>
                    )}
                </div>
            </div>
            <div className="mt-auto flex items-center justify-between gap-2 border-t border-border px-6 py-4">
                {onDelete ? (
                    <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive"
                        onClick={onDelete}
                        disabled={busy}
                    >
                        <IconTrash className="mr-2 h-4 w-4" />
                        Remove
                    </Button>
                ) : (
                    <span />
                )}
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={busy || !draft.name.trim()}>
                        {busy ? 'Saving' : item ? 'Save' : 'Add'}
                    </Button>
                </div>
            </div>
        </form>
    );
}

/** Ids below `parentId`, children before parents, for a safe cascade delete */
function descendantIds(tree: MenuItemTreeNode[], parentId: string): string[] {
    for (const node of tree) {
        if (node.item.id === parentId) {
            const ids: string[] = [];
            const walk = (n: MenuItemTreeNode) => {
                for (const child of n.children) {
                    walk(child);
                    ids.push(child.item.id);
                }
            };
            walk(node);
            return ids;
        }
        const below = descendantIds(node.children, parentId);
        if (below.length > 0) return below;
    }
    return [];
}

/** Parent choices in tree order, without the item itself or anything under it */
function flattenForSelect(
    tree: MenuItemTreeNode[],
    excludeId: string | null,
    depth = 0,
): { id: string; name: string; indent: string }[] {
    const result: { id: string; name: string; indent: string }[] = [];
    for (const node of tree) {
        if (node.item.id === excludeId) continue;
        result.push({ id: node.item.id, name: node.item.name, indent: '  '.repeat(depth) });
        result.push(...flattenForSelect(node.children, excludeId, depth + 1));
    }
    return result;
}
