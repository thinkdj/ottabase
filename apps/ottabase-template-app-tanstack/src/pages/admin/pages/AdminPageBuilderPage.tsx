/**
 * Admin Page Builder
 *
 * Full-featured page editor with tab-based section management.
 * Similar to homepage builder but works for any page by ID.
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
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, Check, ExternalLink, Palette, Plus, Save, Settings, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ACTION_VARIANTS,
    getSlotConfig,
    PAGE_STATUS_OPTIONS,
    SLOT_TYPES,
    THEME_PRESETS,
    type SlotConfig,
} from './pages-constants';

// ── Settings Tab ────────────────────────────────────────────────────────────

function SettingsTab({ page, onSave }: { page: PageRow; onSave: (data: Partial<PageRow>) => void }) {
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
    const [saved, setSaved] = useState(false);

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
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="space-y-8">
            {/* Page Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Page Info</CardTitle>
                    <CardDescription>Basic page settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
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
                            {page.slug === 'homepage' && (
                                <p className="text-xs text-muted-foreground">Homepage slug cannot be changed</p>
                            )}
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
                </CardContent>
            </Card>

            {/* Theme Selection */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Theme
                    </CardTitle>
                    <CardDescription>Choose a visual theme for this page</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {THEME_PRESETS.map((preset) => (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => setForm({ ...form, themePreset: preset.id })}
                                className={`p-4 rounded-lg border text-left transition-all ${
                                    form.themePreset === preset.id
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

            {/* Navigation */}
            <Card>
                <CardHeader>
                    <CardTitle>Navigation</CardTitle>
                    <CardDescription>Control how this page appears in navigation</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label>Show in navigation</Label>
                            <p className="text-sm text-muted-foreground">Display link in site navigation</p>
                        </div>
                        <Switch checked={form.showInNav} onCheckedChange={(v) => setForm({ ...form, showInNav: v })} />
                    </div>
                    {form.showInNav && (
                        <div className="grid gap-4 md:grid-cols-3 pt-2">
                            <div className="space-y-2">
                                <Label>Nav Label (optional)</Label>
                                <Input
                                    value={form.navLabel}
                                    onChange={(e) => setForm({ ...form, navLabel: e.target.value })}
                                    placeholder={form.title || 'Page title'}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Nav Order</Label>
                                <Input
                                    type="number"
                                    value={form.navOrder}
                                    onChange={(e) => setForm({ ...form, navOrder: parseInt(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Icon (Lucide name)</Label>
                                <Input
                                    value={form.icon}
                                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                                    placeholder="e.g. FileText"
                                />
                            </div>
                        </div>
                    )}
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
                            rows={3}
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
                        value={form.customCss}
                        onChange={(e) => setForm({ ...form, customCss: e.target.value })}
                        placeholder=".hero { background: linear-gradient(...); }"
                        rows={5}
                        className="font-mono text-sm"
                    />
                </CardContent>
            </Card>

            {/* Save */}
            <div className="flex justify-end pt-4">
                <Button onClick={handleSave} size="lg">
                    {saved ? <Check className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                    {saved ? 'Saved!' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
}

// ── Section Tab ─────────────────────────────────────────────────────────────

function SectionTab({
    slotConfig,
    pageId,
    section,
    features,
    actions,
    onCreateSection,
    onUpdateSection,
    onToggleSection,
    onDeleteSection,
    onRefresh,
}: {
    slotConfig: SlotConfig;
    pageId: string;
    section: PageSectionRow | null;
    features: PageFeatureRow[];
    actions: PageActionRow[];
    onCreateSection: () => void;
    onUpdateSection: (data: Partial<PageSectionRow>) => void;
    onToggleSection: () => void;
    onDeleteSection: () => void;
    onRefresh: () => void;
}) {
    const createFeature = pageFeatureHooks.useCreate();
    const deleteFeature = pageFeatureHooks.useDelete();
    const createAction = pageActionHooks.useCreate();
    const deleteAction = pageActionHooks.useDelete();

    const [form, setForm] = useState({
        title: section?.title || '',
        subtitle: section?.subtitle || '',
        body: section?.body || '',
        icon: section?.icon || '',
        githubUrl: section?.githubUrl || '',
        variant: section?.variant || slotConfig.defaultVariant,
    });

    const [newFeature, setNewFeature] = useState({ title: '', description: '', icon: '' });
    const [newAction, setNewAction] = useState({ label: '', href: '', variant: 'default', icon: '' });
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (section) {
            setForm({
                title: section.title || '',
                subtitle: section.subtitle || '',
                body: section.body || '',
                icon: section.icon || '',
                githubUrl: section.githubUrl || '',
                variant: section.variant || slotConfig.defaultVariant,
            });
        }
    }, [section, slotConfig.defaultVariant]);

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

    const SlotIcon = slotConfig.icon;

    // Section not created yet
    if (!section) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <SlotIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">{slotConfig.label} Section</h3>
                <p className="text-muted-foreground mb-6 max-w-md">{slotConfig.description}</p>
                <Button onClick={onCreateSection}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create {slotConfig.label} Section
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
                        <SlotIcon className={`h-5 w-5 ${section.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                        <h3 className="font-medium">{slotConfig.label} Section</h3>
                        <p className="text-sm text-muted-foreground">
                            {section.enabled ? 'Visible on page' : 'Hidden from page'}
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

            {slotConfig.id === 'navbar' && (
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
            {slotConfig.supportsFeatures && (
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
            {slotConfig.supportsActions && (
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

// ── Main Page Builder ───────────────────────────────────────────────────────

export function AdminPageBuilderPage() {
    const { pageId } = useParams({ from: '/admin/pages/$pageId' });

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
        return data.filter((s) => s.pageId === pageId);
    }, [sectionsData, pageId]);
    const features = useMemo(
        () => (Array.isArray(featuresData) ? featuresData : []) as PageFeatureRow[],
        [featuresData],
    );
    const actions = useMemo(() => (Array.isArray(actionsData) ? actionsData : []) as PageActionRow[], [actionsData]);

    // Lookup maps
    const sectionBySlot = useMemo(() => {
        const map: Record<string, PageSectionRow> = {};
        for (const s of sections) map[s.slot] = s;
        return map;
    }, [sections]);

    const featuresBySectionId = useMemo(() => {
        const map: Record<string, PageFeatureRow[]> = {};
        for (const f of features) {
            if (!map[f.sectionId]) map[f.sectionId] = [];
            map[f.sectionId].push(f);
        }
        return map;
    }, [features]);

    const actionsBySectionId = useMemo(() => {
        const map: Record<string, PageActionRow[]> = {};
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

    // Page update
    const handleUpdatePage = async (data: Partial<PageRow>) => {
        await updatePage.mutateAsync({ id: pageId, data });
        refetchPage();
    };

    // Section CRUD
    const handleCreateSection = async (slotId: string) => {
        const slotConfig = getSlotConfig(slotId);
        await createSection.mutateAsync({
            pageId,
            slot: slotId,
            title: slotConfig?.label ?? slotId,
            variant: slotConfig?.defaultVariant ?? 'default',
            enabled: true,
            sortOrder: sections.length,
        });
        handleRefresh();
    };

    const handleUpdateSection = async (id: string, data: Partial<PageSectionRow>) => {
        await updateSection.mutateAsync({ id, data });
        handleRefresh();
    };

    const handleToggleSection = async (section: PageSectionRow) => {
        await updateSection.mutateAsync({ id: section.id, data: { enabled: !section.enabled } });
        handleRefresh();
    };

    const handleDeleteSection = async (section: PageSectionRow) => {
        if (!confirm(`Delete "${section.title || section.slot}" section?`)) return;
        await deleteSection.mutateAsync(section.id);
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
        <div className="min-h-screen">
            {/* Header */}
            <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <Link to="/admin/pages" className="p-2 rounded-lg hover:bg-muted">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <div>
                            <h1 className="text-xl font-semibold">{page.title}</h1>
                            <p className="text-sm text-muted-foreground">/{page.slug}</p>
                        </div>
                        <Badge variant={page.status === 'published' ? 'default' : 'secondary'}>{page.status}</Badge>
                    </div>
                    <a
                        href={`${import.meta.env.VITE_HOMEPAGE_URL || 'http://localhost:3000'}/${page.slug === 'homepage' ? '' : page.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Button variant="outline">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Preview
                        </Button>
                    </a>
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="settings" className="w-full">
                <div className="border-b px-6 overflow-x-auto">
                    <TabsList className="h-12 bg-transparent gap-2 flex-nowrap">
                        <TabsTrigger value="settings" className="data-[state=active]:bg-muted gap-2">
                            <Settings className="h-4 w-4" />
                            Settings
                        </TabsTrigger>
                        {SLOT_TYPES.map((type) => {
                            const section = sectionBySlot[type.id];
                            return (
                                <TabsTrigger
                                    key={type.id}
                                    value={type.id}
                                    className="data-[state=active]:bg-muted gap-2 whitespace-nowrap"
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
                        <SettingsTab page={page} onSave={handleUpdatePage} />
                    </TabsContent>

                    {SLOT_TYPES.map((type) => {
                        const section = sectionBySlot[type.id] ?? null;
                        const sectionFeatures = section ? (featuresBySectionId[section.id] ?? []) : [];
                        const sectionActions = section ? (actionsBySectionId[section.id] ?? []) : [];

                        return (
                            <TabsContent key={type.id} value={type.id} className="mt-0">
                                <SectionTab
                                    slotConfig={type}
                                    pageId={pageId}
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
