/**
 * Admin Homepage Section Editor
 *
 * Full CRUD editor for a single homepage section with all configurable fields.
 * Includes inline editing of child features and actions with icon, imageUrl, href support.
 * Auto-saves on blur or button click.
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import {
    homepageActionHooks,
    homepageFeatureHooks,
    homepageSectionHooks,
    type HomepageActionRow,
    type HomepageFeatureRow,
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
    Input,
    Label,
    Separator,
    Switch,
    Textarea,
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@ottabase/ui-shadcn';
import { useNavigate, useParams } from '@tanstack/react-router';
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    ExternalLink,
    GripVertical,
    Image,
    Link2,
    Plus,
    Save,
    Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HomepageAdminNav } from './HomepageAdminNav';
import { ACTION_VARIANTS, ICON_SUGGESTIONS, SLOT_LABELS } from './homepage-constants';

// ── Feature row editor ──────────────────────────────────────────────────────

function FeatureEditor({
    feature,
    onDelete,
    onMove,
    isFirst,
    isLast,
}: {
    feature: HomepageFeatureRow;
    onDelete: (id: string) => void;
    onMove: (id: string, direction: 'up' | 'down') => void;
    isFirst: boolean;
    isLast: boolean;
}) {
    const updateFeature = homepageFeatureHooks.useUpdate();
    const [title, setTitle] = useState(feature.title);
    const [description, setDescription] = useState(feature.description);
    const [icon, setIcon] = useState(feature.icon ?? '');
    const [imageUrl, setImageUrl] = useState(feature.imageUrl ?? '');
    const [href, setHref] = useState(feature.href ?? '');

    const dirty =
        title !== feature.title ||
        description !== feature.description ||
        icon !== (feature.icon ?? '') ||
        imageUrl !== (feature.imageUrl ?? '') ||
        href !== (feature.href ?? '');

    const handleSave = useCallback(() => {
        if (!dirty) return;
        updateFeature.mutate({
            id: feature.id,
            data: {
                title,
                description,
                icon: icon || undefined,
                imageUrl: imageUrl || undefined,
                href: href || undefined,
            },
        });
    }, [dirty, feature.id, title, description, icon, imageUrl, href, updateFeature]);

    return (
        <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-start gap-2">
                <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/40 cursor-grab" />
                <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={handleSave}
                            placeholder="Feature title"
                            className="h-8 text-sm font-medium"
                        />
                        <Input
                            value={icon}
                            onChange={(e) => setIcon(e.target.value)}
                            onBlur={handleSave}
                            placeholder="Icon (e.g. Zap)"
                            className="h-8 text-sm w-32"
                        />
                    </div>
                    <Textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={handleSave}
                        placeholder="Short description"
                        rows={2}
                        className="text-sm"
                    />
                    <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-1.5">
                            <Image className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <Input
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                onBlur={handleSave}
                                placeholder="Image URL (optional)"
                                className="h-7 text-xs"
                            />
                        </div>
                        <div className="flex-1 flex items-center gap-1.5">
                            <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <Input
                                value={href}
                                onChange={(e) => setHref(e.target.value)}
                                onBlur={handleSave}
                                placeholder="Link URL (optional)"
                                className="h-7 text-xs"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => onMove(feature.id, 'up')}
                                    disabled={isFirst}
                                >
                                    <ArrowUp className="h-3 w-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Move up</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => onMove(feature.id, 'down')}
                                    disabled={isLast}
                                >
                                    <ArrowDown className="h-3 w-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Move down</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    {dirty && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSave}>
                            <Save className="h-3.5 w-3.5 text-primary" />
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(feature.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Action row editor ───────────────────────────────────────────────────────

function ActionEditor({
    action,
    onDelete,
    onMove,
    isFirst,
    isLast,
}: {
    action: HomepageActionRow;
    onDelete: (id: string) => void;
    onMove: (id: string, direction: 'up' | 'down') => void;
    isFirst: boolean;
    isLast: boolean;
}) {
    const updateAction = homepageActionHooks.useUpdate();
    const [label, setLabel] = useState(action.label);
    const [href, setHref] = useState(action.href);
    const [variant, setVariant] = useState(action.variant ?? 'default');
    const [icon, setIcon] = useState(action.icon ?? '');
    const [external, setExternal] = useState(action.external);

    // Track previous values for useEffect-based auto-save
    const prevVariantRef = useRef(variant);
    const prevExternalRef = useRef(external);

    const dirty =
        label !== action.label ||
        href !== action.href ||
        variant !== (action.variant ?? 'default') ||
        icon !== (action.icon ?? '') ||
        external !== action.external;

    const handleSave = useCallback(() => {
        if (!dirty) return;
        updateAction.mutate({
            id: action.id,
            data: { label, href, variant, icon: icon || undefined, external },
        });
    }, [dirty, action.id, label, href, variant, icon, external, updateAction]);

    // Auto-save when variant or external toggle changes
    useEffect(() => {
        if (variant !== prevVariantRef.current || external !== prevExternalRef.current) {
            prevVariantRef.current = variant;
            prevExternalRef.current = external;
            const isDirty =
                label !== action.label ||
                href !== action.href ||
                variant !== (action.variant ?? 'default') ||
                icon !== (action.icon ?? '') ||
                external !== action.external;
            if (isDirty) {
                updateAction.mutate({
                    id: action.id,
                    data: { label, href, variant, icon: icon || undefined, external },
                });
            }
        }
    }, [variant, external]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-start gap-2">
                <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/40 cursor-grab" />
                <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                        <Input
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            onBlur={handleSave}
                            placeholder="Button label"
                            className="h-8 text-sm font-medium"
                        />
                        <Input
                            value={href}
                            onChange={(e) => setHref(e.target.value)}
                            onBlur={handleSave}
                            placeholder="/about or https://..."
                            className="h-8 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Label className="text-xs">Style:</Label>
                            <select
                                value={variant}
                                onChange={(e) => setVariant(e.target.value)}
                                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                                aria-label="Button style variant"
                            >
                                {ACTION_VARIANTS.map((v) => (
                                    <option key={v.value} value={v.value}>
                                        {v.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-xs">Icon:</Label>
                            <Input
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                onBlur={handleSave}
                                placeholder="ArrowRight"
                                className="h-7 text-xs w-28"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch id={`external-${action.id}`} checked={external} onCheckedChange={setExternal} />
                            <Label htmlFor={`external-${action.id}`} className="text-xs">
                                External
                            </Label>
                            {external && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                        </div>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => onMove(action.id, 'up')}
                                    disabled={isFirst}
                                >
                                    <ArrowUp className="h-3 w-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Move up</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => onMove(action.id, 'down')}
                                    disabled={isLast}
                                >
                                    <ArrowDown className="h-3 w-3" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Move down</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    {dirty && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSave}>
                            <Save className="h-3.5 w-3.5 text-primary" />
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(action.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Main editor page ────────────────────────────────────────────────────────

export function AdminHomepageSectionEditorPage() {
    const { sectionId } = useParams({ strict: false }) as { sectionId?: string };
    const navigate = useNavigate();

    // Section data
    const { data: sectionData, isLoading: sectionLoading } = homepageSectionHooks.useDetail(sectionId ?? '', {
        enabled: !!sectionId,
    });
    const updateSection = homepageSectionHooks.useUpdate();

    // Child features & actions
    const { data: featuresData } = homepageFeatureHooks.useList(
        { where: { sectionId }, orderBy: 'sortOrder', orderDirection: 'asc' },
        { ...ADMIN_LIST_QUERY_CONFIG, enabled: !!sectionId },
    );
    const { data: actionsData } = homepageActionHooks.useList(
        { where: { sectionId }, orderBy: 'sortOrder', orderDirection: 'asc' },
        { ...ADMIN_LIST_QUERY_CONFIG, enabled: !!sectionId },
    );

    const createFeature = homepageFeatureHooks.useCreate();
    const deleteFeature = homepageFeatureHooks.useDelete();
    const updateFeature = homepageFeatureHooks.useUpdate();
    const createAction = homepageActionHooks.useCreate();
    const deleteAction = homepageActionHooks.useDelete();
    const updateAction = homepageActionHooks.useUpdate();

    const features = (Array.isArray(featuresData) ? featuresData : []) as HomepageFeatureRow[];
    const actions = (Array.isArray(actionsData) ? actionsData : []) as HomepageActionRow[];

    // Local section form state
    const section = sectionData as Record<string, unknown> | undefined;
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [body, setBody] = useState('');
    const [githubUrl, setGithubUrl] = useState('');
    const [icon, setIcon] = useState('');
    const [enabled, setEnabled] = useState(true);
    const [cssClasses, setCssClasses] = useState('');
    const [metadataStr, setMetadataStr] = useState('');
    const [initialized, setInitialized] = useState(false);

    // Populate form when section data loads
    useEffect(() => {
        if (section && !initialized) {
            setTitle((section.title as string) ?? '');
            setSubtitle((section.subtitle as string) ?? '');
            setBody((section.body as string) ?? '');
            setGithubUrl((section.githubUrl as string) ?? '');
            setIcon((section.icon as string) ?? '');
            setEnabled((section.enabled as boolean) ?? true);
            setCssClasses((section.cssClasses as string) ?? '');
            const meta = section.metadata as Record<string, unknown> | null;
            setMetadataStr(meta ? JSON.stringify(meta, null, 2) : '');
            setInitialized(true);
        }
    }, [section, initialized]);

    // Track previous enabled value for auto-save
    const prevEnabledRef = useRef(enabled);
    useEffect(() => {
        if (initialized && enabled !== prevEnabledRef.current) {
            prevEnabledRef.current = enabled;
            if (sectionId) {
                updateSection.mutate({ id: sectionId, data: { enabled } });
            }
        }
    }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

    const [deleteDialog, setDeleteDialog] = useState<{ type: 'feature' | 'action'; id: string } | null>(null);

    const slot = (section?.slot as string) ?? '';
    const dirty =
        initialized &&
        (title !== ((section?.title as string) ?? '') ||
            subtitle !== ((section?.subtitle as string) ?? '') ||
            body !== ((section?.body as string) ?? '') ||
            githubUrl !== ((section?.githubUrl as string) ?? '') ||
            icon !== ((section?.icon as string) ?? '') ||
            cssClasses !== ((section?.cssClasses as string) ?? '') ||
            metadataStr !==
                (section?.metadata ? JSON.stringify(section.metadata as Record<string, unknown>, null, 2) : ''));

    const handleSaveSection = useCallback(async () => {
        if (!sectionId || !dirty) return;
        let metadata: Record<string, unknown> | undefined;
        if (metadataStr.trim()) {
            try {
                metadata = JSON.parse(metadataStr);
            } catch {
                // Invalid JSON — skip metadata update
            }
        }
        await updateSection.mutateAsync({
            id: sectionId,
            data: {
                title,
                subtitle,
                body,
                githubUrl,
                icon: icon || undefined,
                cssClasses: cssClasses || undefined,
                ...(metadata !== undefined ? { metadata } : {}),
            },
        });
    }, [sectionId, dirty, title, subtitle, body, githubUrl, icon, cssClasses, metadataStr, updateSection]);

    const handleAddFeature = useCallback(async () => {
        if (!sectionId) return;
        await createFeature.mutateAsync({
            sectionId,
            title: 'New Feature',
            description: 'Describe this feature',
            sortOrder: features.length,
        });
    }, [sectionId, createFeature, features.length]);

    const handleAddAction = useCallback(async () => {
        if (!sectionId) return;
        await createAction.mutateAsync({
            sectionId,
            label: 'New Button',
            href: '/',
            variant: 'default',
            external: false,
            sortOrder: actions.length,
        });
    }, [sectionId, createAction, actions.length]);

    const handleMoveFeature = useCallback(
        async (id: string, direction: 'up' | 'down') => {
            const idx = features.findIndex((f) => f.id === id);
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= features.length) return;
            const other = features[swapIdx];
            const current = features[idx];
            await updateFeature.mutateAsync({ id: current.id, data: { sortOrder: other.sortOrder } });
            await updateFeature.mutateAsync({ id: other.id, data: { sortOrder: current.sortOrder } });
        },
        [features, updateFeature],
    );

    const handleMoveAction = useCallback(
        async (id: string, direction: 'up' | 'down') => {
            const idx = actions.findIndex((a) => a.id === id);
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= actions.length) return;
            const other = actions[swapIdx];
            const current = actions[idx];
            await updateAction.mutateAsync({ id: current.id, data: { sortOrder: other.sortOrder } });
            await updateAction.mutateAsync({ id: other.id, data: { sortOrder: current.sortOrder } });
        },
        [actions, updateAction],
    );

    const handleConfirmDelete = async () => {
        if (!deleteDialog) return;
        if (deleteDialog.type === 'feature') {
            await deleteFeature.mutateAsync(deleteDialog.id);
        } else {
            await deleteAction.mutateAsync(deleteDialog.id);
        }
        setDeleteDialog(null);
    };

    if (sectionLoading) {
        return (
            <div className="space-y-6">
                <HomepageAdminNav />
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">Loading section…</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!section) {
        return (
            <div className="space-y-6">
                <HomepageAdminNav />
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">Section not found.</p>
                        <Button variant="outline" className="mt-4" onClick={() => navigate({ to: '/admin/homepage' })}>
                            Back to Sections
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <HomepageAdminNav />

            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate({ to: '/admin/homepage' })}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                            {slot}
                        </Badge>
                        {icon && (
                            <Badge variant="secondary" className="text-xs font-mono">
                                {icon}
                            </Badge>
                        )}
                        <h1 className="text-2xl font-bold tracking-tight">{SLOT_LABELS[slot] ?? slot}</h1>
                    </div>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Edit section content, features, actions, and display options.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Switch id="section-enabled" checked={enabled} onCheckedChange={setEnabled} />
                        <Label htmlFor="section-enabled" className="text-sm">
                            {enabled ? 'Visible' : 'Hidden'}
                        </Label>
                    </div>
                    <Button onClick={handleSaveSection} disabled={!dirty || updateSection.isPending}>
                        <Save className="mr-2 h-4 w-4" />
                        {updateSection.isPending ? 'Saving…' : 'Save'}
                    </Button>
                </div>
            </div>

            {/* Section Content */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Content</CardTitle>
                    <CardDescription>Title, subtitle, and body text for this slot.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="section-title">Title</Label>
                            <Input
                                id="section-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Section heading"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="section-subtitle">Subtitle</Label>
                            <Input
                                id="section-subtitle"
                                value={subtitle}
                                onChange={(e) => setSubtitle(e.target.value)}
                                placeholder="Optional subtitle or tagline"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="section-body">Body</Label>
                        <Textarea
                            id="section-body"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            placeholder="Longer description (optional)"
                            rows={4}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Display Options */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Display Options</CardTitle>
                    <CardDescription>Icon, GitHub URL, CSS classes, and metadata.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="section-icon">Icon</Label>
                            <Input
                                id="section-icon"
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                placeholder="Lucide icon name (e.g. Sparkles)"
                            />
                            <p className="text-xs text-muted-foreground">
                                Suggestions: {ICON_SUGGESTIONS.slice(0, 8).join(', ')}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="section-github">GitHub URL</Label>
                            <Input
                                id="section-github"
                                value={githubUrl}
                                onChange={(e) => setGithubUrl(e.target.value)}
                                placeholder="https://github.com/..."
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="section-css">CSS Classes</Label>
                        <Input
                            id="section-css"
                            value={cssClasses}
                            onChange={(e) => setCssClasses(e.target.value)}
                            placeholder="Custom Tailwind classes (e.g. bg-gradient-to-r from-blue-500)"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="section-metadata">Metadata (JSON)</Label>
                        <Textarea
                            id="section-metadata"
                            value={metadataStr}
                            onChange={(e) => setMetadataStr(e.target.value)}
                            placeholder='{"key": "value"}'
                            rows={3}
                            className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                            Arbitrary key-value data passed through to the frontend for custom rendering.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Features */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base">Features ({features.length})</CardTitle>
                            <CardDescription>Feature items with icon, image, and link support.</CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddFeature}
                            disabled={createFeature.isPending}
                        >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add Feature
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {features.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            No features yet. Add one to display feature items in this section.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {features.map((f, idx) => (
                                <FeatureEditor
                                    key={f.id}
                                    feature={f}
                                    onDelete={(id) => setDeleteDialog({ type: 'feature', id })}
                                    onMove={handleMoveFeature}
                                    isFirst={idx === 0}
                                    isLast={idx === features.length - 1}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Actions */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base">Action Buttons ({actions.length})</CardTitle>
                            <CardDescription>
                                Call-to-action buttons with icon, style variant, and external link support.
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleAddAction} disabled={createAction.isPending}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Add Action
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {actions.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            No actions yet. Add buttons like &quot;Get Started&quot; or &quot;Learn More&quot;.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {actions.map((a, idx) => (
                                <ActionEditor
                                    key={a.id}
                                    action={a}
                                    onDelete={(id) => setDeleteDialog({ type: 'action', id })}
                                    onMove={handleMoveAction}
                                    isFirst={idx === 0}
                                    isLast={idx === actions.length - 1}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete confirmation */}
            <AlertDialog open={deleteDialog !== null} onOpenChange={(open) => !open && setDeleteDialog(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete {deleteDialog?.type === 'feature' ? 'Feature' : 'Action'}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>This item will be permanently removed.</AlertDialogDescription>
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
