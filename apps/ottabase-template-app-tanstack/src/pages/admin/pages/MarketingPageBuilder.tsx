/**
 * Marketing Page Builder
 *
 * Drag-and-drop page builder for creating marketing pages.
 * - Left sidebar: Block palette with draggable block types
 * - Center: Canvas with sortable blocks
 * - Right panel: Block editor when a block is selected
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import {
    pageActionHooks,
    pageFeatureHooks,
    pageHooks,
    pageSectionHooks,
    type PageActionRow,
    type PageFeatureRow,
    type PageRow,
    type PageSectionRow,
} from '@/hooks/pageHooks';
import {
    closestCenter,
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    ScrollArea,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    Switch,
    Textarea,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import {
    ArrowLeft,
    Check,
    ChevronRight,
    ExternalLink,
    Eye,
    EyeOff,
    GripVertical,
    Palette,
    Plus,
    Save,
    Settings,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ACTION_VARIANTS,
    BLOCK_TYPES,
    getBlockVariants,
    getSlotConfig,
    PAGE_STATUS_OPTIONS,
    THEME_PRESETS,
    type SlotConfig,
} from './pages-constants';

// ── Types ───────────────────────────────────────────────────────────────────

interface BlockWithData extends PageSectionRow {
    features: PageFeatureRow[];
    actions: PageActionRow[];
}

// ── Block Palette Item ──────────────────────────────────────────────────────

function PaletteItem({
    config,
    onAdd,
    disabled,
}: {
    config: SlotConfig;
    onAdd: (blockType: string) => void;
    disabled?: boolean;
}) {
    const Icon = config.icon;

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        onClick={() => onAdd(config.id)}
                        disabled={disabled}
                        className={`
                            w-full flex items-center gap-3 p-3 rounded-lg border text-left
                            transition-all group
                            ${disabled ? 'opacity-50 cursor-not-allowed bg-muted/50' : 'hover:bg-accent hover:border-accent-foreground/20 cursor-grab active:cursor-grabbing'}
                        `}
                    >
                        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20">
                            <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{config.label}</p>
                            <p className="text-xs text-muted-foreground truncate">{config.description}</p>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                    <p>Click to add {config.label}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

// ── Block Palette ───────────────────────────────────────────────────────────

function BlockPalette({
    onAddBlock,
    existingBlocks,
}: {
    onAddBlock: (blockType: string) => void;
    existingBlocks: string[];
}) {
    // Group blocks by category
    const navigation = BLOCK_TYPES.filter((b) => ['navbar', 'footer'].includes(b.id));
    const hero = BLOCK_TYPES.filter((b) => ['hero', 'cta'].includes(b.id));
    const content = BLOCK_TYPES.filter((b) =>
        ['features', 'about', 'testimonials', 'gallery', 'team', 'pricing', 'faq', 'video', 'code', 'custom'].includes(
            b.id,
        ),
    );

    // Some blocks should only appear once (navbar, footer)
    const singleUseBlocks = ['navbar', 'footer'];

    const isDisabled = (blockId: string) => {
        return singleUseBlocks.includes(blockId) && existingBlocks.includes(blockId);
    };

    return (
        <div className="w-72 border-r bg-muted/30 flex flex-col h-full">
            <div className="p-4 border-b">
                <h2 className="font-semibold">Blocks</h2>
                <p className="text-xs text-muted-foreground mt-1">Click to add blocks to your page</p>
            </div>
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-6">
                    <div>
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            Navigation
                        </h3>
                        <div className="space-y-2">
                            {navigation.map((block) => (
                                <PaletteItem
                                    key={block.id}
                                    config={block}
                                    onAdd={onAddBlock}
                                    disabled={isDisabled(block.id)}
                                />
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            Hero & CTA
                        </h3>
                        <div className="space-y-2">
                            {hero.map((block) => (
                                <PaletteItem
                                    key={block.id}
                                    config={block}
                                    onAdd={onAddBlock}
                                    disabled={isDisabled(block.id)}
                                />
                            ))}
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            Content
                        </h3>
                        <div className="space-y-2">
                            {content.map((block) => (
                                <PaletteItem
                                    key={block.id}
                                    config={block}
                                    onAdd={onAddBlock}
                                    disabled={isDisabled(block.id)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}

// ── Sortable Canvas Block ───────────────────────────────────────────────────

function SortableBlock({
    block,
    config,
    isSelected,
    onSelect,
    onToggle,
    onDelete,
}: {
    block: BlockWithData;
    config: SlotConfig;
    isSelected: boolean;
    onSelect: () => void;
    onToggle: () => void;
    onDelete: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: block.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const Icon = config.icon;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`
                group relative border rounded-lg transition-all
                ${isDragging ? 'opacity-50 shadow-lg' : ''}
                ${isSelected ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/50'}
                ${!block.enabled ? 'opacity-60' : ''}
            `}
        >
            <div className="flex items-stretch">
                {/* Drag Handle */}
                <button
                    {...attributes}
                    {...listeners}
                    className="px-2 flex items-center justify-center border-r bg-muted/30 hover:bg-muted cursor-grab active:cursor-grabbing"
                >
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                </button>

                {/* Block Content (clickable to select) */}
                <button type="button" onClick={onSelect} className="flex-1 flex items-center gap-4 p-4 text-left">
                    <div
                        className={`
                            w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                            ${block.enabled ? 'bg-primary/10' : 'bg-muted'}
                        `}
                    >
                        <Icon className={`h-5 w-5 ${block.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{block.title || config.label}</span>
                            {!block.enabled && (
                                <Badge variant="outline" className="text-xs">
                                    Hidden
                                </Badge>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{block.subtitle || config.description}</p>
                        {/* Stats */}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            {config.supportsFeatures && <span>{block.features.length} feature(s)</span>}
                            {config.supportsActions && <span>{block.actions.length} action(s)</span>}
                            {block.variant !== 'default' && (
                                <Badge variant="secondary" className="text-xs">
                                    {block.variant}
                                </Badge>
                            )}
                        </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>

                {/* Quick Actions */}
                <div className="flex items-center gap-1 px-2 border-l bg-muted/20">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle}>
                                    {block.enabled ? (
                                        <Eye className="h-4 w-4" />
                                    ) : (
                                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{block.enabled ? 'Hide block' : 'Show block'}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    onClick={onDelete}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Delete block</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </div>
    );
}

// ── Canvas ──────────────────────────────────────────────────────────────────

function Canvas({
    blocks,
    selectedBlockId,
    onSelectBlock,
    onReorder,
    onToggleBlock,
    onDeleteBlock,
}: {
    blocks: BlockWithData[];
    selectedBlockId: string | null;
    onSelectBlock: (id: string) => void;
    onReorder: (oldIndex: number, newIndex: number) => void;
    onToggleBlock: (block: BlockWithData) => void;
    onDeleteBlock: (block: BlockWithData) => void;
}) {
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over && active.id !== over.id) {
            const oldIndex = blocks.findIndex((b) => b.id === active.id);
            const newIndex = blocks.findIndex((b) => b.id === over.id);
            onReorder(oldIndex, newIndex);
        }
    };

    const activeBlock = activeId ? blocks.find((b) => b.id === activeId) : null;
    const activeConfig = activeBlock ? getSlotConfig(activeBlock.slot) : null;

    return (
        <div className="flex-1 bg-background overflow-hidden flex flex-col">
            <div className="border-b p-4 flex items-center justify-between">
                <div>
                    <h2 className="font-semibold">Page Layout</h2>
                    <p className="text-sm text-muted-foreground">
                        {blocks.length} block{blocks.length !== 1 ? 's' : ''} • Drag to reorder
                    </p>
                </div>
            </div>

            <ScrollArea className="flex-1 p-6">
                {blocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Plus className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="font-medium mb-2">No blocks yet</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            Click blocks from the palette on the left to start building your page.
                        </p>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                            <div className="space-y-3 max-w-3xl mx-auto">
                                {blocks.map((block) => {
                                    const config = getSlotConfig(block.slot);
                                    if (!config) return null;
                                    return (
                                        <SortableBlock
                                            key={block.id}
                                            block={block}
                                            config={config}
                                            isSelected={selectedBlockId === block.id}
                                            onSelect={() => onSelectBlock(block.id)}
                                            onToggle={() => onToggleBlock(block)}
                                            onDelete={() => onDeleteBlock(block)}
                                        />
                                    );
                                })}
                            </div>
                        </SortableContext>
                        <DragOverlay>
                            {activeBlock && activeConfig && (
                                <div className="border rounded-lg p-4 bg-background shadow-xl opacity-90">
                                    <div className="flex items-center gap-3">
                                        <activeConfig.icon className="h-5 w-5 text-primary" />
                                        <span className="font-medium">{activeBlock.title || activeConfig.label}</span>
                                    </div>
                                </div>
                            )}
                        </DragOverlay>
                    </DndContext>
                )}
            </ScrollArea>
        </div>
    );
}

// ── Block Editor Panel ──────────────────────────────────────────────────────

function BlockEditor({
    block,
    onUpdate,
    onClose,
    onRefresh,
}: {
    block: BlockWithData;
    onUpdate: (data: Partial<PageSectionRow>) => void;
    onClose: () => void;
    onRefresh: () => void;
}) {
    const config = getSlotConfig(block.slot);
    const variants = getBlockVariants(block.slot);

    const createFeature = pageFeatureHooks.useCreate();
    const updateFeature = pageFeatureHooks.useUpdate();
    const deleteFeature = pageFeatureHooks.useDelete();
    const createAction = pageActionHooks.useCreate();
    const updateAction = pageActionHooks.useUpdate();
    const deleteAction = pageActionHooks.useDelete();

    const [form, setForm] = useState({
        title: block.title || '',
        subtitle: block.subtitle || '',
        body: block.body || '',
        icon: block.icon || '',
        imageUrl: block.imageUrl || '',
        videoUrl: block.videoUrl || '',
        githubUrl: block.githubUrl || '',
        variant: block.variant || config?.defaultVariant || 'default',
    });

    const [newFeature, setNewFeature] = useState({ title: '', description: '', icon: '', imageUrl: '' });
    const [newAction, setNewAction] = useState({ label: '', href: '', variant: 'default', icon: '' });
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setForm({
            title: block.title || '',
            subtitle: block.subtitle || '',
            body: block.body || '',
            icon: block.icon || '',
            imageUrl: block.imageUrl || '',
            videoUrl: block.videoUrl || '',
            githubUrl: block.githubUrl || '',
            variant: block.variant || config?.defaultVariant || 'default',
        });
    }, [block, config?.defaultVariant]);

    const handleSave = () => {
        onUpdate(form);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleAddFeature = async () => {
        if (!newFeature.title.trim()) return;
        await createFeature.mutateAsync({
            sectionId: block.id,
            title: newFeature.title.trim(),
            description: newFeature.description.trim() || undefined,
            icon: newFeature.icon.trim() || undefined,
            imageUrl: newFeature.imageUrl.trim() || undefined,
            sortOrder: block.features.length,
        });
        setNewFeature({ title: '', description: '', icon: '', imageUrl: '' });
        onRefresh();
    };

    const handleDeleteFeature = async (id: string) => {
        await deleteFeature.mutateAsync(id);
        onRefresh();
    };

    const handleAddAction = async () => {
        if (!newAction.label.trim() || !newAction.href.trim()) return;
        await createAction.mutateAsync({
            sectionId: block.id,
            label: newAction.label.trim(),
            href: newAction.href.trim(),
            variant: newAction.variant,
            icon: newAction.icon.trim() || undefined,
            sortOrder: block.actions.length,
        });
        setNewAction({ label: '', href: '', variant: 'default', icon: '' });
        onRefresh();
    };

    const handleDeleteAction = async (id: string) => {
        await deleteAction.mutateAsync(id);
        onRefresh();
    };

    if (!config) return null;

    const Icon = config.icon;

    return (
        <Sheet open onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        Edit {config.label}
                    </SheetTitle>
                    <SheetDescription>{config.description}</SheetDescription>
                </SheetHeader>

                <div className="space-y-6 mt-6">
                    {/* Variant Selection */}
                    {variants.length > 1 && (
                        <div className="space-y-2">
                            <Label>Layout Variant</Label>
                            <Select value={form.variant} onValueChange={(v) => setForm({ ...form, variant: v })}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {variants.map((v) => (
                                        <SelectItem key={v.value} value={v.value}>
                                            {v.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <Separator />

                    {/* Content Fields */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Title</Label>
                            <Input
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="Block title"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Subtitle / Tagline</Label>
                            <Input
                                value={form.subtitle}
                                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                                placeholder="Short description"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Body Content</Label>
                            <Textarea
                                value={form.body}
                                onChange={(e) => setForm({ ...form, body: e.target.value })}
                                rows={4}
                                placeholder="Main content (supports markdown)"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Icon (Lucide name)</Label>
                                <Input
                                    value={form.icon}
                                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                                    placeholder="e.g. Sparkles"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Image URL</Label>
                                <Input
                                    value={form.imageUrl}
                                    onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        {['video', 'hero'].includes(block.slot) && (
                            <div className="space-y-2">
                                <Label>Video URL</Label>
                                <Input
                                    value={form.videoUrl}
                                    onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                                    placeholder="https://youtube.com/..."
                                />
                            </div>
                        )}

                        {block.slot === 'navbar' && (
                            <div className="space-y-2">
                                <Label>GitHub URL</Label>
                                <Input
                                    value={form.githubUrl}
                                    onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
                                    placeholder="https://github.com/..."
                                />
                            </div>
                        )}
                    </div>

                    {/* Features */}
                    {config.supportsFeatures && (
                        <>
                            <Separator />
                            <div className="space-y-4">
                                <h4 className="font-medium">Features / Items</h4>
                                {block.features.length > 0 && (
                                    <div className="space-y-2">
                                        {block.features.map((f) => (
                                            <div
                                                key={f.id}
                                                className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                                            >
                                                {f.icon && (
                                                    <Badge variant="secondary" className="shrink-0">
                                                        {f.icon}
                                                    </Badge>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm">{f.title}</p>
                                                    {f.description && (
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {f.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 shrink-0"
                                                    onClick={() => handleDeleteFeature(f.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Card>
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-sm">Add Feature</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <Input
                                            placeholder="Title"
                                            value={newFeature.title}
                                            onChange={(e) => setNewFeature({ ...newFeature, title: e.target.value })}
                                        />
                                        <Input
                                            placeholder="Description"
                                            value={newFeature.description}
                                            onChange={(e) =>
                                                setNewFeature({ ...newFeature, description: e.target.value })
                                            }
                                        />
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="Icon"
                                                value={newFeature.icon}
                                                onChange={(e) => setNewFeature({ ...newFeature, icon: e.target.value })}
                                                className="flex-1"
                                            />
                                            <Button
                                                onClick={handleAddFeature}
                                                disabled={!newFeature.title.trim()}
                                                size="sm"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}

                    {/* Actions */}
                    {config.supportsActions && (
                        <>
                            <Separator />
                            <div className="space-y-4">
                                <h4 className="font-medium">Buttons / Actions</h4>
                                {block.actions.length > 0 && (
                                    <div className="space-y-2">
                                        {block.actions.map((a) => (
                                            <div
                                                key={a.id}
                                                className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                                            >
                                                <Badge variant="outline" className="shrink-0">
                                                    {a.variant || 'default'}
                                                </Badge>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm">{a.label}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{a.href}</p>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 shrink-0"
                                                    onClick={() => handleDeleteAction(a.id)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Card>
                                    <CardHeader className="py-3">
                                        <CardTitle className="text-sm">Add Button</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <Input
                                                placeholder="Label"
                                                value={newAction.label}
                                                onChange={(e) => setNewAction({ ...newAction, label: e.target.value })}
                                            />
                                            <Input
                                                placeholder="URL (e.g. /docs)"
                                                value={newAction.href}
                                                onChange={(e) => setNewAction({ ...newAction, href: e.target.value })}
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <Select
                                                value={newAction.variant}
                                                onValueChange={(v) => setNewAction({ ...newAction, variant: v })}
                                            >
                                                <SelectTrigger className="flex-1">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {ACTION_VARIANTS.map((v) => (
                                                        <SelectItem key={v.value} value={v.value}>
                                                            {v.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Button
                                                onClick={handleAddAction}
                                                disabled={!newAction.label.trim() || !newAction.href.trim()}
                                                size="sm"
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}

                    {/* Save Button */}
                    <div className="pt-4">
                        <Button onClick={handleSave} className="w-full">
                            {saved ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                            {saved ? 'Saved!' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// ── Page Settings Dialog ────────────────────────────────────────────────────

function PageSettingsDialog({
    page,
    open,
    onOpenChange,
    onSave,
}: {
    page: PageRow;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Partial<PageRow>) => void;
}) {
    const [form, setForm] = useState({
        title: page.title,
        slug: page.slug,
        status: page.status,
        themePreset: page.themePreset ?? 'default',
        seoTitle: page.seoTitle ?? '',
        seoDescription: page.seoDescription ?? '',
        seoImage: page.seoImage ?? '',
        customCss: page.customCss ?? '',
        showInNav: page.showInNav ?? false,
        navOrder: page.navOrder ?? 0,
        navLabel: page.navLabel ?? '',
        icon: page.icon ?? '',
    });

    useEffect(() => {
        setForm({
            title: page.title,
            slug: page.slug,
            status: page.status,
            themePreset: page.themePreset ?? 'default',
            seoTitle: page.seoTitle ?? '',
            seoDescription: page.seoDescription ?? '',
            seoImage: page.seoImage ?? '',
            customCss: page.customCss ?? '',
            showInNav: page.showInNav ?? false,
            navOrder: page.navOrder ?? 0,
            navLabel: page.navLabel ?? '',
            icon: page.icon ?? '',
        });
    }, [page]);

    const handleSave = () => {
        onSave(form);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Page Settings</DialogTitle>
                    <DialogDescription>Configure page settings, SEO, and navigation options</DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h4 className="font-medium">Basic Information</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input
                                    value={form.title}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    placeholder="Page Title"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Slug</Label>
                                <Input
                                    value={form.slug}
                                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                                    placeholder="page-slug"
                                    disabled={page.slug === 'homepage'}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                                value={form.status}
                                onValueChange={(v: PageRow['status']) => setForm({ ...form, status: v })}
                            >
                                <SelectTrigger className="w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {PAGE_STATUS_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <Separator />

                    {/* Theme */}
                    <div className="space-y-4">
                        <h4 className="font-medium flex items-center gap-2">
                            <Palette className="h-4 w-4" />
                            Theme
                        </h4>
                        <div className="grid grid-cols-4 gap-2">
                            {THEME_PRESETS.map((preset) => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => setForm({ ...form, themePreset: preset.id })}
                                    className={`p-3 rounded-lg border text-left transition-all text-sm ${
                                        form.themePreset === preset.id
                                            ? 'border-primary bg-primary/5 ring-2 ring-primary'
                                            : 'hover:bg-muted/50'
                                    }`}
                                >
                                    <div className="font-medium">{preset.label}</div>
                                    <p className="text-xs text-muted-foreground">{preset.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <Separator />

                    {/* Navigation */}
                    <div className="space-y-4">
                        <h4 className="font-medium">Navigation</h4>
                        <div className="flex items-center justify-between">
                            <div>
                                <Label>Show in navigation</Label>
                                <p className="text-sm text-muted-foreground">Display link in site navigation</p>
                            </div>
                            <Switch
                                checked={form.showInNav}
                                onCheckedChange={(v) => setForm({ ...form, showInNav: v })}
                            />
                        </div>
                        {form.showInNav && (
                            <div className="grid grid-cols-3 gap-4 pt-2">
                                <div className="space-y-2">
                                    <Label>Nav Label</Label>
                                    <Input
                                        value={form.navLabel}
                                        onChange={(e) => setForm({ ...form, navLabel: e.target.value })}
                                        placeholder={form.title || 'Page title'}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Order</Label>
                                    <Input
                                        type="number"
                                        value={form.navOrder}
                                        onChange={(e) => setForm({ ...form, navOrder: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Icon</Label>
                                    <Input
                                        value={form.icon}
                                        onChange={(e) => setForm({ ...form, icon: e.target.value })}
                                        placeholder="FileText"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* SEO */}
                    <div className="space-y-4">
                        <h4 className="font-medium">SEO</h4>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Page Title</Label>
                                <Input
                                    value={form.seoTitle}
                                    onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
                                    placeholder={form.title || 'Page Title - Site Name'}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Meta Description</Label>
                                <Textarea
                                    value={form.seoDescription}
                                    onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
                                    placeholder="A compelling description for search engines..."
                                    rows={2}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Social Image URL</Label>
                                <Input
                                    value={form.seoImage}
                                    onChange={(e) => setForm({ ...form, seoImage: e.target.value })}
                                    placeholder="https://example.com/og-image.png"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4" />
                        Save Settings
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Main Page Builder ───────────────────────────────────────────────────────

export function MarketingPageBuilder() {
    const { pageId } = useParams({ from: '/admin/pages/$pageId' });

    // State
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // Data hooks
    const { data: pageData, isLoading: pageLoading, refetch: refetchPage } = pageHooks.useDetail(pageId);
    const { data: sectionsData, refetch: refetchSections } = pageSectionHooks.useList(
        { where: { pageId }, orderBy: 'sortOrder', orderDirection: 'asc' },
        ADMIN_LIST_QUERY_CONFIG,
    );
    const { data: featuresData, refetch: refetchFeatures } = pageFeatureHooks.useList(
        { orderBy: 'sortOrder', orderDirection: 'asc' },
        ADMIN_LIST_QUERY_CONFIG,
    );
    const { data: actionsData, refetch: refetchActions } = pageActionHooks.useList(
        { orderBy: 'sortOrder', orderDirection: 'asc' },
        ADMIN_LIST_QUERY_CONFIG,
    );

    const updatePage = pageHooks.useUpdate();
    const createSection = pageSectionHooks.useCreate();
    const updateSection = pageSectionHooks.useUpdate();
    const deleteSection = pageSectionHooks.useDelete();

    // Type-safe data
    const page = pageData as PageRow | undefined;
    const sections = useMemo(() => {
        const data = (Array.isArray(sectionsData) ? sectionsData : []) as PageSectionRow[];
        return data.filter((s) => s.pageId === pageId).sort((a, b) => a.sortOrder - b.sortOrder);
    }, [sectionsData, pageId]);
    const features = useMemo(
        () => (Array.isArray(featuresData) ? featuresData : []) as PageFeatureRow[],
        [featuresData],
    );
    const actions = useMemo(() => (Array.isArray(actionsData) ? actionsData : []) as PageActionRow[], [actionsData]);

    // Build blocks with their features and actions
    const blocks = useMemo<BlockWithData[]>(() => {
        return sections.map((section) => ({
            ...section,
            features: features.filter((f) => f.sectionId === section.id),
            actions: actions.filter((a) => a.sectionId === section.id),
        }));
    }, [sections, features, actions]);

    // Selected block
    const selectedBlock = useMemo(() => {
        if (!selectedBlockId) return null;
        return blocks.find((b) => b.id === selectedBlockId) ?? null;
    }, [blocks, selectedBlockId]);

    // Refresh all data
    const handleRefresh = useCallback(() => {
        refetchSections();
        refetchFeatures();
        refetchActions();
    }, [refetchSections, refetchFeatures, refetchActions]);

    // Page update
    const handleUpdatePage = async (data: Partial<PageRow>) => {
        await updatePage.mutateAsync({ id: pageId, data });
        refetchPage();
    };

    // Add block
    const handleAddBlock = async (blockType: string) => {
        const config = getSlotConfig(blockType);
        if (!config) return;

        await createSection.mutateAsync({
            pageId,
            slot: blockType,
            title: config.label,
            variant: config.defaultVariant,
            enabled: true,
            sortOrder: sections.length,
        });
        handleRefresh();
    };

    // Update block
    const handleUpdateBlock = async (id: string, data: Partial<PageSectionRow>) => {
        await updateSection.mutateAsync({ id, data });
        handleRefresh();
    };

    // Toggle block visibility
    const handleToggleBlock = async (block: BlockWithData) => {
        await updateSection.mutateAsync({ id: block.id, data: { enabled: !block.enabled } });
        handleRefresh();
    };

    // Delete block
    const handleDeleteBlock = async (block: BlockWithData) => {
        if (!confirm(`Delete "${block.title || block.slot}" block?`)) return;
        await deleteSection.mutateAsync(block.id);
        if (selectedBlockId === block.id) setSelectedBlockId(null);
        handleRefresh();
    };

    // Reorder blocks
    const handleReorder = async (oldIndex: number, newIndex: number) => {
        const newBlocks = arrayMove(blocks, oldIndex, newIndex);
        // Update sort order for affected blocks
        for (let i = 0; i < newBlocks.length; i++) {
            if (newBlocks[i].sortOrder !== i) {
                await updateSection.mutateAsync({ id: newBlocks[i].id, data: { sortOrder: i } });
            }
        }
        handleRefresh();
    };

    if (pageLoading || !page) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col">
            {/* Header */}
            <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
                <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Link to="/admin/pages" className="p-2 rounded-lg hover:bg-muted">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-semibold">{page.title}</h1>
                                <Badge variant={page.status === 'published' ? 'default' : 'secondary'}>
                                    {page.status}
                                </Badge>
                                {page.slug === 'homepage' && (
                                    <Badge variant="outline" className="text-xs">
                                        Homepage
                                    </Badge>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">/{page.slug}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                        </Button>
                        <a
                            href={`${import.meta.env.VITE_HOMEPAGE_URL || 'http://localhost:3000'}/${page.slug === 'homepage' ? '' : page.slug}?preview=true`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <Button variant="outline" size="sm">
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Preview
                            </Button>
                        </a>
                    </div>
                </div>
            </div>

            {/* Main Content: Palette + Canvas */}
            <div className="flex-1 flex overflow-hidden">
                <BlockPalette onAddBlock={handleAddBlock} existingBlocks={blocks.map((b) => b.slot)} />
                <Canvas
                    blocks={blocks}
                    selectedBlockId={selectedBlockId}
                    onSelectBlock={setSelectedBlockId}
                    onReorder={handleReorder}
                    onToggleBlock={handleToggleBlock}
                    onDeleteBlock={handleDeleteBlock}
                />
            </div>

            {/* Block Editor Sheet */}
            {selectedBlock && (
                <BlockEditor
                    block={selectedBlock}
                    onUpdate={(data) => handleUpdateBlock(selectedBlock.id, data)}
                    onClose={() => setSelectedBlockId(null)}
                    onRefresh={handleRefresh}
                />
            )}

            {/* Page Settings Dialog */}
            <PageSettingsDialog
                page={page}
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                onSave={handleUpdatePage}
            />
        </div>
    );
}
