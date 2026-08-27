import { useMediaLightboxRegistration } from '@ottabase/medialibrary/react';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import type { PhotoJournalItem } from '../types';
import { formatDate as defaultFormatDate } from '../types';
import type { BlogPostData, PhotoJournalRendererProps } from './blog-renderer-types';
import { BlurbText } from './BlurbText';

export interface PhotoJournalGalleryProps {
    post: BlogPostData;
    props: PhotoJournalRendererProps;
    tone?: 'editorial' | 'minimal';
}

/**
 * Column widths, in pairs that fill the 12-column row exactly.
 *
 * Each photograph keeps its OWN height (see `photoAspect`) — that variation is the point, and a
 * grid of identical rectangles reads like brickwork rather than a contact sheet. What the pairs
 * fix is the empty frame: a row used to be as tall as its tallest member while every other tile
 * kept its own height, and the difference showed as blank space inside the short one. Pairing
 * 8+4, 5+7, 6+6 keeps the two photographs in a row close in height, and `items-start` on the grid
 * stops the shorter one from stretching into a void.
 */
const EDITORIAL_SPANS = [
    'col-span-2 md:col-span-8',
    'col-span-1 md:col-span-4',
    'col-span-1 md:col-span-5',
    'col-span-1 md:col-span-7',
    'col-span-1 md:col-span-6',
    'col-span-1 md:col-span-6',
];

/**
 * The photograph's own shape decides the frame, leaning portrait when nothing else says otherwise:
 * a journal reads better with vertical frames punctuating the wide ones, and an album whose files
 * carry no dimensions still varies rather than settling into a single ratio.
 */
function photoAspect(item: PhotoJournalItem, index: number): string {
    if (!item.width || !item.height) return index % 3 === 0 ? 'aspect-[4/3]' : 'aspect-[3/4]';
    const ratio = item.width / item.height;
    if (ratio < 0.95) return 'aspect-[3/4]';
    if (ratio > 1.45) return 'aspect-[3/2]';
    if (ratio > 1.15) return 'aspect-[4/3]';
    return 'aspect-square';
}

function renderableDate<T extends Date | string | number>(
    value: T,
    format: (timestamp: T) => string,
): { iso: string; label: string } | null {
    try {
        const date = new Date(value);
        return { iso: date.toISOString(), label: format(value) };
    } catch {
        return null;
    }
}

function formatPhotoDate(value: number): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value));
}

function photoViewerItem(item: PhotoJournalItem) {
    const url = sanitizeUrl(item.url);
    if (url === '#') return null;
    const previewUrl = item.previewUrl ? sanitizeUrl(item.previewUrl) : null;
    const thumbnailUrl = item.thumbnailUrl ? sanitizeUrl(item.thumbnailUrl) : null;
    return {
        id: item.mediaId || item.id,
        url,
        previewUrl: previewUrl === '#' ? null : previewUrl,
        thumbnailUrl: thumbnailUrl === '#' ? null : thumbnailUrl,
        title: item.title || null,
        originalName: item.title || null,
        altText: item.alt || null,
        caption: item.caption || null,
        mimeType: item.mimeType || 'image/jpeg',
        mediaKind: 'image' as const,
        width: item.width || null,
        height: item.height || null,
        createdAt: item.takenAt || null,
    };
}

function PhotoTile({
    item,
    index,
    postId,
    interactive,
    tone,
}: {
    item: PhotoJournalItem;
    index: number;
    postId: string;
    interactive: boolean;
    tone: 'editorial' | 'minimal';
}) {
    const viewerItem = photoViewerItem(item);
    const takenAt = item.takenAt ? renderableDate(item.takenAt, formatPhotoDate) : null;
    const { open, isEnabled } = useMediaLightboxRegistration(
        `photo-journal-${postId}-${item.id}`,
        interactive ? viewerItem : null,
    );
    if (!viewerItem) return null;

    const image = (
        <>
            <img
                src={
                    interactive
                        ? viewerItem.previewUrl || viewerItem.url
                        : viewerItem.thumbnailUrl || viewerItem.previewUrl || viewerItem.url
                }
                alt={item.alt || item.caption || item.title || ''}
                loading={interactive && index < 2 ? 'eager' : 'lazy'}
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.015]"
            />
            <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" aria-hidden="true" />
            {(item.caption || item.location) && (
                <span
                    className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-4 pb-3 pt-10 text-left text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
                    aria-hidden="true"
                >
                    {item.caption && <span className="block text-sm leading-snug">{item.caption}</span>}
                    {item.location && (
                        <span className="mt-1 block text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-white/75">
                            {item.location}
                        </span>
                    )}
                </span>
            )}
        </>
    );

    const frameClass = `${interactive ? photoAspect(item, index) : 'h-full min-h-0'} group relative block w-full overflow-hidden bg-muted/40 ${
        tone === 'editorial' ? 'rounded-[0.2rem]' : 'rounded-none'
    }`;
    return (
        <figure
            className={interactive ? EDITORIAL_SPANS[index % EDITORIAL_SPANS.length] : 'flex h-full min-h-0 flex-col'}
        >
            {interactive ? (
                <button
                    type="button"
                    className={`${frameClass} cursor-zoom-in outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                    onClick={isEnabled ? open : undefined}
                    aria-label={`Open photograph ${index + 1}${item.caption ? `: ${item.caption}` : ''}`}
                >
                    {image}
                </button>
            ) : (
                <div className={frameClass}>{image}</div>
            )}
            {interactive && (item.caption || item.location || takenAt) && (
                <figcaption className="mt-2 flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs leading-relaxed text-muted-foreground">
                    <span>{item.caption || item.alt || `Photograph ${index + 1}`}</span>
                    <span className="flex gap-2 text-[0.625rem] font-medium uppercase tracking-[0.14em]">
                        {item.location && <span>{item.location}</span>}
                        {takenAt && <time dateTime={takenAt.iso}>{takenAt.label}</time>}
                    </span>
                </figcaption>
            )}
        </figure>
    );
}

function TimelineCollage({ post, tone }: { post: BlogPostData; tone: 'editorial' | 'minimal' }) {
    const photos = (post.photoAlbum ?? []).slice(0, 3);
    if (photos.length === 0) return null;
    return (
        <div
            className={`overflow-hidden bg-muted/40 ${tone === 'editorial' ? 'rounded-2xl' : 'border-y border-border/60'}`}
        >
            <div
                className={`grid aspect-[16/10] gap-0.5 bg-background ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}
            >
                <div className={photos.length === 1 ? '' : 'col-span-2'}>
                    <PhotoTile item={photos[0]} index={0} postId={post.id} interactive={false} tone={tone} />
                </div>
                {photos.length > 1 && (
                    <div className="grid grid-rows-2 gap-0.5">
                        <PhotoTile item={photos[1]} index={1} postId={post.id} interactive={false} tone={tone} />
                        {photos[2] ? (
                            <PhotoTile item={photos[2]} index={2} postId={post.id} interactive={false} tone={tone} />
                        ) : (
                            <div className="bg-muted/60" />
                        )}
                    </div>
                )}
            </div>
            <div className="flex items-end justify-between gap-4 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                    <p className="mb-1 text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        Photo journal · {post.photoAlbum?.length ?? 0} frames
                    </p>
                    <h2 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{post.title}</h2>
                    {post.photoNote && (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{post.photoNote}</p>
                    )}
                </div>
                <span className="shrink-0 text-2xl font-light text-muted-foreground" aria-hidden="true">
                    ↗
                </span>
            </div>
        </div>
    );
}

/** Shared photo-journal visual language used by built-in themes. */
export function PhotoJournalGallery({ post, props, tone = 'editorial' }: PhotoJournalGalleryProps) {
    const variant = props.variant ?? 'detail';
    if (variant === 'timeline') return <TimelineCollage post={post} tone={tone} />;

    const photos = post.photoAlbum ?? [];
    const formatDate = props.formatDate || defaultFormatDate;
    const publishedDate = post.publishedAt ? renderableDate(post.publishedAt, formatDate) : null;

    /*
     * The same visibility contract every other renderer honours (BlogRendererProps declares these
     * for ALL content types, so a caller that turns the title off on an article expects the same
     * from a journal). Absent means shown: PhotoJournalRenderer forwards `...rest` without applying
     * ArticleBlogRenderer's defaults, so only an explicit `false` hides anything.
     *
     * The field note is NOT part of this. It reads like a standfirst but it is authored body copy —
     * the excerpt is DERIVED from it (createPhotoJournalExcerpt), not the other way round — so
     * `showExcerpt`, which defaults to false for articles, would silently delete content from every
     * existing caller. A shell that owns the chrome still owns only the chrome.
     */
    const showTitle = props.showTitle !== false;
    const showMetadata = props.showMetadata !== false;
    const byline = showMetadata && (post.author?.name || publishedDate);

    return (
        <div className="space-y-10 sm:space-y-14">
            {(showTitle || byline || post.photoNote) && (
                <header className="mx-auto max-w-3xl text-center">
                    {showTitle && (
                        <>
                            <p className="mb-4 text-[0.625rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                                Photo journal · {photos.length} {photos.length === 1 ? 'frame' : 'frames'}
                            </p>
                            <h1
                                className={`${tone === 'editorial' ? 'font-serif' : 'font-light'} text-4xl tracking-[-0.035em] sm:text-6xl`}
                            >
                                {post.title}
                            </h1>
                        </>
                    )}
                    {byline && (
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {post.author?.name && <span>{post.author.name}</span>}
                            {post.author?.name && publishedDate && <span aria-hidden="true">·</span>}
                            {publishedDate && <time dateTime={publishedDate.iso}>{publishedDate.label}</time>}
                        </div>
                    )}
                    {post.photoNote && (
                        <BlurbText
                            text={post.photoNote}
                            className="mx-auto mt-7 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg"
                        />
                    )}
                </header>
            )}

            {/*
             * `items-start` is the whole fix: grid items stretch to the row by default, so a short
             * photograph was handed a tall frame and padded the difference with blank space. Let each
             * tile end where its photograph does and the rows go pleasantly ragged instead.
             */}
            <div
                className={`grid grid-cols-2 items-start gap-x-2 gap-y-5 md:grid-cols-12 md:gap-x-3 md:gap-y-8 ${tone === 'minimal' ? 'md:gap-x-1' : ''}`}
            >
                {photos.map((item, index) => (
                    <PhotoTile key={item.id} item={item} index={index} postId={post.id} interactive tone={tone} />
                ))}
            </div>
        </div>
    );
}
