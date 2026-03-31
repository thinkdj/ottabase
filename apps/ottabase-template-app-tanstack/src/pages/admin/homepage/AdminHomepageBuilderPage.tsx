/**
 * Admin Homepage Builder
 *
 * Unified single-page builder for managing the entire homepage.
 * All slots, content, features, actions, and display settings in one place.
 *
 * Design principles:
 * - One page, one mental model: "I'm editing my homepage"
 * - Visual slot cards in layout order
 * - Click to expand → edit everything inline
 * - Settings collapsed at top (theme, SEO, CSS)
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import {
    homepageActionHooks,
    homepageDisplaySettingsHooks,
    homepageFeatureHooks,
    homepageSectionHooks,
    type HomepageActionRow,
    type HomepageDisplaySettingsRow,
    type HomepageFeatureRow,
    type HomepageSectionRow,
} from '@/hooks/homepageHooks';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
    Switch,
    Textarea,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@ottabase/ui-shadcn';
import { IconDatabaseImport } from '@tabler/icons-react';
import {
    ChevronDown,
    ExternalLink,
    FileText,
    Grid3X3,
    Home,
    Layout,
    Megaphone,
    Navigation,
    Palette,
    Plus,
    Rows3,
    Save,
    Settings,
    Sparkles,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ACTION_VARIANTS,
    SLOT_CONFIG,
    SLOT_DESCRIPTIONS,
    SLOT_LABELS,
    SLOT_NAMES,
    THEME_PRESETS,
    type SlotName,
} from './homepage-constants';

// ── Icon map for slots ──────────────────────────────────────────────────────

const SLOT_ICON_MAP: Record<SlotName, React.FC<{ className?: string }>> = {
    navbar: Navigation,
    hero: Sparkles,
    features: Grid3X3,
    cta: Megaphone,
    footer: Rows3,
    about: FileText,
};

// ── Inline Feature Editor ───────────────────────────────────────────────────

function FeatureEditor({
    sectionId,
    features,
    onRefresh,
}: {
    sectionId: string;
    features: HomepageFeatureRow[];
    onRefresh: () => void;
}) {
    const createFeature = homepageFeatureHooks.useCreate();
    const updateFeature = homepageFeatureHooks.useUpdate();
    const deleteFeature = homepageFeatureHooks.useDelete();
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newIcon, setNewIcon] = useState('');

    const handleAdd = async () => {
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
        onRefresh();
    };

    const handleDelete = async (id: string) => {
        await deleteFeature.mutateAsync(id);
        onRefresh();
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Features ({features.length})
                </Label>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAdding(!adding)}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add Feature
                </Button>
            </div>

            {features.map((f) => (
                <div key={f.id} className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                    {f.icon && (
                        <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                            {f.icon}
                        </Badge>
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{f.title}</p>
                        <p className="text-xs text-muted-foreground">{f.description}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDelete(f.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                </div>
            ))}

            {adding && (
                <div className="space-y-2 rounded-md border border-dashed p-3">
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
                            className="h-8 w-28 text-sm"
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

// ── Inline Action Editor ────────────────────────────────────────────────────

function ActionEditor({
    sectionId,
    actions,
    onRefresh,
}: {
    sectionId: string;
    actions: HomepageActionRow[];
    onRefresh: () => void;
}) {
    const createAction = homepageActionHooks.useCreate();
    const deleteAction = homepageActionHooks.useDelete();
    const [adding, setAdding] = useState(false);
    const [newLabel, setNewLabel] = useState('');
    const [newHref, setNewHref] = useState('');
    const [newVariant, setNewVariant] = useState('default');
    const [newIcon, setNewIcon] = useState('');

    const handleAdd = async () => {
        if (!newLabel.trim() || !newHref.trim()) return;
        await createAction.mutateAsync({
            sectionId,
            label: newLabel.trim(),
            href: newHref.trim(),
            variant: newVariant,
            icon: newIcon.trim() || undefined,
            sortOrder: actions.length,
        });
        setNewLabel('');
        setNewHref('');
        setNewVariant('default');
        setNewIcon('');
        setAdding(false);
        onRefresh();
    };

    const handleDelete = async (id: string) => {
        await deleteAction.mutateAsync(id);
        onRefresh();
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions / Buttons ({actions.length})
                </Label>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAdding(!adding)}>
                    <Plus className="mr-1 h-3 w-3" />
                    Add Button
                </Button>
            </div>

            {actions.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                    <Badge variant="outline" className="shrink-0 text-xs">
                        {a.variant || 'default'}
                    </Badge>
                    <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{a.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{a.href}</p>
                    </div>
                    {a.icon && (
                        <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                            {a.icon}
                        </Badge>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                </div>
            ))}

            {adding && (
                <div className="space-y-2 rounded-md border border-dashed p-3">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Button label"
                            value={newLabel}
                            onChange={(e) => setNewLabel(e.target.value)}
                            className="h-8 text-sm"
                        />
                        <Select value={newVariant} onValueChange={setNewVariant}>
                            <SelectTrigger className="h-8 w-28 text-sm">
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
                    </div>
                    <div className="flex gap-2">
                        <Input
                            placeholder="URL (e.g. /docs or https://...)"
                            value={newHref}
                            onChange={(e) => setNewHref(e.target.value)}
                            className="h-8 text-sm flex-1"
                        />
                        <Input
                            placeholder="Icon"
                            value={newIcon}
                            onChange={(e) => setNewIcon(e.target.value)}
                            className="h-8 w-24 text-sm"
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
                                setNewVariant('default');
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

// ── Slot Card Component ─────────────────────────────────────────────────────

function SlotCard({
    slot,
    section,
    features,
    actions,
    variantBySlot,
    onSectionChange,
    onVariantChange,
    onRefresh,
}: {
    slot: SlotName;
    section: HomepageSectionRow | null;
    features: HomepageFeatureRow[];
    actions: HomepageActionRow[];
    variantBySlot: Record<string, string>;
    onSectionChange: (slot: SlotName, field: string, value: unknown) => void;
    onVariantChange: (slot: SlotName, variantId: string) => void;
    onRefresh: () => void;
}) {
    const createSection = homepageSectionHooks.useCreate();
    const updateSection = homepageSectionHooks.useUpdate();

    const SlotIcon = SLOT_ICON_MAP[slot];
    const config = SLOT_CONFIG[slot];
    const currentVariant = variantBySlot[slot] || config.default;
    const isEnabled = section?.enabled ?? true;

    // Create section if it doesn't exist
    const handleEnsureSection = async () => {
        if (!section) {
            await createSection.mutateAsync({
                slot,
                title: SLOT_LABELS[slot],
                enabled: true,
                sortOrder: SLOT_NAMES.indexOf(slot),
            });
            onRefresh();
        }
    };

    // Update section field
    const handleFieldChange = async (field: string, value: unknown) => {
        if (!section) {
            await handleEnsureSection();
            return;
        }
        await updateSection.mutateAsync({ id: section.id, data: { [field]: value } });
        onSectionChange(slot, field, value);
    };

    // Toggle enabled state
    const handleToggleEnabled = async () => {
        if (!section) {
            await createSection.mutateAsync({
                slot,
                title: SLOT_LABELS[slot],
                enabled: true,
                sortOrder: SLOT_NAMES.indexOf(slot),
            });
            onRefresh();
            return;
        }
        await updateSection.mutateAsync({ id: section.id, data: { enabled: !isEnabled } });
        onRefresh();
    };

    return (
        <AccordionItem value={slot} className="border rounded-lg">
            <div className="flex items-center gap-3 px-4 py-3 [&:has([data-state=open])]:bg-muted/50">
                <AccordionTrigger className="flex items-center gap-3 flex-1 hover:no-underline p-0 [&>svg:last-child]:hidden">
                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
                        <SlotIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{SLOT_LABELS[slot]}</span>
                            {!isEnabled && (
                                <Badge variant="secondary" className="text-[10px]">
                                    Hidden
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">{SLOT_DESCRIPTIONS[slot]}</p>
                    </div>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                </AccordionTrigger>
                <div className="flex items-center gap-2">
                    <Select value={currentVariant} onValueChange={(v) => onVariantChange(slot, v)}>
                        <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {config.variants.map((v) => (
                                <SelectItem key={v.id} value={v.id}>
                                    {v.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div>
                                    <Switch
                                        checked={isEnabled}
                                        onCheckedChange={handleToggleEnabled}
                                        className="data-[state=checked]:bg-green-500"
                                    />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isEnabled ? 'Visible on homepage' : 'Hidden from homepage'}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
            <AccordionContent className="px-4 pb-4">
                <div className="space-y-4 pt-2">
                    {/* Section Content Fields */}
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor={`${slot}-title`} className="text-xs">
                                Title
                            </Label>
                            <Input
                                id={`${slot}-title`}
                                value={section?.title || ''}
                                onChange={(e) => handleFieldChange('title', e.target.value)}
                                placeholder={`${SLOT_LABELS[slot]} title`}
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${slot}-icon`} className="text-xs">
                                Icon (Lucide name)
                            </Label>
                            <Input
                                id={`${slot}-icon`}
                                value={section?.icon || ''}
                                onChange={(e) => handleFieldChange('icon', e.target.value)}
                                placeholder="e.g. Sparkles, Zap, Shield"
                                className="h-9"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor={`${slot}-subtitle`} className="text-xs">
                            Subtitle
                        </Label>
                        <Input
                            id={`${slot}-subtitle`}
                            value={section?.subtitle || ''}
                            onChange={(e) => handleFieldChange('subtitle', e.target.value)}
                            placeholder="Short tagline or description"
                            className="h-9"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor={`${slot}-body`} className="text-xs">
                            Body Content
                        </Label>
                        <Textarea
                            id={`${slot}-body`}
                            value={section?.body || ''}
                            onChange={(e) => handleFieldChange('body', e.target.value)}
                            placeholder="Main content for this section (supports markdown)"
                            rows={3}
                        />
                    </div>

                    {/* Navbar-specific: GitHub URL */}
                    {slot === 'navbar' && (
                        <div className="space-y-2">
                            <Label htmlFor={`${slot}-github`} className="text-xs">
                                GitHub URL
                            </Label>
                            <Input
                                id={`${slot}-github`}
                                value={section?.githubUrl || ''}
                                onChange={(e) => handleFieldChange('githubUrl', e.target.value)}
                                placeholder="https://github.com/your-org/your-repo"
                                className="h-9"
                            />
                        </div>
                    )}

                    <Separator />

                    {/* Features (for features, about slots) */}
                    {(slot === 'features' || slot === 'about') && section && (
                        <FeatureEditor sectionId={section.id} features={features} onRefresh={onRefresh} />
                    )}

                    {/* Actions (for hero, cta, about slots) */}
                    {(slot === 'hero' || slot === 'cta' || slot === 'about') && section && (
                        <ActionEditor sectionId={section.id} actions={actions} onRefresh={onRefresh} />
                    )}

                    {/* Prompt to create section if none exists */}
                    {!section && (
                        <div className="text-center py-4">
                            <p className="text-sm text-muted-foreground mb-2">This slot has no content yet.</p>
                            <Button size="sm" onClick={handleEnsureSection}>
                                <Plus className="mr-1 h-4 w-4" />
                                Initialize Section
                            </Button>
                        </div>
                    )}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

// ── Main Builder Page ───────────────────────────────────────────────────────

export function AdminHomepageBuilderPage() {
    // Load all data
    const {
        data: sectionsData,
        isLoading: sectionsLoading,
        refetch: refetchSections,
    } = homepageSectionHooks.useList({ orderBy: 'sortOrder', orderDirection: 'asc' }, ADMIN_LIST_QUERY_CONFIG);

    const { data: featuresData, refetch: refetchFeatures } = homepageFeatureHooks.useList(
        { orderBy: 'sortOrder', orderDirection: 'asc' },
        ADMIN_LIST_QUERY_CONFIG,
    );

    const { data: actionsData, refetch: refetchActions } = homepageActionHooks.useList(
        { orderBy: 'sortOrder', orderDirection: 'asc' },
        ADMIN_LIST_QUERY_CONFIG,
    );

    const {
        data: displayData,
        isLoading: displayLoading,
        refetch: refetchDisplay,
    } = homepageDisplaySettingsHooks.useList({}, ADMIN_LIST_QUERY_CONFIG);

    const createDisplay = homepageDisplaySettingsHooks.useCreate();
    const updateDisplay = homepageDisplaySettingsHooks.useUpdate();

    // Normalize data
    const sections = useMemo(
        () => (Array.isArray(sectionsData) ? sectionsData : []) as HomepageSectionRow[],
        [sectionsData],
    );
    const features = useMemo(
        () => (Array.isArray(featuresData) ? featuresData : []) as HomepageFeatureRow[],
        [featuresData],
    );
    const actions = useMemo(
        () => (Array.isArray(actionsData) ? actionsData : []) as HomepageActionRow[],
        [actionsData],
    );
    const displayRows = useMemo(
        () => (Array.isArray(displayData) ? displayData : []) as HomepageDisplaySettingsRow[],
        [displayData],
    );
    const display = displayRows.find((r) => r.id === 'default') ?? null;

    // Section lookup by slot
    const sectionBySlot = useMemo(() => {
        const map: Partial<Record<SlotName, HomepageSectionRow>> = {};
        for (const s of sections) {
            if (SLOT_NAMES.includes(s.slot as SlotName)) {
                map[s.slot as SlotName] = s;
            }
        }
        return map;
    }, [sections]);

    // Features/actions grouped by sectionId
    const featuresBySectionId = useMemo(() => {
        const map: Record<string, HomepageFeatureRow[]> = {};
        for (const f of features) {
            if (!map[f.sectionId]) map[f.sectionId] = [];
            map[f.sectionId].push(f);
        }
        return map;
    }, [features]);

    const actionsBySectionId = useMemo(() => {
        const map: Record<string, HomepageActionRow[]> = {};
        for (const a of actions) {
            if (!map[a.sectionId]) map[a.sectionId] = [];
            map[a.sectionId].push(a);
        }
        return map;
    }, [actions]);

    // Local state for display settings
    const getDefaultVariantBySlot = () =>
        Object.fromEntries(SLOT_NAMES.map((s) => [s, SLOT_CONFIG[s].default])) as Record<string, string>;

    const [variantBySlot, setVariantBySlot] = useState<Record<string, string>>(getDefaultVariantBySlot());
    const [themePreset, setThemePreset] = useState('default');
    const [customCss, setCustomCss] = useState('');
    const [seoTitle, setSeoTitle] = useState('');
    const [seoDescription, setSeoDescription] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [initialized, setInitialized] = useState(false);

    // Populate from DB
    useEffect(() => {
        if (display && !initialized) {
            setVariantBySlot({ ...getDefaultVariantBySlot(), ...(display.variantBySlotJson ?? {}) });
            setThemePreset(display.themePreset ?? 'default');
            setCustomCss(display.customCss ?? '');
            setSeoTitle(display.seoTitle ?? '');
            setSeoDescription(display.seoDescription ?? '');
            setInitialized(true);
        } else if (!displayLoading && !display && !initialized) {
            setInitialized(true);
        }
    }, [display, displayLoading, initialized]);

    // Save display settings
    const handleSaveDisplaySettings = async () => {
        const payload = {
            variantBySlotJson: variantBySlot,
            themePreset,
            customCss: customCss || undefined,
            seoTitle: seoTitle || undefined,
            seoDescription: seoDescription || undefined,
        };
        if (display) {
            await updateDisplay.mutateAsync({ id: 'default', data: payload });
        } else {
            await createDisplay.mutateAsync({ id: 'default', ...payload });
        }
        refetchDisplay();
    };

    // Variant change handler
    const handleVariantChange = useCallback((slot: SlotName, variantId: string) => {
        setVariantBySlot((prev) => ({ ...prev, [slot]: variantId }));
    }, []);

    // Section field change (just refresh data)
    const handleSectionChange = useCallback(() => {
        refetchSections();
    }, [refetchSections]);

    // Refresh all data
    const handleRefresh = useCallback(() => {
        refetchSections();
        refetchFeatures();
        refetchActions();
    }, [refetchSections, refetchFeatures, refetchActions]);

    // Seed demo data
    const [seeding, setSeeding] = useState(false);
    const handleSeed = async () => {
        setSeeding(true);
        try {
            const res = await fetch('/api/homepage/seed', { method: 'POST' });
            if (res.ok) {
                handleRefresh();
                refetchDisplay();
            }
        } finally {
            setSeeding(false);
        }
    };

    if (sectionsLoading || displayLoading) {
        return (
            <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-2">
                        <Home className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">Homepage Builder</h1>
                        <p className="text-sm text-muted-foreground">Loading...</p>
                    </div>
                </div>
            </div>
        );
    }

    const isDirty =
        initialized &&
        (JSON.stringify(variantBySlot) !==
            JSON.stringify({ ...getDefaultVariantBySlot(), ...(display?.variantBySlotJson ?? {}) }) ||
            themePreset !== (display?.themePreset ?? 'default') ||
            customCss !== (display?.customCss ?? '') ||
            seoTitle !== (display?.seoTitle ?? '') ||
            seoDescription !== (display?.seoDescription ?? ''));

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-2">
                        <Home className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">Homepage Builder</h1>
                        <p className="text-sm text-muted-foreground">
                            Configure all sections, content, and display settings
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
                                    <IconDatabaseImport className="mr-1 h-4 w-4" />
                                    Seed Demo
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Populate all sections with demo content</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    <a
                        href={import.meta.env.VITE_HOMEPAGE_URL || 'http://localhost:3000'}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Button variant="outline" size="sm">
                            <ExternalLink className="mr-1 h-4 w-4" />
                            Preview
                        </Button>
                    </a>
                </div>
            </div>

            {/* Settings Panel (Collapsible) */}
            <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
                <Card>
                    <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Settings className="h-4 w-4 text-muted-foreground" />
                                    <CardTitle className="text-base">Display Settings</CardTitle>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isDirty && (
                                        <Badge variant="secondary" className="text-xs">
                                            Unsaved
                                        </Badge>
                                    )}
                                    <Badge variant="outline" className="text-xs capitalize">
                                        {themePreset} theme
                                    </Badge>
                                    <ChevronDown
                                        className={`h-4 w-4 text-muted-foreground transition-transform ${settingsOpen ? 'rotate-180' : ''}`}
                                    />
                                </div>
                            </div>
                            <CardDescription>Theme preset, SEO metadata, and custom styles</CardDescription>
                        </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <CardContent className="space-y-4 border-t pt-4">
                            {/* Theme Preset */}
                            <div className="space-y-2">
                                <Label className="text-xs">Theme Preset</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    {THEME_PRESETS.map((preset) => (
                                        <button
                                            key={preset.id}
                                            type="button"
                                            onClick={() => setThemePreset(preset.id)}
                                            className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
                                                themePreset === preset.id
                                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                    : ''
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Palette className="h-4 w-4" />
                                                <span className="font-medium text-sm">{preset.label}</span>
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            {/* SEO Fields */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="seo-title" className="text-xs">
                                        SEO Title
                                    </Label>
                                    <Input
                                        id="seo-title"
                                        value={seoTitle}
                                        onChange={(e) => setSeoTitle(e.target.value)}
                                        placeholder="Page title for search engines"
                                        className="h-9"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="seo-desc" className="text-xs">
                                        SEO Description
                                    </Label>
                                    <Input
                                        id="seo-desc"
                                        value={seoDescription}
                                        onChange={(e) => setSeoDescription(e.target.value)}
                                        placeholder="Meta description for search engines"
                                        className="h-9"
                                    />
                                </div>
                            </div>

                            {/* Custom CSS */}
                            <div className="space-y-2">
                                <Label htmlFor="custom-css" className="text-xs">
                                    Custom CSS (advanced)
                                </Label>
                                <Textarea
                                    id="custom-css"
                                    value={customCss}
                                    onChange={(e) => setCustomCss(e.target.value)}
                                    placeholder=".hero { background: linear-gradient(...); }"
                                    rows={3}
                                    className="font-mono text-xs"
                                />
                            </div>

                            {/* Save Button */}
                            <div className="flex justify-end">
                                <Button
                                    size="sm"
                                    onClick={handleSaveDisplaySettings}
                                    disabled={!isDirty || updateDisplay.isPending || createDisplay.isPending}
                                >
                                    <Save className="mr-1 h-4 w-4" />
                                    Save Settings
                                </Button>
                            </div>
                        </CardContent>
                    </CollapsibleContent>
                </Card>
            </Collapsible>

            {/* Slot Cards */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Layout className="h-4 w-4 text-muted-foreground" />
                    <h2 className="font-medium">Page Sections</h2>
                    <Badge variant="secondary" className="text-xs">
                        {sections.filter((s) => s.enabled).length} / {SLOT_NAMES.length} active
                    </Badge>
                </div>

                <Accordion type="multiple" className="space-y-3">
                    {SLOT_NAMES.map((slot) => {
                        const section = sectionBySlot[slot] ?? null;
                        const sectionFeatures = section ? featuresBySectionId[section.id] || [] : [];
                        const sectionActions = section ? actionsBySectionId[section.id] || [] : [];

                        return (
                            <SlotCard
                                key={slot}
                                slot={slot}
                                section={section}
                                features={sectionFeatures}
                                actions={sectionActions}
                                variantBySlot={variantBySlot}
                                onSectionChange={handleSectionChange}
                                onVariantChange={handleVariantChange}
                                onRefresh={handleRefresh}
                            />
                        );
                    })}
                </Accordion>
            </div>
        </div>
    );
}
