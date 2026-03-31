import { pageHooks } from '@/hooks/marketingPageHooks';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@ottabase/ui-shadcn';
import { Link, useNavigate } from '@tanstack/react-router';
import { Copy, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

export function AdminPagesListPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');

    const listQuery = pageHooks.useList();
    const createPage = pageHooks.useCreate();
    const deletePage = pageHooks.useDelete();

    const pages = useMemo(() => {
        const rows = (listQuery.data?.data ?? []) as any[];
        return rows.filter((page) => {
            const term = search.toLowerCase();
            return page.title?.toLowerCase().includes(term) || page.slug?.toLowerCase().includes(term);
        });
    }, [listQuery.data?.data, search]);

    const onCreate = async () => {
        const title = `New Page ${pages.length + 1}`;
        const slug = `new-page-${Date.now()}`;
        const created = await createPage.mutateAsync({
            appId: 'ottabase-template-app',
            title,
            slug,
            status: 'draft',
        });
        toast.success('Page created');
        const pageId = (created as any)?.data?.id;
        if (pageId) {
            navigate({ to: '/admin/pages/$pageId', params: { pageId } });
        }
    };

    const onDuplicate = async (page: any) => {
        await createPage.mutateAsync({
            ...page,
            id: undefined,
            slug: `${page.slug}-${Math.floor(Math.random() * 1000)}`,
            title: `${page.title} Copy`,
            status: 'draft',
        });
        toast.success('Page duplicated');
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
