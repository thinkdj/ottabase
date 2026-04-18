import { MediaPreview, useMediaLightboxRegistration } from '@ottabase/medialibrary';
import { RenderFn } from 'editorjs-blocks-react-renderer';
import React from 'react';

type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'other';
export type MediaGalleryLayoutPreset = 'grid-balanced' | 'grid-featured' | 'masonry' | 'filmstrip' | 'mosaic';

export interface MediaGalleryItem {
    id?: string;
    url: string;
    title?: string;
    caption?: string;
    mediaId?: string;
    mimeType?: string;
    mediaKind?: MediaKind;
    thumbnailUrl?: string;
    previewUrl?: string;
    altText?: string;
}

export interface MediaGalleryData {
    items?: MediaGalleryItem[];
    title?: string;
    caption?: string;
    layout?: MediaGalleryLayoutPreset;
}

const normalizeItem = (item: MediaGalleryItem) => {
    const title = item.title || item.url.substring(item.url.lastIndexOf('/') + 1);

    return {
        id: item.mediaId || item.id || item.url,
        url: item.url,
        previewUrl: item.previewUrl || item.url,
        thumbnailUrl: item.thumbnailUrl || item.url,
        title,
        originalName: title,
        altText: item.altText || title,
        caption: item.caption || null,
        mimeType: item.mimeType || null,
        mediaKind: (item.mediaKind || 'other') as MediaKind,
    };
};

const getGalleryItems = (data: MediaGalleryData): MediaGalleryItem[] => {
    return (data.items || []).filter((item) => Boolean(item?.url));
};

const layoutClassByPreset: Record<MediaGalleryLayoutPreset, string> = {
    'grid-balanced': 'md:grid-cols-2 lg:grid-cols-3',
    'grid-featured': 'md:grid-cols-2 lg:grid-cols-4',
    // True masonry: CSS columns so items in each column stack at natural image heights
    masonry: 'sm:columns-2 lg:columns-3',
    filmstrip:
        'grid-flow-col auto-cols-[82%] sm:auto-cols-[56%] lg:auto-cols-[34%] overflow-x-auto snap-x snap-mandatory pb-2',
    mosaic: 'md:grid-cols-3',
};

interface MediaGalleryItemCardProps {
    item: MediaGalleryItem;
    index: number;
    layout: MediaGalleryLayoutPreset;
}

function getLayoutItemClass(layout: MediaGalleryLayoutPreset, index: number): string {
    if (layout === 'grid-featured' && index === 0) {
        return 'aspect-video md:col-span-2 lg:col-span-2';
    }

    // Items 1 and 2 share the same row as the featured tile at lg (4-col).
    // aspect-auto removes the fixed ratio so CSS grid's default stretch aligns
    // them to the row height set by the featured item.
    if (layout === 'grid-featured' && (index === 1 || index === 2)) {
        return 'aspect-[4/3] lg:aspect-auto';
    }

    if (layout === 'filmstrip') {
        return 'aspect-video snap-start';
    }

    // masonry: no aspect ratio — natural image height determines item height
    if (layout === 'masonry') {
        return '';
    }

    if (layout === 'mosaic') {
        // Item 0 (every 5th): wide featured tile spanning 2 cols.
        if (index % 5 === 0) return 'aspect-[2.05/1] md:col-span-2';
        // Item 1: companion tile beside the wide one. At md+ it stretches to
        // match the wide tile's row height; at mobile it reverts to landscape.
        if (index % 5 === 1) return 'aspect-[4/3] md:aspect-auto';
        // Items 2-4: body row — all the same aspect for consistent row height.
        return 'aspect-[4/3]';
    }

    return 'aspect-[4/3]';
}

function MediaGalleryItemCard({ item, index, layout }: MediaGalleryItemCardProps) {
    const isMasonry = layout === 'masonry';
    const normalized = React.useMemo(() => normalizeItem(item), [item]);
    const { open: openLightbox, isEnabled: hasLightbox } = useMediaLightboxRegistration(
        `media-gallery-${normalized.id || index}`,
        normalized as any,
    );
    // Masonry items: break-inside-avoid + mb-3 for column gap; no fixed aspect ratio.
    // All other layouts: aspect class from getLayoutItemClass.
    const layoutItemClass = isMasonry ? 'break-inside-avoid mb-3' : getLayoutItemClass(layout, index);

    return (
        <div
            className={`overflow-hidden rounded-lg border border-border bg-muted/20 ${layoutItemClass} ${hasLightbox ? 'cursor-pointer' : ''}`}
            role={hasLightbox ? 'button' : undefined}
            tabIndex={hasLightbox ? 0 : -1}
            onClick={() => {
                if (hasLightbox) {
                    openLightbox();
                }
            }}
            onKeyDown={(event) => {
                if (!hasLightbox) {
                    return;
                }
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openLightbox();
                }
            }}
        >
            <MediaPreview
                item={normalized}
                mode="tile"
                className={
                    isMasonry
                        ? // Natural image height: w-full, h-auto so images determine card height
                          '!border-0 !rounded-none w-full [&_img]:!my-0 [&_img]:!h-auto [&_img]:!w-full [&_img]:!object-cover [&_img]:block [&_video]:!my-0 [&_video]:!h-auto [&_video]:!w-full [&_video]:block'
                        : // Fixed-height tile: h-full fills the aspect-ratio container
                          '!border-0 !rounded-none h-full w-full [&_img]:!my-0 [&_img]:!h-full [&_img]:!w-full [&_img]:!object-cover [&_img]:block [&_video]:!my-0 [&_video]:!h-full [&_video]:!w-full [&_video]:!object-cover [&_video]:block'
                }
                fit="cover"
                controls={false}
            />
            {item.caption && (
                <div className="border-t border-border px-3 py-2 text-sm italic text-muted-foreground">
                    {item.caption}
                </div>
            )}
        </div>
    );
}

const MediaGallery: RenderFn<MediaGalleryData> = ({ data, className = '' }) => {
    if (!data) {
        return <></>;
    }

    const items = getGalleryItems(data);
    if (items.length === 0) {
        return <></>;
    }

    const layout = data.layout || 'grid-balanced';
    const layoutClass = layoutClassByPreset[layout];
    const hasTitle = Boolean(data.title);
    const hasCaption = Boolean(data.caption);
    const isFilmstrip = layout === 'filmstrip';
    // Masonry uses CSS columns layout; filmstrip and all others use CSS grid
    const isMasonry = layout === 'masonry';
    const containerClass = isMasonry ? `gap-3 ${layoutClass}` : `grid grid-cols-1 gap-3 ${layoutClass}`;

    return (
        <figure className={`${className} my-6 not-prose rounded-xl border border-border bg-card p-4`}>
            {hasTitle && <h4 className="mb-3 text-base font-semibold text-center text-foreground">{data.title}</h4>}

            {/* Filmstrip: wrap in a positioned container so the right-edge fade stays fixed while items scroll */}
            <div className={isFilmstrip ? 'relative' : undefined}>
                <div className={containerClass}>
                    {items.map((item, index) => (
                        <MediaGalleryItemCard
                            key={item.mediaId || item.id || item.url}
                            item={item}
                            index={index}
                            layout={layout}
                        />
                    ))}
                </div>

                {/* Filmstrip affordance: right-edge gradient signals horizontal overflow */}
                {isFilmstrip && (
                    <>
                        <div
                            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-card to-transparent"
                            aria-hidden="true"
                        />
                    </>
                )}
            </div>

            {hasCaption && (
                <figcaption className="mt-3 text-sm italic text-center text-muted-foreground">
                    {data.caption}
                </figcaption>
            )}
        </figure>
    );
};

export default MediaGallery;
