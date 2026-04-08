/**
 * Public changelog listing — minimal timeline layout using theme tokens.
 *
 * Uses the unified ottablog Post model with contentType='changelog'.
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { useSession } from '@/lib/auth';
import type { OutputData } from '@ottabase/ottaeditor';
import type { HeroImage } from '@ottabase/ottablog';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Button } from '@ottabase/ui-shadcn';
import { IconArrowRight, IconPlus, IconStarFilled } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';

interface ChangelogPostPublic {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: OutputData | null;
    heroImage: HeroImage | null;
    status: string;
    isFeatured: boolean;
    authorId: string | null;
    authorName: string | null;
    authorAvatar: string | null;
    readingTimeMinutes: number | null;
    publishedAt: string | null;
}

interface ChangelogListResponse {
    data: ChangelogPostPublic[];
    pagination: { page: number; perPage: number; total: number; totalPages: number };
}

const PER_PAGE = 12;

function formatChangelogDate(iso: string | null): string {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
    } catch {
        return '';
    }
}

export function ChangelogListPage() {
    const { isAuthenticated } = useSession({ skipAutoSync: true });

    // Use the blog API with contentType filter for changelogs
    const { data: listResponse, isLoading } = useApiQuery<ChangelogListResponse>({
        entity: 'posts',
        queryKey: ['changelog-list', { perPage: PER_PAGE }],
        endpoint: `/api/blog/posts?contentType=changelog&perPage=${PER_PAGE}`,
        queryOptions: BLOG_LIST_QUERY_CONFIG,
    });

    const entries = listResponse?.data ?? [];

    return (
        <div className="min-h-screen bg-background dark:bg-background">
            <SEOHead
                title="What's New"
                description="Product updates and improvements."
                ogType="website"
                twitterCard="summary_large_image"
            />

            <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
                <header className="mb-12 border-b border-border pb-8 dark:border-border">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-foreground sm:text-4xl">
                                What&apos;s New
                            </h1>
                            <p className="mt-2 text-muted-foreground dark:text-muted-foreground">
                                Updates, fixes, and improvements to the product.
                            </p>
                        </div>
                        {isAuthenticated && (
                            <Button asChild>
                                <Link to="/admin/blog/new" search={{ contentType: 'changelog' }}>
                                    <IconPlus className="mr-2 h-4 w-4" />
                                    New Entry
                                </Link>
                            </Button>
                        )}
                    </div>
                </header>

                {isLoading && (
                    <div className="flex justify-center py-24">
                        <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent dark:border-primary" />
                    </div>
                )}

                {!isLoading && entries.length === 0 && (
                    <p className="text-center text-muted-foreground dark:text-muted-foreground">
                        No published entries yet.
                    </p>
                )}

                <ol className="relative space-y-14 border-l border-border pl-8 dark:border-border">
                    {entries.map((entry) => {
                        const isHighlighted = entry.isFeatured === true;
                        return (
                            <li key={entry.id} className="relative">
                                {/* Timeline dot — golden star for highlighted, green dot otherwise */}
                                {isHighlighted ? (
                                    <span
                                        className="absolute -left-[11px] top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-yellow-400 bg-yellow-50 ring-4 ring-background dark:border-yellow-500 dark:bg-yellow-900/40 dark:ring-background"
                                        aria-hidden
                                    >
                                        <IconStarFilled className="size-2.5 text-yellow-500 dark:text-yellow-400" />
                                    </span>
                                ) : (
                                    <span
                                        className="absolute -left-[9px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background dark:bg-primary dark:ring-background"
                                        aria-hidden
                                    />
                                )}

                                {/* Date + Read more — vertically centered with the dot */}
                                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">
                                        /
                                    </span>
                                    <time
                                        className="font-mono text-xs uppercase tracking-wide text-muted-foreground dark:text-muted-foreground"
                                        dateTime={entry.publishedAt ?? undefined}
                                    >
                                        {formatChangelogDate(entry.publishedAt)}
                                    </time>
                                    <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">
                                        /
                                    </span>
                                    <Link
                                        to="/changelog/$slug"
                                        params={{ slug: entry.slug }}
                                        className="font-mono text-xs uppercase tracking-wide text-primary hover:underline dark:text-primary"
                                    >
                                        Read more
                                        <IconArrowRight
                                            className="ml-0.5 inline size-3 align-text-bottom"
                                            aria-hidden
                                        />
                                    </Link>
                                </div>

                                {/* Title */}
                                <Link
                                    to="/changelog/$slug"
                                    params={{ slug: entry.slug }}
                                    className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <h2 className="text-xl font-semibold text-foreground transition-colors group-hover:text-primary dark:text-foreground dark:group-hover:text-primary sm:text-2xl">
                                        {entry.title}
                                    </h2>
                                </Link>

                                {/* Excerpt */}
                                {entry.excerpt && (
                                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground sm:text-base">
                                        {entry.excerpt}
                                    </p>
                                )}

                                {/* Hero image — placed after title and excerpt for easier click-through */}
                                <Link
                                    to="/changelog/$slug"
                                    params={{ slug: entry.slug }}
                                    className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {entry.heroImage?.url && (
                                        <div className="mt-4 overflow-hidden rounded-2xl bg-muted/40 ring-1 ring-border dark:bg-muted/30 dark:ring-border">
                                            <img
                                                src={entry.heroImage.url}
                                                alt={entry.heroImage.alt ?? ''}
                                                className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                                loading="lazy"
                                            />
                                        </div>
                                    )}
                                </Link>

                                {/* Author */}
                                {(entry.authorName || entry.authorAvatar) && (
                                    <div className="mt-4 flex items-center gap-2">
                                        {entry.authorAvatar ? (
                                            <img
                                                src={entry.authorAvatar}
                                                alt=""
                                                className="h-8 w-8 rounded-full object-cover ring-1 ring-border dark:ring-border"
                                            />
                                        ) : (
                                            <div className="h-8 w-8 rounded-full bg-muted dark:bg-muted" />
                                        )}
                                        <span className="text-sm font-medium text-foreground dark:text-foreground">
                                            {entry.authorName ?? 'Team'}
                                        </span>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </div>
        </div>
    );
}

export default ChangelogListPage;
