import {
    IconArchive,
    IconExternalLink,
    IconFileDescription,
    IconFileMusic,
    IconPhoto,
    IconPlayerPlay,
} from '@tabler/icons-react';
import { useState } from 'react';
import type { MediaViewerItem } from '../types';
import { getMediaDisplayTitle, getMediaKindFromMimeType, isDocumentMedia } from '../utils';
import { ZoomableImage, type ZoomStartGesture } from './ZoomableImage';

export interface MediaPreviewProps {
    item: Partial<MediaViewerItem> & {
        originalName?: string | null;
        storageKey?: string | null;
    };
    className?: string;
    mode?: 'tile' | 'detail' | 'lightbox' | 'thumb' | 'immersive';
    fit?: 'cover' | 'contain';
    controls?: boolean;
    muted?: boolean;
    /** Disable zoom/pan affordances for an inactive carousel neighbor. */
    interactive?: boolean;
    /** Media preload behavior. Inactive carousel neighbors should not fetch video metadata. */
    preload?: 'none' | 'metadata' | 'auto';
    /** Mouse gesture that toggles zoom in lightbox / immersive modes. Defaults to 'single'. */
    zoomStart?: ZoomStartGesture;
}

function getPlaceholderIcon(mediaKind: string) {
    switch (mediaKind) {
        case 'video':
            return IconPlayerPlay;
        case 'audio':
            return IconFileMusic;
        case 'document':
            return IconFileDescription;
        case 'archive':
            return IconArchive;
        default:
            return IconPhoto;
    }
}

function getShellClassName(mode: NonNullable<MediaPreviewProps['mode']>, className?: string): string {
    const modeClassName =
        mode === 'thumb'
            ? 'h-full w-full overflow-hidden rounded-md bg-muted/40'
            : mode === 'detail'
              ? 'h-full w-full overflow-hidden rounded-xl bg-muted/40'
              : mode === 'immersive'
                ? // In immersive mode, a whisper of muted tint marks the media boundary without a hard border
                  'h-full w-full flex items-center justify-center overflow-hidden bg-muted/5'
                : mode === 'lightbox'
                  ? 'h-full w-full overflow-hidden bg-muted/40'
                  : 'h-full w-full overflow-hidden rounded-xl bg-muted/40';

    return [modeClassName, className].filter(Boolean).join(' ');
}

function getShellStyle(mode: NonNullable<MediaPreviewProps['mode']>): React.CSSProperties | undefined {
    if (mode !== 'lightbox' && mode !== 'immersive') return undefined;

    // `--radius` is the app's runtime theme token. Keep a package-safe fallback for consumers
    // that render the component without the app theme stylesheet.
    return { borderRadius: 'var(--radius, 0.75rem)' };
}

interface VideoPreviewProps {
    src: string;
    poster?: string;
    title: string;
    className: string;
    style?: React.CSSProperties;
    controls: boolean;
    muted: boolean;
    preload: NonNullable<MediaPreviewProps['preload']>;
    compact: boolean;
}

/*
 * A video that cannot play (a codec the browser lacks, a host a content blocker or privacy setting stops,
 * a URL that answers with a page instead of a file) would show the browser's own error text, such as
 * Firefox's "No video with supported format and MIME type found". It shows its poster with a plain
 * message and a link to the file instead. The poster also stands in while the first frame loads.
 */
function VideoPreview({ src, poster, title, className, style, controls, muted, preload, compact }: VideoPreviewProps) {
    const [failed, setFailed] = useState(false);

    if (failed) {
        return (
            <div
                data-slot="media-video-unplayable"
                className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
                style={style}
            >
                {poster ? (
                    <img
                        src={poster}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 h-full w-full object-cover opacity-40"
                    />
                ) : null}
                <div className="relative flex flex-col items-center gap-2 p-4 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
                        <IconPlayerPlay className="h-5 w-5" />
                    </div>
                    {compact ? null : (
                        <>
                            <p className="max-w-[18rem] text-sm font-medium text-foreground">
                                This browser can&rsquo;t play {title}
                            </p>
                            <a
                                href={src}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                            >
                                Open the file
                                <IconExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <video
            src={src}
            poster={poster}
            className={`h-full w-full ${className}`}
            style={style}
            controls={controls}
            muted={muted}
            playsInline
            preload={preload}
            onError={() => setFailed(true)}
        />
    );
}

export function MediaPreview({
    item,
    className,
    mode = 'tile',
    fit = 'cover',
    controls = false,
    muted = true,
    interactive = true,
    preload = 'metadata',
    zoomStart = 'single',
}: MediaPreviewProps) {
    const mediaKind = item.mediaKind ?? getMediaKindFromMimeType(item.mimeType, item.originalName);
    const previewUrl = item.previewUrl ?? item.url ?? '';
    const title = getMediaDisplayTitle({
        title: item.title ?? null,
        originalName: item.originalName ?? '',
        storageKey: item.storageKey ?? item.url ?? '',
    });
    const objectFitClassName = fit === 'contain' ? 'object-contain' : 'object-cover';
    const shellClassName = getShellClassName(mode, className);
    const shellStyle = getShellStyle(mode);

    if (mediaKind === 'image' && previewUrl) {
        // Use ZoomableImage in lightbox / immersive modes for zoom + pan support
        if (mode === 'lightbox' || mode === 'immersive') {
            return (
                <div className={shellClassName} style={shellStyle}>
                    <ZoomableImage
                        src={previewUrl}
                        alt={item.altText || title}
                        className="h-full w-full"
                        mode={mode}
                        zoomStart={zoomStart}
                        interactive={interactive}
                    />
                </div>
            );
        }

        // Tile / thumb / detail: lazy-load by default and emit intrinsic width/height
        // so the browser reserves layout space (CLS=0) even before the image decodes.
        const imgClassName = `h-full w-full ${objectFitClassName}`;
        const intrinsicWidth = typeof item.width === 'number' && item.width > 0 ? item.width : undefined;
        const intrinsicHeight = typeof item.height === 'number' && item.height > 0 ? item.height : undefined;
        return (
            <div className={shellClassName} style={shellStyle}>
                <img
                    src={previewUrl}
                    alt={item.altText || title}
                    className={imgClassName}
                    width={intrinsicWidth}
                    height={intrinsicHeight}
                    loading="lazy"
                    decoding="async"
                />
            </div>
        );
    }

    if (mediaKind === 'video' && previewUrl) {
        return (
            <div className={shellClassName} style={shellStyle}>
                {/* keyed by source, so moving to another video forgets an earlier failure */}
                <VideoPreview
                    key={previewUrl}
                    src={previewUrl}
                    poster={item.thumbnailUrl ?? undefined}
                    title={title}
                    className={objectFitClassName}
                    style={shellStyle}
                    controls={controls || mode === 'detail' || mode === 'lightbox'}
                    muted={muted}
                    preload={preload}
                    compact={mode === 'thumb'}
                />
            </div>
        );
    }

    if (mediaKind === 'audio' && previewUrl && mode !== 'thumb') {
        return (
            <div className={`${shellClassName} flex min-h-[12rem] items-center justify-center p-6`}>
                <div className="w-full space-y-4">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
                        <IconFileMusic className="h-7 w-7" />
                    </div>
                    <audio src={previewUrl} controls className="w-full" preload="metadata" />
                </div>
            </div>
        );
    }

    if (
        isDocumentMedia({
            mediaKind,
            mimeType: item.mimeType || '',
            originalName: item.originalName || '',
        })
    ) {
        const isPdf = (item.mimeType || '').toLowerCase() === 'application/pdf';
        // An inactive carousel neighbour shows the placeholder below: an embedded PDF is a full
        // document fetch, and an iframe would sit in the tab order of a slide the user cannot see.
        if (isPdf && previewUrl && mode !== 'thumb' && interactive) {
            return (
                <div className={shellClassName} style={shellStyle}>
                    <iframe
                        src={previewUrl}
                        title={title}
                        className="h-full min-h-[28rem] w-full border-0"
                        loading="lazy"
                        sandbox="allow-same-origin"
                    />
                </div>
            );
        }
    }

    const PlaceholderIcon = getPlaceholderIcon(mediaKind);

    return (
        <div className={`${shellClassName} flex min-h-[10rem] items-center justify-center p-4`} style={shellStyle}>
            <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
                    <PlaceholderIcon className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                    <p className="max-w-[18rem] truncate text-sm font-medium text-foreground">{title}</p>
                    <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        {mediaKind}
                    </p>
                </div>
            </div>
        </div>
    );
}
