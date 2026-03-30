/**
 * Admin Homepage Sections List
 *
 * Visual slot-based overview of all homepage sections with inline CRUD,
 * enable/disable toggles, sort controls, and nested feature/action editors.
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import {
    homepageActionHooks,
    homepageFeatureHooks,
    homepageSectionHooks,
    type HomepageActionRow,
    type HomepageFeatureRow,
    type HomepageSectionRow,
} from '@/hooks/homepageHooks';
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
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Input,
    Label,
    Switch,
    Textarea,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    Edit,
    ExternalLink,
    Eye,
    EyeOff,
    GripVertical,
    Layout,
    Plus,
    Trash2,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { HomepageAdminNav } from './HomepageAdminNav';
import { ACTION_VARIANTS, SLOT_DESCRIPTIONS, SLOT_LABELS, SLOT_NAMES, type SlotName } from './homepage-constants';

// ── Inline mini-editors ─────────────────────────────────────────────────────

/** Inline feature list for a section */
function SectionFeatures({ sectionId }: { sectionId: string }) {
    const { data, isLoading } = homepageFeatureHooks.useList(
        { where: { sectionId }, orderBy: 'sortOrder', orderDirection: 'asc' },
        ADMIN_LIST_QUERY_CONFIG,
    );
    const createFeature = homepageFeatureHooks.useCreate();
    const deleteFeature = homepageFeatureHooks.useDelete();
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newIcon, setNewIcon] = useState('');

    const features = (Array.isArray(data) ? data : []) as HomepageFeatureRow[];

    const handleAdd = useCallback(async () => {
        if (!newTitle.trim() || !newDesc.trim()) return;
        await createFeature.mutateAsync({
            sectionId,
            title: newTitle.trim(),
            description: newDesc.trim(),
            icon: newIcon.trim() || undefined,
            sortOrder: features.length,
        });
        setNewTitle('');
        setNewDesc('');
        setNewIcon('');
        setAdding(false);
    }, [createFeature, sectionId, newTitle, newDesc, newIcon, features.length]);

    if (isLoading) return <p className="text-xs text-muted-foreground">Loading features…</p>;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Features ({features.length})
                </p>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setAdding(!adding)}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                </Button>
            </div>
            {features.map((f) => (
                <div key={f.id} className="flex items-start gap-2 rounded border p-2 text-sm">
                    <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    {f.icon && (
                        <Badge variant="outline" className="shrink-0 text-[10px] font-mono">
                            {f.icon}
                        </Badge>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="font-medium">{f.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{f.description}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteFeature.mutate(f.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                </div>
            ))}
            {adding && (
                <div className="space-y-2 rounded border border-dashed p-2">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Feature title"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            className="h-8 text-sm"
                        />
                        <Input
                            placeholder="Icon (e.g. Zap)"
                            value={newIcon}
                            onChange={(e) => setNewIcon(e.target.value)}
                            className="h-8 text-sm w-32"
                        />
                    </div>
                    <Textarea
                        placeholder="Short description"
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        rows={2}
                        className="text-sm"
                    />
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleAdd}
                            disabled={createFeature.isPending}
                        >
                            Save
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                                setAdding(false);
                                setNewTitle('');
                                setNewDesc('');
                                setNewIcon('');
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Inline action list for a section */
function SectionActions({ sectionId }: { sectionId: string }) {
    const { data, isLoading } = homepageActionHooks.useList(
        { where: { sectionId }, orderBy: 'sortOrder', orderDirection: 'asc' },
        ADMIN_LIST_QUERY_CONFIG,
    );
    const createAction = homepageActionHooks.useCreate();
    const deleteAction = homepageActionHooks.useDelete();
    const [adding, setAdding] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newHref, setNewHref] = useState('');
    const [newVariant, setNewVariant] = useState('default');
    const [newIcon, setNewIcon] = useState('');

    const actions = (Array.isArray(data) ? data : []) as HomepageActionRow[];

    const handleAdd = useCallback(async () => {
        if (!newLabel.trim() || !newHref.trim()) return;
        await createAction.mutateAsync({
            sectionId,
            label: newLabel.trim(),
            href: newHref.trim(),
            variant: newVariant,
            icon: newIcon.trim() || undefined,
            external: newHref.startsWith('http'),
            sortOrder: actions.length,
        });
        setNewLabel('');
        setNewHref('');
        setNewVariant('default');
        setNewIcon('');
        setAdding(false);
    }, [createAction, sectionId, newLabel, newHref, newVariant, newIcon, actions.length]);

    if (isLoading) return <p className="text-xs text-muted-foreground">Loading actions…</p>;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Actions ({actions.length})
                </p>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setAdding(!adding)}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                </Button>
            </div>
            {actions.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                    <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                        {a.variant ?? 'default'}
                    </Badge>
                    {a.icon && (
                        <Badge variant="secondary" className="shrink-0 text-[10px] font-mono">
                            {a.icon}
                        </Badge>
                    )}
                    <span className="truncate font-medium">{a.label}</span>
                    <span className="ml-auto truncate text-xs text-muted-foreground">{a.href}</span>
                    {a.external && <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => deleteAction.mutate(a.id)}
                    >
                        <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                </div>
            ))}
            {adding && (
                <div className="space-y-2 rounded border border-dashed p-2">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Label"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            className="h-8 text-sm"
                        />
                        <Input
                            placeholder="URL (e.g. /about or https://...)"
                            value={newHref}
                            onChange={(e) => setNewHref(e.target.value)}
                            className="h-8 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Label className="text-xs shrink-0">Style:</Label>
                        <select
                            value={newVariant}
                            onChange={(e) => setNewVariant(e.target.value)}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                            aria-label="Button variant"
                        >
                            {ACTION_VARIANTS.map((v) => (
                                <option key={v.value} value={v.value}>
                                    {v.label}
                                </option>
                            ))}
                        </select>
                        <Input
                            placeholder="Icon (e.g. ArrowRight)"
                            value={newIcon}
                            onChange={(e) => setNewIcon(e.target.value)}
                            className="h-8 text-sm w-40"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={createAction.isPending}>
                            Save
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                                setAdding(false);
                                setNewLabel('');
                                setNewHref('');
                                setNewIcon('');
                            }}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main page ───────────────────────────────────────────────────────────────

export function AdminHomepageSectionsPage() {
    const { data, isLoading } = homepageSectionHooks.useList(
        { orderBy: 'sortOrder', orderDirection: 'asc' },
        ADMIN_LIST_QUERY_CONFIG,
    );
    const createSection = homepageSectionHooks.useCreate();
    const updateSection = homepageSectionHooks.useUpdate();
    const deleteSection = homepageSectionHooks.useDelete();
    const [deleteDialog, setDeleteDialog] = useState<{ id: string; slot: string } | null>(null);

    const sections = (Array.isArray(data) ? data : []) as HomepageSectionRow[];
    const usedSlots = new Set(sections.map((s) => s.slot));
    const availableSlots = SLOT_NAMES.filter((s) => !usedSlots.has(s));

    const handleCreateSection = async (slot: string) => {
        await createSection.mutateAsync({
            slot,
            title: SLOT_LABELS[slot as SlotName] ?? slot,
            sortOrder: sections.length,
            enabled: true,
        });
    };

    const handleToggleEnabled = async (section: HomepageSectionRow) => {
        await updateSection.mutateAsync({
            id: section.id,
            data: { enabled: !section.enabled },
        });
    };

    const handleMoveSection = async (section: HomepageSectionRow, direction: 'up' | 'down') => {
        const idx = sections.findIndex((s) => s.id === section.id);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sections.length) return;
        const other = sections[swapIdx];
        // Swap sort orders
        await updateSection.mutateAsync({ id: section.id, data: { sortOrder: other.sortOrder } });
        await updateSection.mutateAsync({ id: other.id, data: { sortOrder: section.sortOrder } });
    };

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;
        try {
            await deleteSection.mutateAsync(deleteDialog.id);
        } catch (err) {
            console.error('Failed to delete section:', err);
        } finally {
            setDeleteDialog(null);
        }
    };

    const enabledCount = sections.filter((s) => s.enabled).length;
    const totalFeatures = 0; // Could be computed if needed
    const totalActions = 0;

    return (
        <div className="space-y-6">
            <HomepageAdminNav />

            {/* Header with stats */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Homepage Sections</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage content for each homepage slot. Toggle sections on/off, reorder, and edit inline.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                        {enabledCount}/{sections.length} active
                    </Badge>
                </div>
            </div>

            {/* Quick-add for missing slots */}
            {availableSlots.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">Add Section</CardTitle>
                        <CardDescription>
                            Create a section for a slot that doesn&apos;t have one yet. Each slot maps to a section on the
                            homepage.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                            {availableSlots.map((slot) => (
                                <button
                                    key={slot}
                                    type="button"
                                    onClick={() => handleCreateSection(slot)}
                                    disabled={createSection.isPending}
                                    className="flex items-start gap-3 rounded-lg border border-dashed p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
                                >
                                    <Plus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium">{SLOT_LABELS[slot]}</p>
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {SLOT_DESCRIPTIONS[slot]}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Loading */}
            {isLoading && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">Loading sections…</p>
                    </CardContent>
                </Card>
            )}

            {/* Empty state */}
            {!isLoading && sections.length === 0 && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Layout className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mt-4 text-lg font-semibold">No sections yet</h3>
                        <p className="mt-2 text-muted-foreground">
                            Create sections for each homepage slot to populate your site with DB-driven content.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Section cards */}
            <TooltipProvider>
                {sections.map((section, idx) => (
                    <Card
                        key={section.id}
                        className={`transition-opacity ${!section.enabled ? 'opacity-60' : ''}`}
                    >
                        <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-3 min-w-0">
                                    {/* Enable/disable toggle */}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleEnabled(section)}
                                                className="mt-0.5 shrink-0"
                                                aria-label={section.enabled ? 'Disable section' : 'Enable section'}
                                            >
                                                {section.enabled ? (
                                                    <Eye className="h-4 w-4 text-primary" />
                                                ) : (
                                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                )}
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            {section.enabled ? 'Click to hide this section' : 'Click to show this section'}
                                        </TooltipContent>
                                    </Tooltip>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant="outline" className="font-mono text-xs shrink-0">
                                                {section.slot}
                                            </Badge>
                                            {section.icon && (
                                                <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                                                    {section.icon}
                                                </Badge>
                                            )}
                                            <CardTitle className="text-lg">
                                                {section.title ?? '(untitled)'}
                                            </CardTitle>
                                        </div>
                                        {section.subtitle && (
                                            <CardDescription className="mt-1">{section.subtitle}</CardDescription>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {/* Sort controls */}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleMoveSection(section, 'up')}
                                                disabled={idx === 0 || updateSection.isPending}
                                            >
                                                <ArrowUp className="h-3.5 w-3.5" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Move up</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleMoveSection(section, 'down')}
                                                disabled={idx === sections.length - 1 || updateSection.isPending}
                                            >
                                                <ArrowDown className="h-3.5 w-3.5" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Move down</TooltipContent>
                                    </Tooltip>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                        <Link to="/admin/homepage/$sectionId/edit" params={{ sectionId: section.id }}>
                                            <Edit className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setDeleteDialog({ id: section.id, slot: section.slot })}
                                    >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {section.body && <p className="text-sm text-muted-foreground line-clamp-2">{section.body}</p>}
                            {section.cssClasses && (
                                <p className="text-xs font-mono text-muted-foreground">
                                    CSS: {section.cssClasses}
                                </p>
                            )}

                            {/* Collapsible children */}
                            <Collapsible>
                                <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs w-full justify-start">
                                        <ChevronDown className="h-3 w-3" />
                                        Features &amp; Actions
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="grid gap-4 md:grid-cols-2 pt-2">
                                        <SectionFeatures sectionId={section.id} />
                                        <SectionActions sectionId={section.id} />
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        </CardContent>
                    </Card>
                ))}
            </TooltipProvider>

            {/* Delete confirmation */}
            <AlertDialog open={deleteDialog !== null} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Section?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the &quot;{deleteDialog?.slot}&quot; section and all its features and
                            actions. This cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteSection.isPending}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDelete} disabled={deleteSection.isPending}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
