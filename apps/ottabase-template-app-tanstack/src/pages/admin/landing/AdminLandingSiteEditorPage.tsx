'use client';

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
    Input, Label, Tabs, TabsContent, TabsList, TabsTrigger, Textarea,
} from '@ottabase/ui-shadcn';
import { ArrowLeft, Eye, EyeOff, FileText, GripVertical, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import {
    landingSiteHooks, landingPageHooks, type LandingSiteItem, type LandingPageItem,
} from '@/hooks/landingHooks';

// ─── Site Settings Tab ──────────────────────────────────────────────────────

function SiteSettingsTab({ site, onSave }: { site: LandingSiteItem; onSave: () => void }) {
    const updateMutation = landingSiteHooks.useUpdate();

    const [name, setName] = useState(site.name);
    const [tagline, setTagline] = useState(site.tagline ?? '');
    const [logoUrl, setLogoUrl] = useState(site.logoUrl ?? '');
    const [themeId, setThemeId] = useState(site.themeId);
    const [navLinksJson, setNavLinksJson] = useState(JSON.stringify(site.navLinks ?? [], null, 2));
    const [navCtaJson, setNavCtaJson] = useState(JSON.stringify(site.navCta ?? null, null, 2));
    const [footerJson, setFooterJson] = useState(JSON.stringify(site.footerSections ?? [], null, 2));
    const [legalJson, setLegalJson] = useState(JSON.stringify(site.legal ?? null, null, 2));

    const handleSave = async () => {
        try {
            await updateMutation.mutateAsync({
                id: site.id,
                data: {
                    name,
                    tagline: tagline || undefined,
                    logoUrl: logoUrl || undefined,
                    themeId,
                    navLinks: JSON.parse(navLinksJson),
                    navCta: JSON.parse(navCtaJson),
                    footerSections: JSON.parse(footerJson),
                    legal: JSON.parse(legalJson),
                },
            });
            onSave();
        } catch {
            // handled by mutation
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>General</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="name">Site Name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Website" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="themeId">Template Theme</Label>
                            <select
                                id="themeId"
                                value={themeId}
                                onChange={(e) => setThemeId(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="atlas">Atlas</option>
                                <option value="mono">Mono</option>
                                <option value="saas">SaaS</option>
                            </select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="tagline">Tagline</Label>
                        <Input id="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="A short description" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="logoUrl">Logo URL</Label>
                        <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Navigation</CardTitle>
                    <CardDescription>JSON arrays for nav links, CTA button, footer sections, and legal info.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Nav Links (JSON)</Label>
                        <Textarea rows={4} value={navLinksJson} onChange={(e) => setNavLinksJson(e.target.value)} className="font-mono text-xs" />
                    </div>
                    <div className="space-y-2">
                        <Label>Nav CTA (JSON)</Label>
                        <Textarea rows={2} value={navCtaJson} onChange={(e) => setNavCtaJson(e.target.value)} className="font-mono text-xs" />
                    </div>
                    <div className="space-y-2">
                        <Label>Footer Sections (JSON)</Label>
                        <Textarea rows={6} value={footerJson} onChange={(e) => setFooterJson(e.target.value)} className="font-mono text-xs" />
                    </div>
                    <div className="space-y-2">
                        <Label>Legal (JSON)</Label>
                        <Textarea rows={3} value={legalJson} onChange={(e) => setLegalJson(e.target.value)} className="font-mono text-xs" />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={updateMutation.isPending}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Settings
                </Button>
            </div>
        </div>
    );
}

// ─── Pages Tab ──────────────────────────────────────────────────────────────

function PagesTab({ siteId }: { siteId: string }) {
    const navigate = useNavigate();
    const { data, isLoading, refetch } = landingPageHooks.useList({
        perPage: 50,
        where: { siteId },
    });
    const createMutation = landingPageHooks.useCreate();
    const deleteMutation = landingPageHooks.useDelete();

    const [deleteTarget, setDeleteTarget] = useState<LandingPageItem | null>(null);

    const pages = (data?.data ?? []) as LandingPageItem[];

    const handleCreate = async () => {
        try {
            const slug = `page-${Date.now()}`;
            const result = await createMutation.mutateAsync({
                siteId,
                slug,
                title: 'New Page',
                order: pages.length,
                isPublished: true,
            } as any);
            refetch();
            if (result?.id) {
                navigate({ to: '/admin/landing/pages/$pageId', params: { pageId: result.id } });
            }
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
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Pages in this site, ordered by position.</p>
                <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Add Page
                </Button>
            </div>

            {isLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
            ) : pages.length === 0 ? (
                <div className="text-center py-12 rounded-lg border border-dashed">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
                    <h3 className="mt-3 text-sm font-semibold">No pages</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Add a page to start building your landing site.</p>
                    <Button size="sm" className="mt-3" onClick={handleCreate}>
                        <Plus className="mr-2 h-3.5 w-3.5" />
                        Add Page
                    </Button>
                </div>
            ) : (
                <div className="space-y-2">
                    {pages
                        .sort((a, b) => a.order - b.order)
                        .map((page) => (
                            <div
                                key={page.id}
                                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                            >
                                <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                                <Link
                                    to="/admin/landing/pages/$pageId"
                                    params={{ pageId: page.id }}
                                    className="flex-1 min-w-0"
                                >
                                    <p className="text-sm font-medium text-foreground truncate">{page.title}</p>
                                    <p className="text-xs text-muted-foreground">/{page.slug}</p>
                                </Link>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant={page.isPublished ? 'default' : 'secondary'}>
                                        {page.isPublished ? 'Published' : 'Draft'}
                                    </Badge>
                                    <Link to="/admin/landing/pages/$pageId" params={{ pageId: page.id }}>
                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </Link>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={() => setDeleteTarget(page)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                </div>
            )}

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete page?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete "{deleteTarget?.title}" and all its sections.
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
        </div>
    );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export function AdminLandingSiteEditorPage() {
    const { siteId } = useParams({ from: '/admin/landing/sites/$siteId' as any });
    const { data: siteData, isLoading, refetch } = landingSiteHooks.useDetail(siteId);

    const site = siteData as LandingSiteItem | undefined;

    if (isLoading) {
        return (
            <div className="space-y-6">
                <p className="text-sm text-muted-foreground py-12 text-center">Loading site...</p>
            </div>
        );
    }

    if (!site) {
        return (
            <div className="space-y-6">
                <p className="text-sm text-destructive py-12 text-center">Site not found.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link to="/admin/landing">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{site.name}</h1>
                    <p className="text-sm text-muted-foreground">Site settings, pages, and content management.</p>
                </div>
                <Badge variant="secondary" className="ml-auto">{site.themeId}</Badge>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="pages">
                <TabsList>
                    <TabsTrigger value="pages">Pages</TabsTrigger>
                    <TabsTrigger value="settings">Site Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="pages" className="mt-6">
                    <PagesTab siteId={site.id} />
                </TabsContent>

                <TabsContent value="settings" className="mt-6">
                    <SiteSettingsTab site={site} onSave={() => refetch()} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
