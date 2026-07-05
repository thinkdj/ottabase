import {
    IconArrowBarToDown,
    IconChevronLeft,
    IconChevronRight,
    IconExternalLink,
    IconMaximize,
    IconMinimize,
    IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MediaViewerItem } from '../types';
import { formatMediaFileSize, getMediaDisplayTitle } from '../utils';
import { MediaPreview } from './MediaPreview';

export interface MediaLightboxProps {
    items: MediaViewerItem[];
    activeIndex: number;
    isOpen: boolean;
    showMetadata?: boolean;
    canGoPrevious?: boolean;
    canGoNext?: boolean;
    zIndex?: number;
    onClose: () => void;
    onPrevious: () => void;
    onNext: () => void;
    onSelectIndex: (index: number) => void;
}

function formatDimensions(item: MediaViewerItem | null): string | null {
    if (!item?.width || !item?.height) {
        return null;
    }

    return `${item.width} x ${item.height}`;
}

export function MediaLightbox({
    items,
    activeIndex,
    isOpen,
    showMetadata = true,
    canGoPrevious = true,
    canGoNext = true,
    zIndex = 100,
    onClose,
    onPrevious,
    onNext,
    onSelectIndex,
}: MediaLightboxProps) {
    const currentItem = items[activeIndex] ?? null;
    const [isFullscreen, setIsFullscreen] = useState(false);
    const mediaContainerRef = useRef<HTMLDivElement>(null);

    // Pause any <video> inside the media container when navigating or closing.
    useEffect(() => {
        if (!mediaContainerRef.current) return;
        mediaContainerRef.current.querySelectorAll('video').forEach((video) => {
            try {
                video.pause();
            } catch {
                // ignore — browser may block for detached elements
            }
        });
    }, [activeIndex, isOpen]);

    // Fullscreen state sync
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        } else {
            document.documentElement.requestFullscreen().catch(() => {});
        }
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
                return;
            }

            if (event.key === 'ArrowLeft' && canGoPrevious) {
                onPrevious();
                return;
            }

            if (event.key === 'ArrowRight' && canGoNext) {
                onNext();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [canGoNext, canGoPrevious, isOpen, onClose, onNext, onPrevious]);

    if (!isOpen || typeof document === 'undefined' || !currentItem) {
        return null;
    }

    const title = getMediaDisplayTitle({
        title: currentItem.title ?? null,
        originalName: currentItem.originalName ?? '',
        storageKey: currentItem.url,
    });
    const dimensions = formatDimensions(currentItem);

    return createPortal(
        <div className="pointer-events-auto fixed inset-0" style={{ zIndex }} data-medialightbox>
            <button
                type="button"
                className="absolute inset-0 bg-background/90 backdrop-blur-md"
                onClick={onClose}
                aria-label="Close media viewer"
            />

            <div className="relative flex h-full flex-col text-foreground">
                <div className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-3 md:px-6">
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
                        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            {activeIndex + 1} of {items.length}
                        </p>
                    </div>

                    <div className="flex items-center gap-1">
                        <a
                            href={currentItem.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-normal hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="Open media in new tab"
                        >
                            <IconExternalLink className="h-5 w-5" />
                        </a>
                        <a
                            href={currentItem.url}
                            download={currentItem.originalName ?? undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-normal hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="Download media"
                        >
                            <IconArrowBarToDown className="h-5 w-5" />
                        </a>
                        <button
                            type="button"
                            onClick={toggleFullscreen}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-normal hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                        >
                            {isFullscreen ? <IconMinimize className="h-5 w-5" /> : <IconMaximize className="h-5 w-5" />}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-normal hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            aria-label="Close media viewer"
                        >
                            <IconX className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                <div className="relative grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_22rem] md:px-6">
                    <div
                        ref={mediaContainerRef}
                        className="relative flex min-h-0 items-center justify-center overflow-hidden rounded-xl bg-muted/40 p-4 md:p-6"
                    >
                        {items.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={onPrevious}
                                    disabled={!canGoPrevious}
                                    className="absolute left-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border transition-colors duration-normal hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label="Previous media item"
                                >
                                    <IconChevronLeft className="h-6 w-6" />
                                </button>
                                <button
                                    type="button"
                                    onClick={onNext}
                                    disabled={!canGoNext}
                                    className="absolute right-3 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border transition-colors duration-normal hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label="Next media item"
                                >
                                    <IconChevronRight className="h-6 w-6" />
                                </button>
                            </>
                        )}

                        <div className="h-full w-full max-w-6xl">
                            <MediaPreview item={currentItem} mode="lightbox" fit="contain" controls />
                        </div>
                    </div>

                    {showMetadata && (
                        <aside className="rounded-xl bg-muted/40 p-5">
                            <div className="space-y-5">
                                <div>
                                    <h3 className="text-[0.9375rem] font-semibold text-foreground">{title}</h3>
                                    {currentItem.caption && (
                                        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                            {currentItem.caption}
                                        </p>
                                    )}
                                </div>

                                <div className="grid gap-3 text-sm">
                                    <div className="rounded-lg bg-background px-3 py-2 ring-1 ring-border">
                                        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                            Type
                                        </p>
                                        <p className="mt-1 text-foreground">{currentItem.mediaKind ?? 'media'}</p>
                                    </div>

                                    <div className="rounded-lg bg-background px-3 py-2 ring-1 ring-border">
                                        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                            File Size
                                        </p>
                                        <p className="mt-1 text-foreground">
                                            {formatMediaFileSize(currentItem.fileSize)}
                                        </p>
                                    </div>

                                    {dimensions && (
                                        <div className="rounded-lg bg-background px-3 py-2 ring-1 ring-border">
                                            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                Dimensions
                                            </p>
                                            <p className="mt-1 text-foreground">{dimensions}</p>
                                        </div>
                                    )}

                                    {currentItem.mimeType && (
                                        <div className="rounded-lg bg-background px-3 py-2 ring-1 ring-border">
                                            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                MIME Type
                                            </p>
                                            <p className="mt-1 break-all text-foreground">{currentItem.mimeType}</p>
                                        </div>
                                    )}

                                    {currentItem.originalName && (
                                        <div className="rounded-lg bg-background px-3 py-2 ring-1 ring-border">
                                            <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                                                Original Name
                                            </p>
                                            <p className="mt-1 break-all text-foreground">{currentItem.originalName}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </aside>
                    )}
                </div>

                {items.length > 1 && (
                    <div className="border-t border-border/60 px-4 py-3 md:px-6">
                        <div className="flex gap-2 overflow-x-auto pb-1">
                            {items.map((item, index) => {
                                const itemTitle = getMediaDisplayTitle({
                                    title: item.title ?? null,
                                    originalName: item.originalName ?? '',
                                    storageKey: item.url,
                                });

                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => onSelectIndex(index)}
                                        className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted/40 transition-all duration-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                            index === activeIndex
                                                ? 'ring-2 ring-primary'
                                                : 'opacity-70 ring-1 ring-border hover:opacity-100'
                                        }`}
                                        aria-label={`View ${itemTitle}`}
                                    >
                                        <MediaPreview item={item} mode="thumb" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
}
