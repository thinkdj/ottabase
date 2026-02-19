'use client';

import { useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
    Input, Label, Switch, Textarea,
} from '@ottabase/ui-shadcn';
import { ArrowLeft, Eye, EyeOff, GripVertical, Layers, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { SECTION_TYPES } from '@ottabase/ottalanding';
import {
    landingPageHooks, landingSectionHooks,
    type LandingPageItem, type LandingSectionItem,
} from '@/hooks/landingHooks';

// ─── Section type display names ─────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
    hero: 'Hero',
    features: 'Features',
    pricing: 'Pricing',
    testimonials: 'Testimonials',
    faq: 'FAQ',
    'logo-cloud': 'Logo Cloud',
    cta: 'Call to Action',
    stats: 'Stats',
    steps: 'Steps',
    'feature-highlight': 'Feature Highlight',
    about: 'About',
    contact: 'Contact',
    timeline: 'Timeline',
};

// ─── Page Settings Card ─────────────────────────────────────────────────────

function PageSettingsCard({ page, onSave }: { page: LandingPageItem; onSave: () => void }) {
    const updateMutation = landingPageHooks.useUpdate();

    const [title, setTitle] = useState(page.title);
    const [slug, setSlug] = useState(page.slug);
    const [metaDescription, setMetaDescription] = useState(page.metaDescription ?? '');
    const [ogImage, setOgImage] = useState(page.ogImage ?? '');
    const [isPublished, setIsPublished] = useState(page.isPublished);

    const handleSave = async () => {
        try {
            await updateMutation.mutateAsync({
                id: page.id,
                data: {
                    title,
                    slug,
                    metaDescription: metaDescription || undefined,
                    ogImage: ogImage || undefined,
                    isPublished,
                },
            });
            onSave();
        } catch {
            // handled
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Page Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Home" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="slug">Slug</Label>
                        <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="home" />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="metaDescription">Meta Description</Label>
                    <Textarea id="metaDescription" rows={2} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="ogImage">OG Image URL</Label>
                    <Input id="ogImage" value={ogImage} onChange={(e) => setOgImage(e.target.value)} placeholder="https://..." />
                </div>
                <div className="flex items-center gap-3">
                    <Switch checked={isPublished} onCheckedChange={setIsPublished} id="published" />
                    <Label htmlFor="published">Published</Label>
                </div>
                <div className="flex justify-end">
                    <Button onClick={handleSave} disabled={updateMutation.isPending} size="sm">
                        <Save className="mr-2 h-3.5 w-3.5" />
                        Save
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Sections List ──────────────────────────────────────────────────────────

function SectionsCard({ pageId }: { pageId: string }) {
    const navigate = useNavigate();
    const { data, isLoading, refetch } = landingSectionHooks.useList({
        perPage: 100,
        where: { pageId },
    });
    const createMutation = landingSectionHooks.useCreate();
    const deleteMutation = landingSectionHooks.useDelete();
    const updateMutation = landingSectionHooks.useUpdate();

    const [addingType, setAddingType] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<LandingSectionItem | null>(null);

    const sections = ((data?.data ?? []) as LandingSectionItem[]).sort((a, b) => a.order - b.order);

    const handleAdd = async (sectionType: string) => {
        try {
            const result = await createMutation.mutateAsync({
                pageId,
                sectionType,
                content: {},
                order: sections.length,
                visible: true,
            } as any);
            setAddingType(null);
            refetch();
            if (result?.id) {
                navigate({ to: '/admin/landing/sections/$sectionId', params: { sectionId: result.id } });
            }
        } catch {
            // handled
        }
    };

    const handleToggleVisible = async (section: LandingSectionItem) => {
        try {
            await updateMutation.mutateAsync({
                id: section.id,
                data: { visible: !section.visible },
            });
            refetch();
        } catch {
            // handled
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteMutation.mutateAsync(deleteTarget.id);
            setDeleteTarget(null);
            refetch();
        } catch {
            // handled
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Sections</CardTitle>
                        <CardDescription>Content sections displayed on this page, in order.</CardDescription>
                    </div>
                    {addingType === null ? (
                        <Button size="sm" onClick={() => setAddingType('')}>
                            <Plus className="mr-2 h-3.5 w-3.5" />
                            Add Section
                        </Button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <select
                                value={addingType}
                                onChange={(e) => setAddingType(e.target.value)}
                                className="h-8 rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="">Select type...</option>
                                {SECTION_TYPES.map((t) => (
                                    <option key={t} value={t}>
                                        {SECTION_LABELS[t] ?? t}
                                    </option>
                                ))}
                            </select>
                            <Button
                                size="sm"
                                variant="default"
                                disabled={!addingType || createMutation.isPending}
                                onClick={() => addingType && handleAdd(addingType)}
                            >
                                Add
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setAddingType(null)}>
                                Cancel
                            </Button>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
                ) : sections.length === 0 ? (
                    <div className="text-center py-12 rounded-lg border border-dashed">
                        <Layers className="mx-auto h-10 w-10 text-muted-foreground/50" />
                        <h3 className="mt-3 text-sm font-semibold">No sections</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Add sections like Hero, Features, Pricing, etc.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {sections.map((section, i) => (
                            <div
                                key={section.id}
                                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                            >
                                <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                                <span className="text-xs text-muted-foreground tabular-nums w-6">{i + 1}</span>
                                <Link
                                    to="/admin/landing/sections/$sectionId"
                                    params={{ sectionId: section.id }}
                                    className="flex-1 min-w-0"
                                >
                                    <p className="text-sm font-medium text-foreground">
                                        {SECTION_LABELS[section.sectionType] ?? section.sectionType}
                                    </p>
                                </Link>
                                <div className="flex items-center gap-1 shrink-0">
                                    <Badge variant="outline" className="text-[10px]">{section.sectionType}</Badge>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => handleToggleVisible(section)}
                                        title={section.visible ? 'Hide section' : 'Show section'}
                                    >
                                        {section.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                                    </Button>
                                    <Link to="/admin/landing/sections/$sectionId" params={{ sectionId: section.id }}>
                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={() => setDeleteTarget(section)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete section?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the "{SECTION_LABELS[deleteTarget?.sectionType ?? ''] ?? deleteTarget?.sectionType}" section.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function AdminLandingPageEditorPage() {
    const { pageId } = useParams({ from: '/admin/landing/pages/$pageId' as any });
    const { data: pageData, isLoading, refetch } = landingPageHooks.useDetail(pageId);

    const page = pageData as LandingPageItem | undefined;

    if (isLoading) {
        return <p className="text-sm text-muted-foreground py-12 text-center">Loading page...</p>;
    }

    if (!page) {
        return <p className="text-sm text-destructive py-12 text-center">Page not found.</p>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link to="/admin/landing/sites/$siteId" params={{ siteId: page.siteId }}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{page.title}</h1>
                    <p className="text-sm text-muted-foreground">/{page.slug}</p>
                </div>
                <Badge variant={page.isPublished ? 'default' : 'secondary'} className="ml-auto">
                    {page.isPublished ? 'Published' : 'Draft'}
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Sections (2/3) */}
                <div className="lg:col-span-2">
                    <SectionsCard pageId={page.id} />
                </div>

                {/* Page settings sidebar (1/3) */}
                <div>
                    <PageSettingsCard page={page} onSave={() => refetch()} />
                </div>
            </div>
        </div>
    );
}
