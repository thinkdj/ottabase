import { actionHooks, featureHooks, pageHooks, sectionHooks, useBlocksRegistry } from '@/hooks/marketingPageHooks';
import { globalStore, organizationIdAtom, userAtom } from '@/ottabase/state/appState';
import { Badge, Button, Card, CardContent, Input, Label } from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { Monitor, RefreshCw, Smartphone, Tablet, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BlockEditor } from './BlockEditor';
import { BlockPalette } from './BlockPalette';
import { BuilderCanvas } from './BuilderCanvas';
import { extractCrudDetailRecord, normalizeCrudListPayload } from './crudPayload';
import type { BlockDefinition, EditableBlock, PageDraft } from './builder-types';

export function AdminPageBuilderPage() {
    const { pageId } = useParams({ from: '/admin/pages/$pageId' });
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [pageDraft, setPageDraft] = useState<PageDraft | null>(null);
    const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    const [previewRefreshKey, setPreviewRefreshKey] = useState<number>(Date.now());

    const organizationId = globalStore.get(organizationIdAtom) || null;
    const userId = globalStore.get(userAtom)?.id || null;

    // --- Data queries ---
    const pageQuery = pageHooks.useDetail(pageId);
    const sectionList = sectionHooks.useList({ where: { pageId } as any });
    const registry = useBlocksRegistry();

    const createSection = sectionHooks.useCreate();
    const updateSection = sectionHooks.useUpdate();
    const deleteSection = sectionHooks.useDelete();

    const featureList = featureHooks.useList({ where: { sectionId: selectedId || '' } as any });
    const createFeature = featureHooks.useCreate();
    const updateFeature = featureHooks.useUpdate();
    const deleteFeature = featureHooks.useDelete();

    const actionList = actionHooks.useList({ where: { sectionId: selectedId || '' } as any });
    const createAction = actionHooks.useCreate();
    const updateAction = actionHooks.useUpdate();
    const deleteAction = actionHooks.useDelete();

    const updatePage = pageHooks.useUpdate();

    const bumpPreview = useCallback(() => {
        setPreviewRefreshKey(Date.now());
    }, []);

    // --- Derived data ---
    const sections = useMemo(() => {
        const rows = normalizeCrudListPayload<any>(sectionList.data);
        return [...rows].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    }, [sectionList.data]);

    const selected = sections.find((s) => s.id === selectedId) ?? null;

    const selectedFeatures = useMemo(() => {
        const rows = normalizeCrudListPayload<any>(featureList.data);
        return [...rows].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    }, [featureList.data]);

    const selectedActions = useMemo(() => {
        const rows = normalizeCrudListPayload<any>(actionList.data);
        return [...rows].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    }, [actionList.data]);

    const registryBlocks: BlockDefinition[] = registry.data?.blocks ?? [];

    // --- Sync page draft ---
    useEffect(() => {
        const page = extractCrudDetailRecord<any>(pageQuery.data);
        if (!page) return;
        setPageDraft({ id: page.id, title: page.title || '', slug: page.slug || '', status: page.status || 'draft' });
    }, [pageQuery.data]);

    // --- Handlers ---
    const handleAddBlock = useCallback(
        async (block: BlockDefinition) => {
            await createSection.mutateAsync({
                pageId,
                appId: 'ottabase-template-app',
                organizationId,
                userId,
                slot: block.id,
                variant: block.variants[0]?.id || 'default',
                title: block.label,
                enabled: true,
                sortOrder: sections.length,
            });
            toast.success(`${block.label} added`);
            await sectionList.refetch();
            bumpPreview();
        },
        [pageId, organizationId, userId, sections.length, createSection, sectionList, bumpPreview],
    );

    const handleReorder = useCallback(
        async (activeId: string, overId: string) => {
            const ordered = [...sections];
            const from = ordered.findIndex((r) => r.id === activeId);
            const to = ordered.findIndex((r) => r.id === overId);
            if (from < 0 || to < 0) return;
            const [moved] = ordered.splice(from, 1);
            ordered.splice(to, 0, moved);
            await Promise.all(
                ordered.map((section, index) =>
                    updateSection.mutateAsync({
                        id: section.id,
                        data: { sortOrder: index },
                    }),
                ),
            );
            toast.success('Blocks reordered');
            await sectionList.refetch();
            bumpPreview();
        },
        [sections, updateSection, sectionList, bumpPreview],
    );

    const handleSaveBlock = useCallback(
        async (draft: EditableBlock) => {
            await updateSection.mutateAsync({
                id: draft.id,
                data: {
                    title: draft.title,
                    subtitle: draft.subtitle,
                    body: draft.body,
                    mediaUrl: draft.mediaUrl,
                    mediaAlt: draft.mediaAlt,
                    variant: draft.variant,
                    enabled: draft.enabled,
                },
            });
            toast.success('Block saved');
            await sectionList.refetch();
            bumpPreview();
        },
        [updateSection, sectionList, bumpPreview],
    );

    const handleDeleteBlock = useCallback(
        async (id: string) => {
            await deleteSection.mutateAsync(id);
            setSelectedId(null);
            toast.success('Block deleted');
            await sectionList.refetch();
            bumpPreview();
        },
        [deleteSection, sectionList, bumpPreview],
    );

    const handleAddFeature = useCallback(async () => {
        if (!selected) return;
        await createFeature.mutateAsync({
            sectionId: selected.id,
            appId: 'ottabase-template-app',
            organizationId,
            userId,
            title: `Feature ${selectedFeatures.length + 1}`,
            description: '',
            sortOrder: selectedFeatures.length,
        });
        await featureList.refetch();
        bumpPreview();
    }, [selected, organizationId, userId, selectedFeatures.length, createFeature, featureList, bumpPreview]);

    const handleUpdateFeature = useCallback(
        async (id: string, data: Record<string, unknown>) => {
            await updateFeature.mutateAsync({ id, data });
            await featureList.refetch();
            bumpPreview();
        },
        [updateFeature, featureList, bumpPreview],
    );

    const handleDeleteFeature = useCallback(
        async (id: string) => {
            await deleteFeature.mutateAsync(id);
            await featureList.refetch();
            bumpPreview();
        },
        [deleteFeature, featureList, bumpPreview],
    );

    const handleAddAction = useCallback(async () => {
        if (!selected) return;
        await createAction.mutateAsync({
            sectionId: selected.id,
            appId: 'ottabase-template-app',
            organizationId,
            userId,
            label: `Action ${selectedActions.length + 1}`,
            href: '/signup',
            variant: 'primary',
            external: false,
            sortOrder: selectedActions.length,
        });
        await actionList.refetch();
        bumpPreview();
    }, [selected, organizationId, userId, selectedActions.length, createAction, actionList, bumpPreview]);

    const handleUpdateAction = useCallback(
        async (id: string, data: Record<string, unknown>) => {
            await updateAction.mutateAsync({ id, data });
            await actionList.refetch();
            bumpPreview();
        },
        [updateAction, actionList, bumpPreview],
    );

    const handleDeleteAction = useCallback(
        async (id: string) => {
            await deleteAction.mutateAsync(id);
            await actionList.refetch();
            bumpPreview();
        },
        [deleteAction, actionList, bumpPreview],
    );

    const previewWidthClass =
        previewDevice === 'mobile' ? 'w-[390px]' : previewDevice === 'tablet' ? 'w-[768px]' : 'w-full';
    const previewUrl = `/pages/${encodeURIComponent(pageDraft?.slug || '')}?preview=true&_k=${previewRefreshKey}`;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <Link to="/admin/pages" className="text-sm text-muted-foreground hover:underline">
                        ← Back to pages
                    </Link>
                    <h1 className="text-2xl font-semibold">{pageDraft?.title || 'Page Builder'}</h1>
                    <p className="text-sm text-muted-foreground">
                        Drag-and-drop builder with sortable blocks, features and actions.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={async () => {
                            if (!pageDraft) return;
                            const nextStatus = pageDraft.status === 'published' ? 'draft' : 'published';
                            await updatePage.mutateAsync({
                                id: pageDraft.id,
                                data: { status: nextStatus },
                            });
                            toast.success(nextStatus === 'published' ? 'Page published' : 'Page moved to draft');
                            await pageQuery.refetch();
                            bumpPreview();
                        }}
                    >
                        {pageDraft?.status === 'published' ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button asChild variant="outline">
                        <a
                            href={`/pages/${encodeURIComponent(pageDraft?.slug || '')}?preview=true`}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Preview
                        </a>
                    </Button>
                </div>
            </div>

            {/* Page settings bar */}
            <Card>
                <CardContent className="flex flex-wrap items-end gap-3 pt-6">
                    <div className="min-w-[240px]">
                        <Label>Page Title</Label>
                        <Input
                            value={pageDraft?.title || ''}
                            onChange={(e) => setPageDraft((p) => (p ? { ...p, title: e.target.value } : p))}
                        />
                    </div>
                    <div className="min-w-[240px]">
                        <Label>Slug</Label>
                        <Input
                            value={pageDraft?.slug || ''}
                            onChange={(e) => setPageDraft((p) => (p ? { ...p, slug: e.target.value } : p))}
                        />
                    </div>
                    <Button
                        onClick={async () => {
                            if (!pageDraft) return;
                            await updatePage.mutateAsync({
                                id: pageDraft.id,
                                data: {
                                    title: pageDraft.title,
                                    slug: pageDraft.slug,
                                },
                            });
                            toast.success('Page settings saved');
                            bumpPreview();
                        }}
                    >
                        <Save className="mr-1 h-4 w-4" /> Save Page
                    </Button>
                    <Badge variant="secondary">Status: {pageDraft?.status || 'draft'}</Badge>
                </CardContent>
            </Card>

            {/* 3-column builder layout */}
            <div className="grid gap-4 lg:grid-cols-12">
                {/* Left: Block Palette */}
                <div className="lg:col-span-3">
                    <BlockPalette
                        blocks={registryBlocks}
                        onAddBlock={handleAddBlock}
                        isPending={createSection.isPending}
                    />
                </div>

                {/* Center: Canvas */}
                <div className="lg:col-span-5">
                    <BuilderCanvas
                        sections={sections}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onReorder={handleReorder}
                    />
                </div>

                {/* Right: Block Editor */}
                <div className="lg:col-span-4">
                    {selected ? (
                        <BlockEditor
                            block={selected}
                            blocks={registryBlocks}
                            features={selectedFeatures}
                            actions={selectedActions}
                            onSave={handleSaveBlock}
                            onDelete={handleDeleteBlock}
                            onAddFeature={handleAddFeature}
                            onUpdateFeature={handleUpdateFeature}
                            onDeleteFeature={handleDeleteFeature}
                            onAddAction={handleAddAction}
                            onUpdateAction={handleUpdateAction}
                            onDeleteAction={handleDeleteAction}
                            isPending={updateSection.isPending}
                        />
                    ) : (
                        <Card className="h-fit">
                            <CardContent className="py-12 text-center">
                                <p className="text-sm text-muted-foreground">
                                    Select a block from the canvas to edit its properties.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            <Card>
                <CardContent className="space-y-3 pt-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-sm font-semibold">Live Preview</h3>
                            <p className="text-xs text-muted-foreground">
                                Renders current page at <code>/pages/{pageDraft?.slug || '...'}</code> in preview mode.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant={previewDevice === 'desktop' ? 'default' : 'outline'}
                                onClick={() => setPreviewDevice('desktop')}
                            >
                                <Monitor className="mr-1 h-4 w-4" /> Desktop
                            </Button>
                            <Button
                                size="sm"
                                variant={previewDevice === 'tablet' ? 'default' : 'outline'}
                                onClick={() => setPreviewDevice('tablet')}
                            >
                                <Tablet className="mr-1 h-4 w-4" /> Tablet
                            </Button>
                            <Button
                                size="sm"
                                variant={previewDevice === 'mobile' ? 'default' : 'outline'}
                                onClick={() => setPreviewDevice('mobile')}
                            >
                                <Smartphone className="mr-1 h-4 w-4" /> Mobile
                            </Button>
                            <Button size="sm" variant="outline" onClick={bumpPreview}>
                                <RefreshCw className="mr-1 h-4 w-4" /> Refresh
                            </Button>
                        </div>
                    </div>

                    <div className="flex justify-center overflow-auto rounded-lg border bg-muted/20 p-2">
                        <iframe
                            key={previewRefreshKey}
                            title="Marketing page live preview"
                            src={previewUrl}
                            className={`${previewWidthClass} h-[720px] rounded border bg-background`}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
