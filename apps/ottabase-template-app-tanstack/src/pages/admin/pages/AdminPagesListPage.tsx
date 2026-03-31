/**
 * Marketing Pages List
 *
 * Lists all marketing pages with ability to create, edit, and delete.
 * Follows Notion/GitHub-style minimal design.
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { pageHooks, type PageRow } from '@/hooks/pageHooks';
import {
    Badge,
    Button,
    Card,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Input,
} from '@ottabase/ui-shadcn';
import { Link, useNavigate } from '@tanstack/react-router';
import {
    Copy,
    Edit,
    ExternalLink,
    LayoutDashboard,
    LayoutGrid,
    MoreVertical,
    Plus,
    Search,
    Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';

// ── Page Row Component ──────────────────────────────────────────────────────

function PageListItem({
    page,
    onDelete,
    onDuplicate,
}: {
    page: PageRow;
    onDelete: (page: PageRow) => void;
    onDuplicate: (page: PageRow) => void;
}) {
    const navigate = useNavigate();

    const statusColors = {
        draft: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
        published: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
        archived: 'bg-zinc-500/10 text-zinc-600 border-zinc-200 dark:border-zinc-800',
    };

    const typeIcon = page.type === 'block' ? LayoutGrid : LayoutDashboard;
    const TypeIcon = typeIcon;

    return (
        <div className="group flex items-center gap-4 px-4 py-3 hover:bg-muted/50 rounded-lg transition-colors">
            {/* Icon */}
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <TypeIcon className="h-5 w-5 text-muted-foreground" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{page.title}</span>
                    {page.slug === 'homepage' && (
                        <Badge variant="secondary" className="text-xs">
                            Homepage
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>/{page.slug}</span>
                    {page.showInNav && (
                        <>
                            <span>•</span>
                            <span>In nav</span>
                        </>
                    )}
                </div>
            </div>

            {/* Status badge */}
            <Badge variant="outline" className={statusColors[page.status]}>
                {page.status}
            </Badge>

            {/* Type badge */}
            <Badge variant="outline" className="capitalize">
                {page.type}
            </Badge>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => navigate({ to: '/admin/pages/$pageId', params: { pageId: page.id } })}
                >
                    <Edit className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                            <Link to="/admin/pages/$pageId" params={{ pageId: page.id }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicate(page)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <a
                                href={`${import.meta.env.VITE_HOMEPAGE_URL || 'http://localhost:3000'}/${page.slug === 'homepage' ? '' : page.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View Live
                            </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onDelete(page)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}

// ── Main List Page ──────────────────────────────────────────────────────────

export function AdminPagesListPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');

    // Fetch pages
    const {
        data: pagesData,
        isLoading,
        refetch,
    } = pageHooks.useList({ orderBy: 'createdAt', orderDirection: 'desc' }, ADMIN_LIST_QUERY_CONFIG);

    const createPage = pageHooks.useCreate();
    const deletePage = pageHooks.useDelete();

    const pages = useMemo(() => {
        const list = (Array.isArray(pagesData) ? pagesData : []) as PageRow[];
        if (!search.trim()) return list;
        const q = search.toLowerCase();
        return list.filter((p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q));
    }, [pagesData, search]);

    const handleCreatePage = async () => {
        const slug = `page-${Date.now()}`;
        const newPage = await createPage.mutateAsync({
            slug,
            title: 'New Page',
            type: 'block',
            status: 'draft',
        });
        refetch();
        // Navigate to editor after creation
        if (newPage && typeof newPage === 'object' && 'id' in newPage) {
            navigate({ to: '/admin/pages/$pageId', params: { pageId: (newPage as PageRow).id } });
        }
    };

    const handleDuplicate = async (page: PageRow) => {
        const newSlug = `${page.slug}-copy-${Date.now()}`;
        await createPage.mutateAsync({
            slug: newSlug,
            title: `${page.title} (Copy)`,
            type: page.type,
            status: 'draft',
            themePreset: page.themePreset,
            variantBySlotJson: page.variantBySlotJson,
        });
        refetch();
    };

    const handleDelete = async (page: PageRow) => {
        if (page.slug === 'homepage') {
            alert('Cannot delete the homepage. Edit it instead.');
            return;
        }
        if (!confirm(`Delete "${page.title}"? This action cannot be undone.`)) return;
        await deletePage.mutateAsync(page.id);
        refetch();
    };

    const handleSeed = async () => {
        const res = await fetch('/api/pages/seed', { method: 'POST' });
        if (res.ok) refetch();
    };

    if (isLoading) {
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
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <LayoutDashboard className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold">Marketing Pages</h1>
                            <p className="text-sm text-muted-foreground">
                                {pages.length} page{pages.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {pages.length === 0 && (
                            <Button variant="outline" onClick={handleSeed}>
                                Seed Demo
                            </Button>
                        )}
                        <Button onClick={handleCreatePage}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Page
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 max-w-4xl mx-auto space-y-4">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search pages..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {/* Pages list */}
                {pages.length === 0 ? (
                    <Card className="p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                            <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium mb-2">No marketing pages yet</h3>
                        <p className="text-muted-foreground mb-6">
                            Create your first marketing page or seed the homepage to get started.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <Button variant="outline" onClick={handleSeed}>
                                Seed Homepage
                            </Button>
                            <Button onClick={handleCreatePage}>
                                <Plus className="mr-2 h-4 w-4" />
                                Create Page
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <Card className="divide-y">
                        {pages.map((page) => (
                            <PageListItem
                                key={page.id}
                                page={page}
                                onDelete={handleDelete}
                                onDuplicate={handleDuplicate}
                            />
                        ))}
                    </Card>
                )}
            </div>
        </div>
    );
}
