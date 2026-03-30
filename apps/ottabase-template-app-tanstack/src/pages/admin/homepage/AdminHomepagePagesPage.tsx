/**
 * Admin Homepage Pages Management
 *
 * Lists CMS pages (contentType = 'page') and manages their expose-to-homepage flag.
 * Provides direct links to the blog editor for full page editing.
 */
import { ADMIN_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { createModelHooks } from '@ottabase/ottaorm/client';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Switch,
} from '@ottabase/ui-shadcn';
import { Link } from '@tanstack/react-router';
import { Edit, ExternalLink, Eye, EyeOff, FileText, Globe, Plus } from 'lucide-react';
import { HomepageAdminNav } from './HomepageAdminNav';

interface BlogPostRow {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    contentType: string;
    status: string;
    exposeToHomepage: boolean;
    publishedAt: string | null;
    updatedAt: string;
}

const postHooks = createModelHooks<BlogPostRow>({ entityName: 'posts' });

export function AdminHomepagePagesPage() {
    const { data, isLoading } = postHooks.useList(
        { where: { contentType: 'page' }, orderBy: 'updatedAt', orderDirection: 'desc' },
        ADMIN_LIST_QUERY_CONFIG,
    );
    const updatePost = postHooks.useUpdate();

    const pages = (Array.isArray(data) ? data : []) as BlogPostRow[];
    const publishedPages = pages.filter((p) => p.status === 'published');
    const exposedCount = pages.filter((p) => p.exposeToHomepage).length;

    const handleToggleExpose = async (page: BlogPostRow) => {
        await updatePost.mutateAsync({
            id: page.id,
            data: { exposeToHomepage: !page.exposeToHomepage },
        });
    };

    return (
        <div className="space-y-6">
            <HomepageAdminNav />

            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">CMS Pages</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage CMS-powered pages and control which appear in the homepage navbar.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                        {exposedCount} exposed to navbar
                    </Badge>
                    <Button asChild>
                        <Link to="/admin/blog/new">
                            <Plus className="mr-1.5 h-4 w-4" />
                            New Page
                        </Link>
                    </Button>
                </div>
            </div>

            {/* Loading */}
            {isLoading && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-muted-foreground">Loading pages…</p>
                    </CardContent>
                </Card>
            )}

            {/* Empty state */}
            {!isLoading && pages.length === 0 && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <h3 className="mt-4 text-lg font-semibold">No pages yet</h3>
                        <p className="mt-2 text-muted-foreground">
                            Create a page in the Blog Editor with content type &quot;Page&quot; to manage it here.
                        </p>
                        <Button variant="outline" className="mt-4" asChild>
                            <Link to="/admin/blog/new">
                                <Plus className="mr-1.5 h-4 w-4" />
                                Create Page
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Pages list */}
            {pages.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">All Pages</CardTitle>
                        <CardDescription>
                            Toggle &quot;Expose to Homepage&quot; to add pages to the navbar. Pages must be published to appear.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="divide-y">
                            {pages.map((page) => (
                                <div key={page.id} className="flex items-center gap-4 py-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-sm truncate">{page.title || '(untitled)'}</p>
                                            <Badge
                                                variant={page.status === 'published' ? 'default' : 'secondary'}
                                                className="text-[10px] shrink-0"
                                            >
                                                {page.status}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            /page/{page.slug}
                                            {page.excerpt && ` — ${page.excerpt}`}
                                        </p>
                                    </div>

                                    {/* Expose toggle */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Switch
                                            id={`expose-${page.id}`}
                                            checked={page.exposeToHomepage}
                                            onCheckedChange={() => handleToggleExpose(page)}
                                            disabled={updatePost.isPending}
                                        />
                                        <label
                                            htmlFor={`expose-${page.id}`}
                                            className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
                                        >
                                            {page.exposeToHomepage ? (
                                                <>
                                                    <Globe className="h-3 w-3 text-primary" />
                                                    In navbar
                                                </>
                                            ) : (
                                                <>
                                                    <EyeOff className="h-3 w-3" />
                                                    Hidden
                                                </>
                                            )}
                                        </label>
                                    </div>

                                    {/* Edit link */}
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                                        <Link to="/admin/blog/$postId" params={{ postId: page.id }}>
                                            <Edit className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Info card */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                        <Globe className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">How pages work</p>
                            <p className="mt-1">
                                Pages are CMS content with type &quot;Page&quot; created in the Blog Editor.
                                When exposed to the homepage, they appear as links in the navigation bar.
                                Each page renders at <code className="text-xs bg-muted px-1 py-0.5 rounded">/page/slug</code> on
                                the Next.js homepage.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
