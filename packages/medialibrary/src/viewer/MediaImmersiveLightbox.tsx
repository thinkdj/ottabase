import {
    IconArrowBarToDown,
    IconChevronLeft,
    IconChevronRight,
    IconMaximize,
    IconMinimize,
    IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MediaLightboxProps } from './MediaLightbox';
import { MediaPreview } from './MediaPreview';

/**
 * Immersive lightbox for end-user / public-facing content.
 * Designed to feel like a native gallery — minimal chrome, cinematic backdrop,
 * auto-hiding controls, and smooth caption overlays.
 */
export function MediaImmersiveLightbox({
    items,
    activeIndex,
    isOpen,
    canGoPrevious = true,
    canGoNext = true,
    onClose,
    onPrevious,
    onNext,
    onSelectIndex,
}: MediaLightboxProps) {
    const currentItem = items[activeIndex] ?? null;
    const [controlsVisible, setControlsVisible] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [counterPulse, setCounterPulse] = useState(false);
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const thumbnailStripRef = useRef<HTMLDivElement>(null);
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    // Auto-hide controls after inactivity
    const resetHideTimer = useCallback(() => {
        setControlsVisible(true);
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
        }
        hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3000);
    }, []);

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

    // Counter pulse animation when activeIndex changes
    useEffect(() => {
        if (!isOpen) return;
        setCounterPulse(true);
        const timer = setTimeout(() => setCounterPulse(false), 300);
        return () => clearTimeout(timer);
    }, [activeIndex, isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        resetHideTimer();

        const handleKeyDown = (event: KeyboardEvent) => {
            resetHideTimer();
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

        const handlePointerMove = () => resetHideTimer();

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('pointermove', handlePointerMove);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('pointermove', handlePointerMove);
            if (hideTimerRef.current) {
                clearTimeout(hideTimerRef.current);
            }
        };
    }, [canGoNext, canGoPrevious, isOpen, onClose, onNext, onPrevious, resetHideTimer]);

    // Touch gesture handlers for swipe navigation
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, []);

    const handleTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            if (!touchStartRef.current || e.changedTouches.length !== 1) return;
            const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
            const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
            touchStartRef.current = null;

            // Only trigger if horizontal swipe is dominant and exceeds threshold
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
                if (dx < 0 && canGoNext) {
                    onNext();
                } else if (dx > 0 && canGoPrevious) {
                    onPrevious();
                }
            }
        },
        [canGoNext, canGoPrevious, onNext, onPrevious],
    );

    // Scroll active thumbnail into view
    useEffect(() => {
        if (!isOpen || !thumbnailStripRef.current) {
            return;
        }
        const activeThumb = thumbnailStripRef.current.children[activeIndex] as HTMLElement | undefined;
        activeThumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [activeIndex, isOpen]);

    const counterStyle = useMemo(
        () => ({
            transform: counterPulse ? 'scale(1.15)' : 'scale(1)',
            transition: 'transform 0.2s ease',
        }),
        [counterPulse],
    );

    if (!isOpen || typeof document === 'undefined' || !currentItem) {
        return null;
    }

    const controlsClass = controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none';
    const caption = currentItem.caption || currentItem.title;
    const hasMultiple = items.length > 1;
    // Reserve bottom space: thumbnails ~80px, or minimal padding
    const bottomInset = hasMultiple ? 80 : 12;

    return createPortal(
        <div
            className="fixed inset-0 z-[100] overflow-hidden bg-black"
            onPointerMove={resetHideTimer}
            onClick={resetHideTimer}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            {/* Backdrop (click to close) */}
            <button
                type="button"
                className="absolute inset-0 h-full w-full"
                onClick={onClose}
                aria-label="Close gallery"
            />

            {/* ── Top bar ────────────────────────────────────────────── */}
            <div
                className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-4 pb-10 transition-opacity duration-300 md:px-6 ${controlsClass}`}
            >
                {hasMultiple && (
                    <span
                        className="pointer-events-auto select-none rounded-full bg-white/15 px-3 py-1 text-xs font-medium tabular-nums tracking-widest text-white"
                        style={counterStyle}
                    >
                        {activeIndex + 1} / {items.length}
                    </span>
                )}
                {!hasMultiple && <span />}
                <div className="pointer-events-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleFullscreen();
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
                        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    >
                        {isFullscreen ? <IconMinimize className="h-5 w-5" /> : <IconMaximize className="h-5 w-5" />}
                    </button>
                    <a
                        href={currentItem.url}
                        download={currentItem.originalName ?? undefined}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
                        aria-label="Download"
                    >
                        <IconArrowBarToDown className="h-5 w-5" />
                    </a>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
                        aria-label="Close gallery"
                    >
                        <IconX className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* ── Main media area — constrained between top bar and bottom controls ── */}
            <div className="relative flex h-full w-full items-center justify-center">
                {/* Navigation arrows */}
                {hasMultiple && (
                    <>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onPrevious();
                            }}
                            disabled={!canGoPrevious}
                            className={`absolute left-2 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition-all hover:bg-white/25 disabled:cursor-default disabled:opacity-0 md:left-5 md:h-12 md:w-12 ${controlsClass}`}
                            aria-label="Previous"
                        >
                            <IconChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onNext();
                            }}
                            disabled={!canGoNext}
                            className={`absolute right-2 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white transition-all hover:bg-white/25 disabled:cursor-default disabled:opacity-0 md:right-5 md:h-12 md:w-12 ${controlsClass}`}
                            aria-label="Next"
                        >
                            <IconChevronRight className="h-5 w-5 md:h-6 md:w-6" />
                        </button>
                    </>
                )}

                {/* Media content — absolutely positioned to fit between top bar and thumbnails */}
                <div
                    className="absolute inset-x-0 z-10 flex items-center justify-center px-14 md:px-20"
                    style={{ top: 56, bottom: bottomInset }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            onClose();
                        }
                    }}
                >
                    <MediaPreview item={currentItem} mode="immersive" fit="contain" controls />
                </div>
            </div>

            {/* ── Caption overlay — text-shadow only, no gradient ──── */}
            {caption && (
                <div
                    className={`pointer-events-none absolute inset-x-0 z-20 px-6 transition-opacity duration-300 md:px-10 ${controlsClass}`}
                    style={{ bottom: hasMultiple ? 100 : 12 }}
                >
                    <p
                        className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-white md:text-base"
                        style={{ textShadow: '0 1px 6px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.6)' }}
                    >
                        {caption}
                    </p>
                </div>
            )}

            {/* ── Thumbnail strip ────────────────────────────────────── */}
            {hasMultiple && (
                <div
                    className={`absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 pt-2 transition-opacity duration-300 md:px-6 md:pb-5 ${controlsClass}`}
                >
                    <div
                        ref={thumbnailStripRef}
                        className="flex max-w-[90vw] gap-1.5 overflow-x-auto bg-black/40 p-1.5 backdrop-blur-md scrollbar-none md:gap-2 md:p-2"
                        style={{ borderRadius: 'var(--lb-strip-radius, 0.75rem)' }}
                    >
                        {items.map((item, index) => {
                            const isActive = index === activeIndex;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectIndex(index);
                                    }}
                                    className={`h-12 w-12 shrink-0 overflow-hidden transition-all duration-200 md:h-14 md:w-14 ${
                                        isActive
                                            ? 'ring-2 ring-white ring-offset-1 ring-offset-black/50'
                                            : 'opacity-50 hover:opacity-80'
                                    }`}
                                    style={{ borderRadius: 'var(--lb-thumb-radius, 0.5rem)' }}
                                    aria-label={`View image ${index + 1}`}
                                >
                                    <MediaPreview item={item} mode="thumb" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>,
        document.body,
    );
}
