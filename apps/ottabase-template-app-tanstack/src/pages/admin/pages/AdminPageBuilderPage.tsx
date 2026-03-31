import { actionHooks, pageHooks, sectionHooks, useBlocksRegistry, featureHooks } from '@/hooks/marketingPageHooks';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Input,
    Label,
    Switch,
    Textarea,
} from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type EditableBlock = {
    id: string;
    title?: string;
    subtitle?: string;
    body?: string;
    variant?: string;
    enabled?: boolean;
};

export function AdminPageBuilderPage() {
    const { pageId } = useParams({ from: '/admin/pages/$pageId' });
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [draft, setDraft] = useState<EditableBlock | null>(null);
    const [pageDraft, setPageDraft] = useState<{ id: string; title: string; slug: string; status: string } | null>(
        null,
    );

    const pageQuery = pageHooks.useDetail(pageId);
    const sectionList = sectionHooks.useList({ filters: { pageId } as any });
    const registry = useBlocksRegistry();

    const createSection = sectionHooks.useCreate();
    const updateSection = sectionHooks.useUpdate();
    const deleteSection = sectionHooks.useDelete();

    const featureList = featureHooks.useList({ filters: { sectionId: selectedId || '' } as any });
    const createFeature = featureHooks.useCreate();
    const updateFeature = featureHooks.useUpdate();
    const deleteFeature = featureHooks.useDelete();

    const actionList = actionHooks.useList({ filters: { sectionId: selectedId || '' } as any });
    const createAction = actionHooks.useCreate();
    const updateAction = actionHooks.useUpdate();
    const deleteAction = actionHooks.useDelete();

    const updatePage = pageHooks.useUpdate();

    const sections = useMemo(() => {
        const rows = (sectionList.data?.data ?? []) as any[];
        return [...rows].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    }, [sectionList.data?.data]);

    const selected = sections.find((section) => section.id === selectedId) ?? null;
    const selectedFeatures = useMemo(() => {
        const rows = (featureList.data?.data ?? []) as any[];
        return [...rows].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    }, [featureList.data?.data]);
    const selectedActions = useMemo(() => {
        const rows = (actionList.data?.data ?? []) as any[];
        return [...rows].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    }, [actionList.data?.data]);

    useEffect(() => {
        if (!selected) {
            setDraft(null);
            return;
        }
        setDraft({
            id: selected.id,
            title: selected.title,
            subtitle: selected.subtitle,
            body: selected.body,
            variant: selected.variant,
            enabled: selected.enabled,
        });
    }, [selected?.id]);

    useEffect(() => {
        const page = (pageQuery.data as any)?.data;
        if (!page) return;
        setPageDraft({
            id: page.id,
            title: page.title || '',
            slug: page.slug || '',
            status: page.status || 'draft',
        });
    }, [(pageQuery.data as any)?.data?.id, (pageQuery.data as any)?.data?.updatedAt]);

    const reorder = async (dragId: string, dropId: string) => {
        if (dragId === dropId) return;
        const ordered = [...sections];
        const from = ordered.findIndex((row) => row.id === dragId);
        const to = ordered.findIndex((row) => row.id === dropId);
        if (from < 0 || to < 0) return;

        const [moved] = ordered.splice(from, 1);
        ordered.splice(to, 0, moved);

        await Promise.all(
            ordered.map((section, index) =>
                updateSection.mutateAsync({
                    id: section.id,
                    sortOrder: index,
                }),
            ),
        );
        toast.success('Blocks reordered');
        await sectionList.refetch();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <Link to="/admin/pages" className="text-sm text-muted-foreground hover:underline">
                        ← Back to pages
                    </Link>
                    <h1 className="text-2xl font-semibold">{pageDraft?.title || 'Page Builder'}</h1>
                    <p className="text-sm text-muted-foreground">
                        End-to-end builder with sortable blocks, features and actions.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={async () => {
                            const page = pageDraft;
                            if (!page) return;
                            const nextStatus = page.status === 'published' ? 'draft' : 'published';
                            await updatePage.mutateAsync({ id: page.id, status: nextStatus });
                            toast.success(nextStatus === 'published' ? 'Page published' : 'Page moved to draft');
                            await pageQuery.refetch();
                        }}
                    >
                        {pageDraft?.status === 'published' ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button asChild variant="outline">
                        <a href={`/pages/${pageDraft?.slug || ''}?preview=true`} target="_blank" rel="noreferrer">
                            Preview /pages route
                        </a>
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="flex flex-wrap items-end gap-3 pt-6">
                    <div className="min-w-[240px]">
                        <Label>Page Title</Label>
                        <Input
                            value={pageDraft?.title || ''}
                            onChange={(event) =>
                                setPageDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))
                            }
                        />
                    </div>
                    <div className="min-w-[240px]">
                        <Label>Slug</Label>
                        <Input
                            value={pageDraft?.slug || ''}
                            onChange={(event) =>
                                setPageDraft((prev) => (prev ? { ...prev, slug: event.target.value } : prev))
                            }
                        />
                    </div>
                    <Button
                        onClick={async () => {
                            const page = pageDraft;
                            if (!page) return;
                            await updatePage.mutateAsync({ id: page.id, title: page.title, slug: page.slug });
                            toast.success('Page settings saved');
                        }}
                    >
                        <Save className="mr-1 h-4 w-4" /> Save Page
                    </Button>
                    <Badge variant="secondary">Status: {pageDraft?.status || 'draft'}</Badge>
                </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-12">
                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Block Palette</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {(registry.data?.blocks ?? []).map((block) => (
                            <Button
                                key={block.id}
                                variant="outline"
                                className="w-full justify-start"
                                onClick={async () => {
                                    await createSection.mutateAsync({
                                        pageId,
                                        slot: block.id,
                                        variant: block.variants[0]?.id || 'default',
                                        title: block.label,
                                        enabled: true,
                                        sortOrder: sections.length,
                                    });
                                    toast.success(`${block.label} added`);
                                    await sectionList.refetch();
                                }}
                            >
                                <Plus className="mr-1 h-4 w-4" /> {block.label}
                            </Button>
                        ))}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-5">
                    <CardHeader>
                        <CardTitle>Canvas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3" role="list">
                        {sections.map((section) => (
                            <div
                                key={section.id}
                                role="listitem"
                                tabIndex={0}
                                aria-selected={selectedId === section.id}
                                aria-label={`${section.slot} block: ${section.title || 'Untitled'}`}
                                draggable
                                onDragStart={(event) => event.dataTransfer.setData('text/plain', section.id)}
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={async (event) => {
                                    event.preventDefault();
                                    const dragId = event.dataTransfer.getData('text/plain');
                                    await reorder(dragId, section.id);
                                }}
                                onClick={() => setSelectedId(section.id)}
                                className={`cursor-pointer rounded-md border p-3 ${selectedId === section.id ? 'border-primary' : ''}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">{section.slot}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {section.variant} • {section.enabled ? 'enabled' : 'disabled'}
                                        </p>
                                    </div>
                                    <button aria-label="Drag to reorder" aria-roledescription="sortable">
                                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Block Editor</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {!selected || !draft ? (
                            <p className="text-sm text-muted-foreground">Select a block from the canvas to edit.</p>
                        ) : (
                            <>
                                <div>
                                    <Label>Title</Label>
                                    <Input
                                        value={draft.title || ''}
                                        onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Subtitle</Label>
                                    <Input
                                        value={draft.subtitle || ''}
                                        onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Body</Label>
                                    <Textarea
                                        value={draft.body || ''}
                                        onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>Variant</Label>
                                    <Input
                                        value={draft.variant || ''}
                                        onChange={(event) => setDraft({ ...draft, variant: event.target.value })}
                                    />
                                </div>
                                <div className="flex items-center justify-between rounded border p-2">
                                    <Label htmlFor="enabled-toggle">Enabled</Label>
                                    <Switch
                                        id="enabled-toggle"
                                        checked={Boolean(draft.enabled)}
                                        onCheckedChange={(value) => setDraft({ ...draft, enabled: value })}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={async () => {
                                            await updateSection.mutateAsync({
                                                id: draft.id,
                                                title: draft.title,
                                                subtitle: draft.subtitle,
                                                body: draft.body,
                                                variant: draft.variant,
                                                enabled: draft.enabled,
                                            });
                                            toast.success('Block saved');
                                            await sectionList.refetch();
                                        }}
                                    >
                                        <Save className="mr-1 h-4 w-4" /> Save
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        onClick={async () => {
                                            await deleteSection.mutateAsync(selected.id);
                                            setSelectedId(null);
                                            toast.success('Block deleted');
                                            await sectionList.refetch();
                                        }}
                                    >
                                        <Trash2 className="mr-1 h-4 w-4" /> Delete
                                    </Button>
                                </div>

                                <div className="space-y-2 pt-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium">Features</p>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={async () => {
                                                await createFeature.mutateAsync({
                                                    sectionId: selected.id,
                                                    title: `Feature ${selectedFeatures.length + 1}`,
                                                    description: '',
                                                    sortOrder: selectedFeatures.length,
                                                });
                                                await featureList.refetch();
                                            }}
                                        >
                                            + Add
                                        </Button>
                                    </div>
                                    {selectedFeatures.map((feature) => (
                                        <div key={feature.id} className="space-y-1 rounded border p-2">
                                            <Input
                                                value={feature.title || ''}
                                                onChange={(event) => {
                                                    feature.title = event.target.value;
                                                }}
                                                onBlur={async () => {
                                                    await updateFeature.mutateAsync({
                                                        id: feature.id,
                                                        title: feature.title,
                                                    });
                                                }}
                                            />
                                            <div className="flex justify-end">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={async () => {
                                                        await deleteFeature.mutateAsync(feature.id);
                                                        await featureList.refetch();
                                                    }}
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2 pt-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium">Actions</p>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={async () => {
                                                await createAction.mutateAsync({
                                                    sectionId: selected.id,
                                                    label: `Action ${selectedActions.length + 1}`,
                                                    href: '/signup',
                                                    variant: 'primary',
                                                    external: false,
                                                    sortOrder: selectedActions.length,
                                                });
                                                await actionList.refetch();
                                            }}
                                        >
                                            + Add
                                        </Button>
                                    </div>
                                    {selectedActions.map((action) => (
                                        <div key={action.id} className="grid grid-cols-12 gap-1 rounded border p-2">
                                            <Input
                                                className="col-span-5"
                                                value={action.label || ''}
                                                onChange={(event) => {
                                                    action.label = event.target.value;
                                                }}
                                            />
                                            <Input
                                                className="col-span-5"
                                                value={action.href || ''}
                                                onChange={(event) => {
                                                    action.href = event.target.value;
                                                }}
                                                onBlur={async () => {
                                                    await updateAction.mutateAsync({
                                                        id: action.id,
                                                        label: action.label,
                                                        href: action.href,
                                                    });
                                                }}
                                            />
                                            <Button
                                                className="col-span-2"
                                                size="sm"
                                                variant="ghost"
                                                onClick={async () => {
                                                    await deleteAction.mutateAsync(action.id);
                                                    await actionList.refetch();
                                                }}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
