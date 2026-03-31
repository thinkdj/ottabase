import { actionHooks, pageHooks, sectionHooks, useBlocksRegistry } from '@/hooks/marketingPageHooks';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea } from '@ottabase/ui-shadcn';
import { Link, useParams } from '@tanstack/react-router';
import { GripVertical, Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

export function AdminPageBuilderPage() {
    const { pageId } = useParams({ from: '/admin/pages/$pageId' });
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const pageQuery = pageHooks.useDetail(pageId);
    const sectionList = sectionHooks.useList({ filters: { pageId } as any });
    const registry = useBlocksRegistry();

    const createSection = sectionHooks.useCreate();
    const updateSection = sectionHooks.useUpdate();
    const deleteSection = sectionHooks.useDelete();
    const createAction = actionHooks.useCreate();

    const sections = useMemo(() => {
        const rows = (sectionList.data?.data ?? []) as any[];
        return [...rows].sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    }, [sectionList.data?.data]);

    const selected = sections.find((section) => section.id === selectedId) ?? null;

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
                    <h1 className="text-2xl font-semibold">{(pageQuery.data as any)?.data?.title || 'Page Builder'}</h1>
                    <p className="text-sm text-muted-foreground">
                        Drag and drop blocks, then edit content in the right panel.
                    </p>
                </div>
                <Button asChild variant="outline">
                    <a href={`/pages/${(pageQuery.data as any)?.data?.slug}`} target="_blank" rel="noreferrer">
                        Preview /pages route
                    </a>
                </Button>
            </div>

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
                                + {block.label}
                            </Button>
                        ))}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-6">
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
                                        <p className="text-xs text-muted-foreground">{section.variant}</p>
                                    </div>
                                    <button aria-label="Drag to reorder" aria-roledescription="sortable">
                                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Block Editor</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {!selected ? (
                            <p className="text-sm text-muted-foreground">Select a block from the canvas to edit.</p>
                        ) : (
                            <>
                                <div>
                                    <Label>Title</Label>
                                    <Input
                                        value={selected.title || ''}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            setSelectedId(selected.id);
                                            selected.title = value;
                                        }}
                                    />
                                </div>
                                <div>
                                    <Label>Subtitle</Label>
                                    <Input
                                        value={selected.subtitle || ''}
                                        onChange={(event) => (selected.subtitle = event.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Body</Label>
                                    <Textarea
                                        value={selected.body || ''}
                                        onChange={(event) => (selected.body = event.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Variant</Label>
                                    <Input
                                        value={selected.variant || ''}
                                        onChange={(event) => (selected.variant = event.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={async () => {
                                            await updateSection.mutateAsync({
                                                id: selected.id,
                                                title: selected.title,
                                                subtitle: selected.subtitle,
                                                body: selected.body,
                                                variant: selected.variant,
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
                                        Delete
                                    </Button>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={async () => {
                                        await createAction.mutateAsync({
                                            sectionId: selected.id,
                                            label: 'Get Started',
                                            href: '/signup',
                                            variant: 'primary',
                                            external: false,
                                            sortOrder: 0,
                                        });
                                        toast.success('Default action added');
                                    }}
                                >
                                    + Add action
                                </Button>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
