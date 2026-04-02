/**
 * Admin Homepage Builder - Tab-based UX
 *
 * Design: Full-width tabs for each section type.
 * Each tab has dedicated editing space - no cramped modals.
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
    Separator,
    Switch,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    Textarea,
} from '@ottabase/ui-shadcn';
import { IconDatabaseImport } from '@tabler/icons-react';
import {
    Check,
    ExternalLink,
    FileText,
    Grid3X3,
    Home,
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
import { ACTION_VARIANTS, THEME_PRESETS } from './homepage-constants';

// ── Section type config ─────────────────────────────────────────────────────

const SECTION_TYPES = [
    { id: 'navbar', label: 'Navbar', icon: Navigation, description: 'Top navigation bar' },
    { id: 'hero', label: 'Hero', icon: Sparkles, description: 'Main headline section' },
    { id: 'features', label: 'Features', icon: Grid3X3, description: 'Feature grid' },
    { id: 'cta', label: 'CTA', icon: Megaphone, description: 'Call to action' },
    { id: 'about', label: 'About', icon: FileText, description: 'About section' },
    { id: 'footer', label: 'Footer', icon: Rows3, description: 'Page footer' },
] as const;

type SectionType = (typeof SECTION_TYPES)[number]['id'];

// ── Settings Tab ────────────────────────────────────────────────────────────

function SettingsTab({
    display,
    onSave,
    onSeed,
    seeding,
}: {
    display: HomepageDisplaySettingsRow | null;
    onSave: (data: { themePreset: string; seoTitle?: string; seoDescription?: string; customCss?: string }) => void;
    onSeed: () => void;
    seeding: boolean;
}) {
    const [themePreset, setThemePreset] = useState(display?.themePreset ?? 'default');
    const [seoTitle, setSeoTitle] = useState(display?.seoTitle ?? '');
    const [seoDescription, setSeoDescription] = useState(display?.seoDescription ?? '');
    const [customCss, setCustomCss] = useState(display?.customCss ?? '');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (display) {
            setThemePreset(display.themePreset ?? 'default');
            setSeoTitle(display.seoTitle ?? '');
            setSeoDescription(display.seoDescription ?? '');
            setCustomCss(display.customCss ?? '');
        }
    }, [display]);

    const handleSave = () => {
        onSave({
            themePreset,
            seoTitle: seoTitle || undefined,
            seoDescription: seoDescription || undefined,
            customCss: customCss || undefined,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="space-y-8">
            {/* Theme Selection */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Theme
                    </CardTitle>
                    <CardDescription>Choose a visual theme for your homepage</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {THEME_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                onClick={() => setThemePreset(preset.id)}
                                className={`p-4 rounded-lg border text-left transition-all ${
                                    themePreset === preset.id
                                        ? 'border-primary bg-primary/5 ring-2 ring-primary shadow-sm'
                                        : 'hover:bg-muted/50 hover:border-muted-foreground/30'
                                }`}
                            >
                                <div className="font-medium">{preset.label}</div>
                                <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* SEO */}
            <Card>
                <CardHeader>
                    <CardTitle>SEO</CardTitle>
                    <CardDescription>Search engine optimization settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Page Title</Label>
                        <Input
                            value={seoTitle}
                            onChange={(e) => setSeoTitle(e.target.value)}
                            placeholder="My Amazing Product - Build Better Software"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Meta Description</Label>
                        <Textarea
                            value={seoDescription}
                            onChange={(e) => setSeoDescription(e.target.value)}
                            placeholder="A compelling description for search engines..."
                            rows={3}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Custom CSS */}
            <Card>
                <CardHeader>
                    <CardTitle>Custom CSS</CardTitle>
                    <CardDescription>Add custom styles (advanced)</CardDescription>
                </CardHeader>
                <CardContent>
                    <Textarea
                        value={customCss}
                        onChange={(e) => setCustomCss(e.target.value)}
                        placeholder=".hero { background: linear-gradient(...); }"
                        rows={5}
                        className="font-mono text-sm"
                    />
                </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4">
                <Button variant="outline" onClick={onSeed} disabled={seeding}>
                    <IconDatabaseImport className="mr-2 h-4 w-4" />
                    {seeding ? 'Seeding...' : 'Seed Demo Data'}
                </Button>
                <Button onClick={handleSave}>
                    {saved ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                    {saved ? 'Saved!' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
}

// ── Section Tab (reusable for each section type) ────────────────────────────

function SectionTab({
    sectionType,
    section,
    features,
    actions,
    onCreateSection,
    onUpdateSection,
    onToggleSection,
    onDeleteSection,
    onRefresh,
}: {
    sectionType: (typeof SECTION_TYPES)[number];
    section: HomepageSectionRow | null;
    features: HomepageFeatureRow[];
    actions: HomepageActionRow[];
    onCreateSection: () => void;
    onUpdateSection: (data: Partial<HomepageSectionRow>) => void;
    onToggleSection: () => void;
    onDeleteSection: () => void;
    onRefresh: () => void;
}) {
    const createFeature = homepageFeatureHooks.useCreate();
    const deleteFeature = homepageFeatureHooks.useDelete();
    const createAction = homepageActionHooks.useCreate();
    const deleteAction = homepageActionHooks.useDelete();

    const [form, setForm] = useState({
        title: section?.title || '',
        subtitle: section?.subtitle || '',
        body: section?.body || '',
        icon: section?.icon || '',
        githubUrl: section?.githubUrl || '',
    });

    const [newFeature, setNewFeature] = useState({ title: '', description: '', icon: '' });
    const [newAction, setNewAction] = useState({ label: '', href: '', variant: 'default', icon: '' });
    const [saved, setSaved] = useState(false);

    // Sync form with section data
    useEffect(() => {
        if (section) {
            setForm({
                title: section.title || '',
                subtitle: section.subtitle || '',
                body: section.body || '',
                icon: section.icon || '',
                githubUrl: section.githubUrl || '',
            });
        }
    }, [section]);

    const showFeatures = sectionType.id === 'features' || sectionType.id === 'about';
    const showActions = sectionType.id === 'hero' || sectionType.id === 'cta' || sectionType.id === 'about';
    const showGithub = sectionType.id === 'navbar';

    const handleSave = () => {
        onUpdateSection(form);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleAddFeature = async () => {
        if (!newFeature.title.trim() || !section) return;
        await createFeature.mutateAsync({
            sectionId: section.id,
            title: newFeature.title.trim(),
            description: newFeature.description.trim(),
            icon: newFeature.icon.trim() || undefined,
            sortOrder: features.length,
        });
        setNewFeature({ title: '', description: '', icon: '' });
        onRefresh();
    };

    const handleAddAction = async () => {
        if (!newAction.label.trim() || !newAction.href.trim() || !section) return;
        await createAction.mutateAsync({
            sectionId: section.id,
            label: newAction.label.trim(),
            href: newAction.href.trim(),
            variant: newAction.variant,
            icon: newAction.icon.trim() || undefined,
            sortOrder: actions.length,
        });
        setNewAction({ label: '', href: '', variant: 'default', icon: '' });
        onRefresh();
    };

    // Section not created yet
    if (!section) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <sectionType.icon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">{sectionType.label} Section</h3>
                <p className="text-muted-foreground mb-6 max-w-md">{sectionType.description}</p>
                <Button onClick={onCreateSection}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create {sectionType.label} Section
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${section.enabled ? 'bg-primary/10' : 'bg-muted'}`}
                    >
                        <sectionType.icon
                            className={`h-5 w-5 ${section.enabled ? 'text-primary' : 'text-muted-foreground'}`}
                        />
                    </div>
                    <div>
                        <h3 className="font-medium">{sectionType.label} Section</h3>
                        <p className="text-sm text-muted-foreground">
                            {section.enabled ? 'Visible on homepage' : 'Hidden from homepage'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="enabled" className="text-sm">
                            Enabled
                        </Label>
                        <Switch id="enabled" checked={section.enabled} onCheckedChange={onToggleSection} />
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={onDeleteSection}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Separator />

            {/* Content Fields */}
            <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="Section title"
                    />
                </div>
                <div className="space-y-2">
                    <Label>Icon (Lucide name)</Label>
                    <Input
                        value={form.icon}
                        onChange={(e) => setForm({ ...form, icon: e.target.value })}
                        placeholder="e.g. Sparkles, Zap"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Subtitle</Label>
                <Input
                    value={form.subtitle}
                    onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                    placeholder="A short tagline or description"
                />
            </div>

            <div className="space-y-2">
                <Label>Body Content</Label>
                <Textarea
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    rows={4}
                    placeholder="Main content for this section (supports markdown)"
                />
            </div>

            {showGithub && (
                <div className="space-y-2">
                    <Label>GitHub URL</Label>
                    <Input
                        value={form.githubUrl}
                        onChange={(e) => setForm({ ...form, githubUrl: e.target.value })}
                        placeholder="https://github.com/your-org/your-repo"
                    />
                </div>
            )}

            {/* Features */}
            {showFeatures && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Features</CardTitle>
                        <CardDescription>Items displayed in this section</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {features.length > 0 && (
                            <div className="space-y-2">
                                {features.map((f) => (
                                    <div
                                        key={f.id}
                                        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                                    >
                                        {f.icon && <Badge variant="secondary">{f.icon}</Badge>}
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
                                            onClick={async () => {
                                                await deleteFeature.mutateAsync(f.id);
                                                onRefresh();
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Separator />
                        <div className="space-y-3">
                            <Label className="text-sm">Add Feature</Label>
                            <div className="grid gap-3 md:grid-cols-3">
                                <Input
                                    placeholder="Title"
                                    value={newFeature.title}
                                    onChange={(e) => setNewFeature({ ...newFeature, title: e.target.value })}
                                />
                                <Input
                                    placeholder="Description"
                                    value={newFeature.description}
                                    onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                                />
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Icon"
                                        value={newFeature.icon}
                                        onChange={(e) => setNewFeature({ ...newFeature, icon: e.target.value })}
                                        className="flex-1"
                                    />
                                    <Button onClick={handleAddFeature} disabled={!newFeature.title.trim()}>
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Actions */}
            {showActions && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base">Buttons / Actions</CardTitle>
                        <CardDescription>Call-to-action buttons in this section</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {actions.length > 0 && (
                            <div className="space-y-2">
                                {actions.map((a) => (
                                    <div
                                        key={a.id}
                                        className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                                    >
                                        <Badge variant="outline">{a.variant || 'default'}</Badge>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm">{a.label}</p>
                                            <p className="text-xs text-muted-foreground truncate">{a.href}</p>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 shrink-0"
                                            onClick={async () => {
                                                await deleteAction.mutateAsync(a.id);
                                                onRefresh();
                                            }}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Separator />
                        <div className="space-y-3">
                            <Label className="text-sm">Add Button</Label>
                            <div className="grid gap-3 md:grid-cols-4">
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
                                <Select
                                    value={newAction.variant}
                                    onValueChange={(v) => setNewAction({ ...newAction, variant: v })}
                                >
                                    <SelectTrigger>
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
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Save */}
            <div className="flex justify-end pt-4">
                <Button onClick={handleSave} size="lg">
                    {saved ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                    {saved ? 'Saved!' : 'Save Changes'}
                </Button>
            </div>
        </div>
    );
}

// ── Main Builder Page ───────────────────────────────────────────────────────

export function AdminHomepageBuilderPage() {
    // Data hooks
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

    const createSection = homepageSectionHooks.useCreate();
    const updateSection = homepageSectionHooks.useUpdate();
    const deleteSection = homepageSectionHooks.useDelete();
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

    // Lookup maps
    const sectionBySlot = useMemo(() => {
        const map: Record<string, HomepageSectionRow> = {};
        for (const s of sections) map[s.slot] = s;
        return map;
    }, [sections]);

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

    // Refresh
    const handleRefresh = useCallback(() => {
        refetchSections();
        refetchFeatures();
        refetchActions();
    }, [refetchSections, refetchFeatures, refetchActions]);

    // Section CRUD
    const handleCreateSection = async (type: SectionType) => {
        const typeInfo = SECTION_TYPES.find((t) => t.id === type);
        await createSection.mutateAsync({
            slot: type,
            title: typeInfo?.label ?? type,
            enabled: true,
            sortOrder: sections.length,
        });
        handleRefresh();
    };

    const handleUpdateSection = async (id: string, data: Partial<HomepageSectionRow>) => {
        await updateSection.mutateAsync({ id, data });
        handleRefresh();
    };

    const handleToggleSection = async (section: HomepageSectionRow) => {
        await updateSection.mutateAsync({ id: section.id, data: { enabled: !section.enabled } });
        handleRefresh();
    };

    const handleDeleteSection = async (section: HomepageSectionRow) => {
        if (!confirm(`Delete "${section.title || section.slot}" section?`)) return;
        await deleteSection.mutateAsync(section.id);
        handleRefresh();
    };

    // Display settings
    const handleSaveSettings = async (data: {
        themePreset: string;
        seoTitle?: string;
        seoDescription?: string;
        customCss?: string;
    }) => {
        if (display) {
            await updateDisplay.mutateAsync({ id: 'default', data });
        } else {
            await createDisplay.mutateAsync({ id: 'default', ...data });
        }
        refetchDisplay();
    };

    // Seed
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
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-muted-foreground">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen">
            {/* Header */}
            <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Home className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold">Homepage Builder</h1>
                            <p className="text-sm text-muted-foreground">{sections.length} sections configured</p>
                        </div>
                    </div>
                    <a
                        href={import.meta.env.VITE_HOMEPAGE_URL || 'http://localhost:3000'}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Button variant="outline">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Preview Site
                        </Button>
                    </a>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="settings" className="w-full">
                <div className="border-b px-6">
                    <TabsList className="h-12 bg-transparent gap-2">
                        <TabsTrigger value="settings" className="data-[state=active]:bg-muted gap-2">
                            <Settings className="h-4 w-4" />
                            Settings
                        </TabsTrigger>
                        {SECTION_TYPES.map((type) => {
                            const section = sectionBySlot[type.id];
                            return (
                                <TabsTrigger
                                    key={type.id}
                                    value={type.id}
                                    className="data-[state=active]:bg-muted gap-2"
                                >
                                    <type.icon className="h-4 w-4" />
                                    {type.label}
                                    {section && (
                                        <span
                                            className={`w-2 h-2 rounded-full ${section.enabled ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
                                        />
                                    )}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </div>

                <div className="p-6 max-w-4xl mx-auto">
                    <TabsContent value="settings" className="mt-0">
                        <SettingsTab
                            display={display}
                            onSave={handleSaveSettings}
                            onSeed={handleSeed}
                            seeding={seeding}
                        />
                    </TabsContent>

                    {SECTION_TYPES.map((type) => {
                        const section = sectionBySlot[type.id] ?? null;
                        const sectionFeatures = section ? (featuresBySectionId[section.id] ?? []) : [];
                        const sectionActions = section ? (actionsBySectionId[section.id] ?? []) : [];

                        return (
                            <TabsContent key={type.id} value={type.id} className="mt-0">
                                <SectionTab
                                    sectionType={type}
                                    section={section}
                                    features={sectionFeatures}
                                    actions={sectionActions}
                                    onCreateSection={() => handleCreateSection(type.id)}
                                    onUpdateSection={(data) => section && handleUpdateSection(section.id, data)}
                                    onToggleSection={() => section && handleToggleSection(section)}
                                    onDeleteSection={() => section && handleDeleteSection(section)}
                                    onRefresh={handleRefresh}
                                />
                            </TabsContent>
                        );
                    })}
                </div>
            </Tabs>
        </div>
    );
}
