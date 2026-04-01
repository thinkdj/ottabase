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
              ? 'h-full w-full overflow-hidden rounded-xl border border-border bg-muted/30'
              : mode === 'immersive'
                ? 'h-full w-full flex rounded-lg items-center justify-center overflow-hidden bg-muted/5 dark:bg-muted/10' // In immersive mode, we use a subtle background to indicate the media boundaries without a hard border
                : mode === 'lightbox'
                  ? 'h-full w-full overflow-hidden rounded-2xl bg-black/20'
                  : 'h-full w-full overflow-hidden rounded-xl border border-border bg-muted/20';

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

        const imgClassName = `h-full w-full ${objectFitClassName}`;
        return (
            <div className={shellClassName}>
                <img
                    src={previewUrl}
                    alt={item.altText || title}
                    className={imgClassName}
                    loading={mode === 'thumb' ? 'lazy' : 'eager'}
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
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
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
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <PlaceholderIcon className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                    <p className="max-w-[18rem] truncate text-sm font-medium text-foreground">{title}</p>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{mediaKind}</p>
                </div>
            </div>
        </div>
    );
}
