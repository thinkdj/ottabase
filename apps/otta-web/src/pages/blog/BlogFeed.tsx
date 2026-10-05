/**
 * The public blog feed. One component serves /blog and every archive: the scope says whose posts,
 * the URL says the search, type and page, so any view can be shared and the back button works.
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_LIST_QUERY_CONFIG, SERIES_LIST_QUERY_CONFIG } from '@/config/queryConfig';
import { useSession } from '@/lib/auth';
import type { PostAuthor } from '@/types/blog';
import {
    CONTENT_TYPES,
    contentTypeLabel,
    formatDate,
    getActiveTheme,
    type BlogPostData,
    type ContentType,
} from '@ottabase/ottablog';
import { BlurbRenderer, PhotoJournalRenderer, defaultTheme } from '@ottabase/ottablog/renderer';
import { createModelHooks, useApiQuery } from '@ottabase/ottaorm/client';
import { EmptyState, LoadingState } from '@ottabase/ui-components';
import {
    Alert,
    Avatar,
    AvatarFallback,
    AvatarImage,
    Badge,
    Button,
    Card,
    CardContent,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Input,
    NativeSelect,
    NativeSelectOption,
} from '@ottabase/ui-shadcn';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { keepPreviousData } from '@tanstack/react-query';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    Calendar,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    FolderTree,
    Lock,
    PenLine,
    Plus,
    Search,
    Tag,
    User,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    adjacentMonths,
    dateTitle,
    feedEndpoint,
    isContentType,
    SCOPE_LABELS,
    useScopeEntity,
    type FeedScope,
    type ScopeEntity,
} from './blogFeedScope';
import { blogFeedSearch, localizedPostSearch, type BlogFeedSearch } from './blogLinks';
import { partitionBlogTimeline } from './blogTimeline';

interface Taxon {
    id: string;
    name: string;
    slug: string;
}

/** A post as the public list endpoint returns it */
type FeedPost = BlogPostData & {
    contentType: ContentType;
    isFeatured: boolean;
    publishedAt: string | null;
    author?: PostAuthor | null;
    tags?: Taxon[];
    categories?: Taxon[];
};

interface FeedResponse {
    data: FeedPost[];
    pagination: { page: number; perPage: number; total: number; totalPages: number };
}

interface SeriesOption {
    id: string;
    title: string;
    slug: string;
}

const blogSeriesHooks = createModelHooks<SeriesOption>({ entityName: 'series' });

const ALL: FeedScope = { kind: 'all' };
const NO_POSTS: FeedPost[] = [];
const NO_SERIES: SeriesOption[] = [];
const TAGLINE = 'Photo journals, short thoughts, articles, tutorials, and updates from our team.';
const SCOPE_ICONS = { tag: Tag, category: FolderTree, series: BookOpen, author: PenLine, date: Calendar };
/** Meta description of a scoped page, finished with its title */
const ABOUT = {
    tag: 'Posts tagged',
    category: 'Posts in',
    series: 'Every part of',
    author: 'Posts by',
    date: 'Posts from',
};
const NOT_FOUND = {
    tag: 'Tag not found',
    category: 'Category not found',
    series: 'Series not found',
    author: 'Author not found',
    date: 'No such date',
};
const EYEBROW = 'text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground';
const PILL = `inline-flex items-center rounded-full border-transparent bg-background px-2.5 py-0.5 ${EYEBROW} ring-1 ring-border`;
const FOCUS_RING = 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
const CARD_PROPS = { showHeroImage: true, showExcerpt: true, showMetadata: true, formatDate };

export function BlogFeed({ scope }: { scope: FeedScope | null }) {
    const search = useSearch({ strict: false }) as BlogFeedSearch;
    const navigate = useNavigate();
    const lang = search.lang ?? '';
    const type = isContentType(search.type) ? search.type : undefined;
    const q = search.q ?? '';
    const page = search.page ?? 1;
    const langSearch = lang ? { lang } : {};

    const { user } = useSession();
    // /studio is gated on posts:update and every write is re-checked server-side; being signed in
    // is not a content permission, so the CTA only shows to people who can actually write.
    const canWrite = hasGrantedPermission(user?.permissions, 'posts:update');
    const theme = useMemo(() => getActiveTheme() ?? defaultTheme, []);
    // Another theme draws its own cards; the default look is the feed's own cards below.
    const themeCard = theme.metadata.id === defaultTheme.metadata.id ? undefined : theme.renderers.renderCard;

    const active = scope ?? ALL;
    const { entity, loading: scopeLoading, missing } = useScopeEntity(active);
    const endpoint = scope && !missing ? feedEndpoint(scope, { ...search, type }, entity?.id) : null;
    const list = useApiQuery<FeedResponse>({
        entity: 'posts',
        queryKey: ['feed', endpoint],
        endpoint: endpoint ?? '',
        queryOptions: {
            ...BLOG_LIST_QUERY_CONFIG,
            enabled: !!endpoint,
            placeholderData: keepPreviousData,
            meta: { errorPresentation: 'local' },
        },
    });
    const showSeries = active.kind === 'all' || active.kind === 'series';
    const { data: series = NO_SERIES } = blogSeriesHooks.useList(undefined, {
        ...SERIES_LIST_QUERY_CONFIG,
        enabled: showSeries,
    });

    /** Changes the URL state; a change of filter starts again at page 1 */
    const update = useCallback(
        (patch: Partial<BlogFeedSearch>, replace = false) =>
            void navigate({
                search: (prev: BlogFeedSearch) => blogFeedSearch({ ...prev, page: undefined, ...patch }),
                replace,
            } as never),
        [navigate],
    );

    // The box follows the URL (back button, shared link) and the URL follows the box once typing pauses.
    const [draft, setDraft] = useState(q);
    useEffect(() => setDraft(q), [q]);
    useEffect(() => {
        if (draft === q) return;
        const timer = setTimeout(() => update({ q: draft }, true), 300);
        return () => clearTimeout(timer);
    }, [draft, q, update]);

    const openSeries = (slug: string) =>
        void navigate(
            slug
                ? { to: '/blog/series/$slug', params: { slug }, search: langSearch }
                : { to: '/blog', search: langSearch },
        );

    const posts = list.data?.data ?? NO_POSTS;
    const total = list.data?.pagination.total;
    const totalPages = list.data?.pagination.totalPages ?? 1;
    const filtered = Boolean(q || type);
    // The featured rail belongs to the front page only; a filtered or scoped view is a plain list.
    const plain = active.kind === 'all' && !filtered && page === 1;
    const { featuredPosts, timelinePosts } = plain
        ? partitionBlogTimeline(posts)
        : { featuredPosts: NO_POSTS, timelinePosts: posts };

    const title = active.kind === 'date' ? dateTitle(active.year, active.month) : (entity?.name ?? '');
    const seo =
        active.kind === 'all'
            ? { title: 'Blog - Stories, Thoughts, and Photo Journals', description: TAGLINE }
            : {
                  title: `${SCOPE_LABELS[active.kind]}: ${title}`,
                  description: entity?.description || `${ABOUT[active.kind]} ${title}`,
              };

    const renderPost = (post: FeedPost, index: number) => {
        const part = active.kind === 'series' ? (post.seriesOrder ?? index + 1) : undefined;
        const to = { to: '/blog/$slug', params: { slug: post.slug }, search: localizedPostSearch(post, lang) } as const;
        if (themeCard) {
            return (
                <Link key={post.id} {...to} className={`group block rounded-xl ${FOCUS_RING}`}>
                    {themeCard({ ...post, seriesOrder: part ?? post.seriesOrder }, { post, ...CARD_PROPS })}
                </Link>
            );
        }
        // A protected post ships no body (the API blanks it), so it gets the card with the lock.
        if (post.contentType === 'blurb' && !post.isProtected) {
            return (
                <Link
                    key={post.id}
                    {...to}
                    aria-label={`Open thought from ${post.author?.name || 'author'}`}
                    // Matches the blurb card's bound edge so the focus ring traces the card.
                    className={`group block rounded-l-sm rounded-r-2xl ${FOCUS_RING}`}
                >
                    <BlurbRenderer post={post} variant="timeline" formatDate={formatDate} />
                </Link>
            );
        }
        if (post.contentType === 'photo' && !post.isProtected) {
            return (
                <Link
                    key={post.id}
                    {...to}
                    aria-label={`Open photo journal ${post.title}`}
                    className={`group block rounded-2xl ${FOCUS_RING}`}
                >
                    <PhotoJournalRenderer post={post} variant="timeline" formatDate={formatDate} />
                </Link>
            );
        }
        return <PostCard key={post.id} post={post} lang={lang} part={part} />;
    };

    return (
        // One measure for the whole page, matching the post view's column, so a reader moving between
        // the list and a post keeps the same line length. Two rhythms only: 12 between sections, 6 within.
        <div className="mx-auto w-full max-w-3xl space-y-12">
            <SEOHead {...seo} ogType="website" twitterCard="summary_large_image" noIndex={filtered} />

            {scope === null || missing ? (
                <EmptyState
                    title={NOT_FOUND[scope?.kind === 'all' ? 'date' : (scope?.kind ?? 'date')]}
                    description="There is nothing at this address."
                    action={<BackToBlog search={langSearch} />}
                    className="mx-auto max-w-md rounded-2xl"
                />
            ) : scopeLoading ? (
                <FeedSkeleton />
            ) : (
                <>
                    <div className="space-y-4">
                        {active.kind !== 'all' && <BackToBlog search={langSearch} ghost />}
                        <FeedHeader scope={active} entity={entity} total={total} canWrite={canWrite} lang={lang} />
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full sm:w-80">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                aria-label="Search posts"
                                placeholder="Search posts"
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                className="h-9 pl-10"
                            />
                        </div>
                        <div className="flex gap-2">
                            <NativeSelect
                                value={type ?? ''}
                                onChange={(e) => update({ type: e.target.value || undefined })}
                                aria-label="Filter by content type"
                            >
                                <NativeSelectOption value="">All types</NativeSelectOption>
                                {Object.entries(CONTENT_TYPES).map(([value, { label }]) => (
                                    <NativeSelectOption key={value} value={value}>
                                        {label}
                                    </NativeSelectOption>
                                ))}
                            </NativeSelect>
                            {showSeries && series.length > 0 && (
                                <NativeSelect
                                    value={active.kind === 'series' ? active.slug : ''}
                                    onChange={(e) => openSeries(e.target.value)}
                                    aria-label="Browse a series"
                                >
                                    <NativeSelectOption value="">All series</NativeSelectOption>
                                    {series.map((s) => (
                                        <NativeSelectOption key={s.id} value={s.slug}>
                                            {s.title}
                                        </NativeSelectOption>
                                    ))}
                                </NativeSelect>
                            )}
                        </div>
                    </div>

                    {list.error && <Alert variant="destructive">Could not load posts. {list.error.message}</Alert>}

                    {list.isPending && !list.error ? (
                        <FeedSkeleton listOnly />
                    ) : posts.length === 0 ? (
                        !list.error && (
                            <EmptyState
                                title={filtered ? 'No posts match.' : 'No posts here yet.'}
                                action={
                                    filtered && (
                                        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                                            <Link to="." search={langSearch as never}>
                                                Clear filters
                                            </Link>
                                        </Button>
                                    )
                                }
                                className="rounded-2xl"
                            />
                        )
                    ) : (
                        // The previous page stays on screen, dimmed, while the next one loads.
                        <div
                            className={`space-y-12 transition-opacity ${list.isPlaceholderData ? 'opacity-60' : ''}`}
                            aria-busy={list.isPlaceholderData}
                        >
                            {featuredPosts.length > 0 && (
                                <section className="space-y-5">
                                    <h2 className={EYEBROW}>Featured</h2>
                                    <div className="grid gap-6 md:grid-cols-2">
                                        {featuredPosts.map((post) => (
                                            <FeaturedPostCard key={post.id} post={post} lang={lang} />
                                        ))}
                                    </div>
                                </section>
                            )}
                            {timelinePosts.length > 0 && (
                                <section className="space-y-5">
                                    {plain && <h2 className={EYEBROW}>Latest</h2>}
                                    {/* Mixed shapes sit here (a bordered thought, an image collage, an article
                                        card), so they get more air than a uniform list would. */}
                                    <div className="space-y-6">{timelinePosts.map(renderPost)}</div>
                                </section>
                            )}
                        </div>
                    )}

                    {totalPages > 1 && (
                        <nav className="flex items-center justify-center gap-4" aria-label="Pages">
                            <PageLink page={page - 1} disabled={page <= 1}>
                                <ChevronLeft className="mr-1 h-4 w-4" />
                                Previous
                            </PageLink>
                            <span className={EYEBROW}>
                                Page {page} of {totalPages}
                            </span>
                            <PageLink page={page + 1} disabled={page >= totalPages}>
                                Next
                                <ChevronRight className="ml-1 h-4 w-4" />
                            </PageLink>
                        </nav>
                    )}
                </>
            )}
        </div>
    );
}

function BackToBlog({ search, ghost = false }: { search: { lang?: string }; ghost?: boolean }) {
    return (
        <Button
            asChild
            variant="ghost"
            size="sm"
            className={ghost ? '-ml-2 w-fit gap-1.5 text-muted-foreground' : 'gap-1.5'}
        >
            <Link to="/blog" search={search}>
                <ArrowLeft className="h-4 w-4" />
                Back to Blog
            </Link>
        </Button>
    );
}

function PageLink({ page, disabled, children }: { page: number; disabled: boolean; children: ReactNode }) {
    if (disabled) {
        return (
            <Button variant="ghost" size="sm" className="text-muted-foreground" disabled>
                {children}
            </Button>
        );
    }
    return (
        <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link to="." search={((prev: BlogFeedSearch) => ({ ...prev, page: page > 1 ? page : undefined })) as never}>
                {children}
            </Link>
        </Button>
    );
}

function FeedHeader({
    scope,
    entity,
    total,
    canWrite,
    lang,
}: {
    scope: FeedScope;
    entity?: ScopeEntity;
    total?: number;
    canWrite: boolean;
    lang: string;
}) {
    if (scope.kind === 'all') {
        return (
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:justify-between">
                <div className="space-y-1.5">
                    <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
                    <p className="text-lg text-muted-foreground">{TAGLINE}</p>
                </div>
                {canWrite && <WriteMenu />}
            </div>
        );
    }
    const Icon = SCOPE_ICONS[scope.kind];
    const title = scope.kind === 'date' ? dateTitle(scope.year, scope.month) : (entity?.name ?? '');
    const noun = scope.kind === 'series' ? 'part' : 'post';
    return (
        <div className="flex items-start gap-4">
            {scope.kind === 'author' && (
                <Avatar className="h-16 w-16 ring-1 ring-border">
                    {entity?.image && <AvatarImage src={sanitizeUrl(entity.image)} alt="" />}
                    <AvatarFallback className="text-lg font-medium">{title.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
            )}
            <div className="space-y-1.5">
                <p className={`flex items-center gap-1.5 ${EYEBROW}`}>
                    <Icon className="h-3.5 w-3.5" />
                    {SCOPE_LABELS[scope.kind]}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                    {entity?.status && (
                        <Badge variant="secondary" className={PILL}>
                            {entity.status}
                        </Badge>
                    )}
                </div>
                {entity?.description && <p className="max-w-3xl text-muted-foreground">{entity.description}</p>}
                {total !== undefined && (
                    <p className={`pt-1 ${EYEBROW}`}>
                        {total} {total === 1 ? noun : `${noun}s`}
                    </p>
                )}
                {scope.kind === 'date' && scope.month && <MonthNav year={scope.year} month={scope.month} lang={lang} />}
            </div>
        </div>
    );
}

function MonthNav({ year, month, lang }: { year: number; month: number; lang: string }) {
    const { prev, next } = adjacentMonths(year, month);
    const search = lang ? { lang } : {};
    return (
        <nav className="-ml-2 flex flex-wrap items-center gap-1 pt-2" aria-label="Months">
            {prev && (
                <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                    <Link to="/blog/archive/$year/$month" params={prev} search={search}>
                        <ChevronLeft className="h-4 w-4" />
                        Previous month
                    </Link>
                </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                <Link to="/blog/archive/$year" params={{ year: String(year) }} search={search}>
                    All of {year}
                </Link>
            </Button>
            {next && (
                <Button asChild variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                    <Link to="/blog/archive/$year/$month" params={next} search={search}>
                        Next month
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                </Button>
            )}
        </nav>
    );
}

function WriteMenu() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button className="shrink-0">
                    <Plus className="mr-2 h-4 w-4" />
                    Write
                    <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {Object.entries(CONTENT_TYPES).map(([value, { label }]) => (
                    <DropdownMenuItem key={value} asChild>
                        <Link to="/studio/new" search={{ contentType: value }}>
                            {label}
                        </Link>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** The same stack and rhythm as the list it becomes, so nothing jumps */
function FeedSkeleton({ listOnly = false }: { listOnly?: boolean }) {
    return (
        <div className="space-y-12" aria-busy="true">
            <span className="sr-only">Loading posts</span>
            {!listOnly && (
                <div className="space-y-2">
                    <LoadingState count={1} height="h-3" className="w-24 rounded-full" />
                    <LoadingState count={1} height="h-9" className="w-64 rounded-lg" />
                </div>
            )}
            <div className="space-y-6">
                {Array.from({ length: 4 }, (_, index) => (
                    <LoadingState key={index} count={1} height="h-40" className="rounded-2xl" />
                ))}
            </div>
        </div>
    );
}

function PublishedDateLink({ publishedAt }: { publishedAt: string }) {
    const date = new Date(publishedAt);
    if (Number.isNaN(date.getTime())) return <span>{formatDate(publishedAt)}</span>;
    const month = String(date.getUTCMonth() + 1);
    return (
        <Link
            to="/blog/archive/$year/$month"
            params={{ year: String(date.getUTCFullYear()), month }}
            className="flex items-center gap-1 hover:text-foreground"
            aria-label={`View posts from ${date.getUTCFullYear()}-${month.padStart(2, '0')}`}
        >
            <Calendar className="h-3 w-3" />
            {formatDate(publishedAt, { timeZone: 'UTC' })}
        </Link>
    );
}

function TaxonPills({ items, limit, variant }: { items?: Taxon[]; limit: number; variant: 'outline' | 'secondary' }) {
    if (!items?.length) return null;
    return (
        <div className="mb-2 flex flex-wrap gap-1.5">
            {items.slice(0, limit).map((item) => (
                <Badge key={item.id} variant={variant} className={`${PILL} normal-case tracking-normal`}>
                    {variant === 'outline' && <Tag className="mr-1 h-2.5 w-2.5" />}
                    {item.name}
                </Badge>
            ))}
            {items.length > limit && (
                <span className="text-[0.6875rem] text-muted-foreground">+{items.length - limit}</span>
            )}
        </div>
    );
}

function FeaturedPostCard({ post, lang }: { post: FeedPost; lang: string }) {
    const heroUrl = post.heroImage?.url ? sanitizeUrl(post.heroImage.url) : '#';
    const photoCount = post.photoAlbum?.length ?? 0;
    const to = { to: '/blog/$slug', params: { slug: post.slug }, search: localizedPostSearch(post, lang) } as const;
    return (
        <Card className="group h-full overflow-hidden rounded-2xl transition-colors duration-normal hover:bg-muted/70">
            {heroUrl !== '#' && (
                <div className="relative h-48 overflow-hidden">
                    <img
                        src={heroUrl}
                        alt={post.heroImage?.alt || post.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                    />
                    <div className={`absolute right-3 top-3 ${PILL} bg-background/80 py-1`}>
                        {post.contentType === 'photo' ? `Featured, ${photoCount} frames` : 'Featured'}
                    </div>
                </div>
            )}
            <CardContent className="p-6">
                {post.contentType !== 'blog' && (
                    <span className={`mb-2 ${PILL}`}>{contentTypeLabel(post.contentType)}</span>
                )}
                <h3 className="mb-2 flex items-center gap-2 font-serif text-xl font-semibold leading-snug tracking-[-0.02em] line-clamp-2">
                    <Link {...to} className="hover:underline focus-visible:outline-none">
                        {post.title}
                        {post.isProtected && (
                            <Lock
                                className="ml-1.5 inline-block h-4 w-4 text-muted-foreground"
                                aria-label="Password protected"
                            />
                        )}
                    </Link>
                </h3>
                {post.excerpt && (
                    <p className="mb-4 text-sm leading-relaxed text-muted-foreground line-clamp-3">{post.excerpt}</p>
                )}
                <TaxonPills items={post.tags} limit={99} variant="outline" />
                <TaxonPills items={post.categories} limit={99} variant="secondary" />
                <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${EYEBROW}`}>
                    {post.author?.name && (
                        <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {post.author.name}
                        </span>
                    )}
                    {post.publishedAt && <PublishedDateLink publishedAt={post.publishedAt} />}
                    {post.contentType === 'photo' ? (
                        <span>{photoCount} photographs</span>
                    ) : post.readingTimeMinutes ? (
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {post.readingTimeMinutes} min
                        </span>
                    ) : null}
                </div>
                <Link
                    {...to}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    {post.contentType === 'photo' ? 'Open journal' : 'Read post'}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
            </CardContent>
        </Card>
    );
}

function PostCard({ post, lang, part }: { post: FeedPost; lang: string; part?: number }) {
    const heroUrl = post.heroImage?.url ? sanitizeUrl(post.heroImage.url) : '#';
    const to = { to: '/blog/$slug', params: { slug: post.slug }, search: localizedPostSearch(post, lang) } as const;
    return (
        <Card className="group h-full overflow-hidden rounded-2xl transition-colors duration-normal hover:bg-muted/70">
            {heroUrl !== '#' && (
                // Print-edge frame, matching the photo journal's tiles and the article hero: a fixed ratio
                // so the list does not reflow as images arrive, a hairline so a pale photo still has an edge.
                <div className="relative aspect-[16/9] overflow-hidden bg-muted/40">
                    <img
                        src={heroUrl}
                        alt={post.heroImage?.alt || post.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.015]"
                    />
                    <span
                        className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5"
                        aria-hidden="true"
                    />
                </div>
            )}
            <CardContent className="p-5">
                {(part !== undefined || post.contentType !== 'blog') && (
                    <span className={`mb-2 ${PILL}`}>
                        {part !== undefined ? `Part ${part}` : contentTypeLabel(post.contentType)}
                    </span>
                )}
                {/* Serif, like the article masthead it opens: a list of articles should read like a contents page. */}
                <h3 className="mb-2 flex items-center gap-2 font-serif text-lg font-semibold leading-snug tracking-[-0.015em] line-clamp-2">
                    <Link {...to} className="hover:underline focus-visible:outline-none">
                        {post.title}
                        {post.isProtected && (
                            <Lock
                                className="ml-1.5 inline-block h-3 w-3 text-muted-foreground"
                                aria-label="Password protected"
                            />
                        )}
                    </Link>
                </h3>
                {post.excerpt && (
                    <p className="mb-3 text-sm leading-relaxed text-muted-foreground line-clamp-2">{post.excerpt}</p>
                )}
                <TaxonPills items={post.tags} limit={3} variant="outline" />
                <TaxonPills items={post.categories} limit={2} variant="secondary" />
                <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${EYEBROW}`}>
                    {post.publishedAt && <PublishedDateLink publishedAt={post.publishedAt} />}
                    {post.readingTimeMinutes ? (
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {post.readingTimeMinutes} min
                        </span>
                    ) : null}
                </div>
                <Link
                    {...to}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    Read post
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
            </CardContent>
        </Card>
    );
}
