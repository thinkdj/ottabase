import { IconArchive, IconFileDescription, IconFileMusic, IconPhoto, IconPlayerPlay } from '@tabler/icons-react';
import type { MediaViewerItem } from '../types';
import { getMediaDisplayTitle, getMediaKindFromMimeType, isDocumentMedia } from '../utils';
import { ZoomableImage } from './ZoomableImage';

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
                  'h-full w-full flex rounded-lg items-center justify-center overflow-hidden bg-muted/5'
                : mode === 'lightbox'
                  ? 'h-full w-full overflow-hidden rounded-xl bg-muted/40'
                  : 'h-full w-full overflow-hidden rounded-xl bg-muted/40';

    return [modeClassName, className].filter(Boolean).join(' ');
}

export function MediaPreview({
    item,
    className,
    mode = 'tile',
    fit = 'cover',
    controls = false,
    muted = true,
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

    if (mediaKind === 'image' && previewUrl) {
        // Use ZoomableImage in lightbox / immersive modes for zoom + pan support
        if (mode === 'lightbox' || mode === 'immersive') {
            return (
                <div className={shellClassName}>
                    <ZoomableImage src={previewUrl} alt={item.altText || title} className="h-full w-full" mode={mode} />
                </div>
            );
        }

        // Tile / thumb / detail: lazy-load by default and emit intrinsic width/height
        // so the browser reserves layout space (CLS=0) even before the image decodes.
        const imgClassName = `h-full w-full ${objectFitClassName}`;
        const intrinsicWidth = typeof item.width === 'number' && item.width > 0 ? item.width : undefined;
        const intrinsicHeight = typeof item.height === 'number' && item.height > 0 ? item.height : undefined;
        return (
            <div className={shellClassName}>
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
            <div className={shellClassName}>
                <video
                    src={previewUrl}
                    className={`h-full w-full ${objectFitClassName}`}
                    controls={controls || mode === 'detail' || mode === 'lightbox'}
                    muted={muted}
                    playsInline
                    preload="metadata"
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
            mediaKind: mediaKind as any,
            mimeType: item.mimeType || '',
            originalName: item.originalName || '',
        })
    ) {
        const isPdf = (item.mimeType || '').toLowerCase() === 'application/pdf';
        if (isPdf && previewUrl && mode !== 'thumb') {
            return (
                <div className={shellClassName}>
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
        <div className={`${shellClassName} flex min-h-[10rem] items-center justify-center p-4`}>
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
