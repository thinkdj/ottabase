import { actionHooks, featureHooks, pageHooks, sectionHooks } from '@/hooks/marketingPageHooks';
import { globalStore, organizationIdAtom, userAtom } from '@/ottabase/state/appState';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@ottabase/ui-shadcn';
import { Link, useNavigate } from '@tanstack/react-router';
import { Copy, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

export function AdminPagesListPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const organizationId = globalStore.get(organizationIdAtom) || null;
    const userId = globalStore.get(userAtom)?.id || null;

    const listQuery = pageHooks.useList();
    const createPage = pageHooks.useCreate();
    const deletePage = pageHooks.useDelete();
    const sectionList = sectionHooks.useList();
    const createSection = sectionHooks.useCreate();
    const featureList = featureHooks.useList();
    const createFeature = featureHooks.useCreate();
    const actionList = actionHooks.useList();
    const createAction = actionHooks.useCreate();

    const pages = useMemo(() => {
        const rows = (listQuery.data ?? []) as any[];
        return rows.filter((page) => {
            const term = search.toLowerCase();
            return page.title?.toLowerCase().includes(term) || page.slug?.toLowerCase().includes(term);
        });
    }, [listQuery.data, search]);

    const onCreate = async () => {
        const title = `New Page ${pages.length + 1}`;
        const slug = `new-page-${Date.now()}`;
        const created = await createPage.mutateAsync({
            appId: 'ottabase-template-app',
            title,
            slug,
            status: 'draft',
            organizationId,
            userId,
        });
        toast.success('Page created');
        const pageId = (created as any)?.data?.id;
        if (pageId) {
            navigate({ to: '/admin/pages/$pageId', params: { pageId } });
        }
    };

    const onDuplicate = async (page: any) => {
        const created = await createPage.mutateAsync({
            ...page,
            id: undefined,
            slug: `${page.slug}-${Math.floor(Math.random() * 1000)}`,
            title: `${page.title} Copy`,
            status: 'draft',
            organizationId,
            userId,
        });

        const newPageId = (created as any)?.data?.id;
        const originalSections = ((sectionList.data ?? []) as any[])
            .filter((section) => section.pageId === page.id)
            .sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
        const allFeatures = (featureList.data ?? []) as any[];
        const allActions = (actionList.data ?? []) as any[];

        for (const section of originalSections) {
            const createdSection = await createSection.mutateAsync({
                pageId: newPageId,
                appId: page.appId || 'ottabase-template-app',
                organizationId: page.organizationId || null,
                userId: page.userId || null,
                slot: section.slot,
                variant: section.variant,
                title: section.title,
                subtitle: section.subtitle,
                body: section.body,
                enabled: section.enabled,
                sortOrder: section.sortOrder,
            });
            const newSectionId = (createdSection as any)?.data?.id;

            for (const feature of allFeatures.filter((item) => item.sectionId === section.id)) {
                await createFeature.mutateAsync({
                    sectionId: newSectionId,
                    appId: page.appId || 'ottabase-template-app',
                    organizationId: page.organizationId || null,
                    userId: page.userId || null,
                    title: feature.title,
                    description: feature.description,
                    icon: feature.icon,
                    link: feature.link,
                    sortOrder: feature.sortOrder,
                });
            }

            for (const action of allActions.filter((item) => item.sectionId === section.id)) {
                await createAction.mutateAsync({
                    sectionId: newSectionId,
                    appId: page.appId || 'ottabase-template-app',
                    organizationId: page.organizationId || null,
                    userId: page.userId || null,
                    label: action.label,
                    href: action.href,
                    variant: action.variant,
                    icon: action.icon,
                    external: action.external,
                    sortOrder: action.sortOrder,
                });
            }
        }

        toast.success('Page duplicated with blocks');
        await listQuery.refetch();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Marketing Pages</h1>
                    <p className="text-sm text-muted-foreground">Create landing pages with reusable blocks.</p>
                </div>
                <Button onClick={onCreate} disabled={createPage.isPending}>
                    <Plus className="mr-2 h-4 w-4" /> New Page
                </Button>
            </div>

            <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                    className="pl-9"
                    placeholder="Search pages..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {pages.map((page) => (
                    <Card key={page.id}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">{page.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">/{page.slug}</p>
                            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{page.status}</p>
                            <div className="mt-4 flex gap-2">
                                <Button asChild size="sm" variant="outline">
                                    <Link to="/admin/pages/$pageId" params={{ pageId: page.id }}>
                                        <FileText className="mr-1 h-4 w-4" /> Builder
                                    </Link>
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => onDuplicate(page)}>
                                    <Copy className="mr-1 h-4 w-4" /> Duplicate
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={async () => {
                                        await deletePage.mutateAsync(page.id);
                                        toast.success('Page deleted');
                                        await listQuery.refetch();
                                    }}
                                >
                                    <Trash2 className="mr-1 h-4 w-4" /> Delete
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
