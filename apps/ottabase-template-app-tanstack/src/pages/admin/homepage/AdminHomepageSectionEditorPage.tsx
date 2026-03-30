/**
 * Admin Homepage Section Editor
 *
 * Full CRUD editor for a single homepage section. Includes inline editing of
 * child features and actions. Auto-saves on blur or button click.
 *
 * Pattern: follows AdminChangelogEditorPage (single-entity form with nested items).
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
} from '@ottabase/ui-shadcn';
import { useNavigate, useParams } from '@tanstack/react-router';
import { ArrowLeft, ExternalLink, GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { HomepageAdminNav } from './HomepageAdminNav';

const SLOT_LABELS: Record<string, string> = {
    navbar: 'Navigation Bar',
    hero: 'Hero Section',
    features: 'Features Section',
    cta: 'Call-to-Action',
    footer: 'Footer',
    about: 'About Page',
};

const ACTION_VARIANTS = [
    { value: 'default', label: 'Default' },
    { value: 'secondary', label: 'Secondary' },
    { value: 'outline', label: 'Outline' },
    { value: 'ghost', label: 'Ghost' },
] as const;

// ── Feature row editor ──────────────────────────────────────────────────────

function FeatureEditor({ feature, onDelete }: { feature: HomepageFeatureRow; onDelete: (id: string) => void }) {
    const updateFeature = homepageFeatureHooks.useUpdate();
    const [title, setTitle] = useState(feature.title);
    const [description, setDescription] = useState(feature.description);
    const dirty = title !== feature.title || description !== feature.description;

    const handleSave = useCallback(() => {
        if (!dirty) return;
        updateFeature.mutate({ id: feature.id, data: { title, description } });
    }, [dirty, feature.id, title, description, updateFeature]);

    return (
        <div className="flex items-start gap-2 rounded-lg border p-3">
            <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/40 cursor-grab" />
            <div className="flex-1 space-y-2">
                <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={handleSave}
                    placeholder="Feature title"
                    className="h-8 text-sm font-medium"
                />
                <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={handleSave}
                    placeholder="Short description"
                    rows={2}
                    className="text-sm"
                />
            </div>
            <div className="flex flex-col items-center gap-1">
                {dirty && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave}>
                        <Save className="h-3.5 w-3.5 text-primary" />
                    </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(feature.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
            </div>
        </div>
    );
}

// ── Action row editor ───────────────────────────────────────────────────────

function ActionEditor({ action, onDelete }: { action: HomepageActionRow; onDelete: (id: string) => void }) {
    const updateAction = homepageActionHooks.useUpdate();
    const [label, setLabel] = useState(action.label);
    const [href, setHref] = useState(action.href);
    const [variant, setVariant] = useState(action.variant ?? 'default');
    const [external, setExternal] = useState(action.external);
    const dirty =
        label !== action.label ||
        href !== action.href ||
        variant !== (action.variant ?? 'default') ||
        external !== action.external;

    const handleSave = useCallback(() => {
        if (!dirty) return;
        updateAction.mutate({
            id: action.id,
            data: { label, href, variant, external },
        });
    }, [dirty, action.id, label, href, variant, external, updateAction]);

    return (
        <div className="flex items-start gap-2 rounded-lg border p-3">
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
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Label className="text-xs">Style:</Label>
                        <select
                            value={variant}
                            onChange={(e) => {
                                setVariant(e.target.value);
                                // Trigger save after state update
                                setTimeout(() => handleSave(), 0);
                            }}
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
                        <Switch
                            id={`external-${action.id}`}
                            checked={external}
                            onCheckedChange={(checked) => {
                                setExternal(checked);
                                setTimeout(() => handleSave(), 0);
                            }}
                        />
                        <Label htmlFor={`external-${action.id}`} className="text-xs">
                            External
                        </Label>
                        {external && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                    </div>
                </div>
            </div>
            <div className="flex flex-col items-center gap-1">
                {dirty && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave}>
                        <Save className="h-3.5 w-3.5 text-primary" />
                    </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(action.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
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
    const createAction = homepageActionHooks.useCreate();
    const deleteAction = homepageActionHooks.useDelete();

    const features = (Array.isArray(featuresData) ? featuresData : []) as HomepageFeatureRow[];
    const actions = (Array.isArray(actionsData) ? actionsData : []) as HomepageActionRow[];

    // Local section form state
    const section = sectionData as Record<string, unknown> | undefined;
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [body, setBody] = useState('');
    const [githubUrl, setGithubUrl] = useState('');
    const [initialized, setInitialized] = useState(false);

    // Populate form when section data loads
    useEffect(() => {
        if (section && !initialized) {
            setTitle((section.title as string) ?? '');
            setSubtitle((section.subtitle as string) ?? '');
            setBody((section.body as string) ?? '');
            setGithubUrl((section.githubUrl as string) ?? '');
            setInitialized(true);
        }
    }, [section, initialized]);

    const [deleteDialog, setDeleteDialog] = useState<{ type: 'feature' | 'action'; id: string } | null>(null);

    const slot = (section?.slot as string) ?? '';
    const dirty =
        initialized &&
        (title !== ((section?.title as string) ?? '') ||
            subtitle !== ((section?.subtitle as string) ?? '') ||
            body !== ((section?.body as string) ?? '') ||
            githubUrl !== ((section?.githubUrl as string) ?? ''));

    const handleSaveSection = useCallback(async () => {
        if (!sectionId || !dirty) return;
        await updateSection.mutateAsync({ id: sectionId, data: { title, subtitle, body, githubUrl } });
    }, [sectionId, dirty, title, subtitle, body, githubUrl, updateSection]);

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
                        <h1 className="text-2xl font-bold tracking-tight">{SLOT_LABELS[slot] ?? slot}</h1>
                    </div>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Edit section content, features, and action buttons.
                    </p>
                </div>
                <Button onClick={handleSaveSection} disabled={!dirty || updateSection.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    {updateSection.isPending ? 'Saving…' : 'Save'}
                </Button>
            </div>

            {/* Section fields */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Section Content</CardTitle>
                    <CardDescription>Title, subtitle, and body text for this slot.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                    <div className="space-y-2">
                        <Label htmlFor="section-github">GitHub URL</Label>
                        <Input
                            id="section-github"
                            value={githubUrl}
                            onChange={(e) => setGithubUrl(e.target.value)}
                            placeholder="https://github.com/..."
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Features */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base">Features</CardTitle>
                            <CardDescription>Feature items displayed in this section.</CardDescription>
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
                            {features.map((f) => (
                                <FeatureEditor
                                    key={f.id}
                                    feature={f}
                                    onDelete={(id) => setDeleteDialog({ type: 'feature', id })}
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
                            <CardTitle className="text-base">Action Buttons</CardTitle>
                            <CardDescription>Call-to-action buttons for this section.</CardDescription>
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
                            No actions yet. Add buttons like "Get Started" or "Learn More".
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {actions.map((a) => (
                                <ActionEditor
                                    key={a.id}
                                    action={a}
                                    onDelete={(id) => setDeleteDialog({ type: 'action', id })}
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
