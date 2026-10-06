import {
    IconArrowBarToDown,
    IconChevronLeft,
    IconChevronRight,
    IconMaximize,
    IconMinimize,
    IconX,
} from '@tabler/icons-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { LightboxDialog } from './LightboxDialog';
import type { MediaLightboxProps } from './MediaLightbox';
import { MediaPreview } from './MediaPreview';
import { prefersReducedMotion } from './motion';

/** Horizontal travel (px) before a press becomes a gallery drag. Below it, the press stays a click/tap. */
const DRAG_START_SLOP = 8;
const DRAG_COMMIT_DISTANCE = 90;
const DRAG_FLING_DISTANCE = 36;
/** Release velocity (px/ms) over the last ~{@link VELOCITY_WINDOW_MS} that commits a short fling. */
const DRAG_FLING_VELOCITY = 0.45;
const VELOCITY_WINDOW_MS = 80;
const EDGE_DRAG_RESISTANCE = 0.24;
const NAVIGATION_SLIDE_DURATION = 220;
/**
 * Height (px) above a video's bottom edge reserved for its native controls. A press there scrubs
 * or adjusts volume and must never become a gallery drag.
 * ponytail: browsers don't expose their control-bar height; 64px covers Chrome, Safari and Firefox.
 */
const VIDEO_CONTROLS_GUARD = 64;
const SLIDE_POSITIONS = ['-100%', '0%', '100%'] as const;
const SLOT_IDS = ['a', 'b', 'c'] as const;

type SlotId = (typeof SLOT_IDS)[number];

interface DragState {
    pointerId: number;
    startX: number;
    startY: number;
    /** Set once horizontal intent passes the slop; the gallery then owns the pointer. */
    dragging: boolean;
    lastX: number;
    lastT: number;
    /** An older sample, ~VELOCITY_WINDOW_MS behind `last*`, for release velocity. */
    sampleX: number;
    sampleT: number;
}

function getAdjacentIndex(index: number, total: number, direction: 'previous' | 'next', loop: boolean): number | null {
    if (total <= 1) return null;

    const candidate = direction === 'next' ? index + 1 : index - 1;
    if (loop) {
        return (candidate + total) % total;
    }
    return candidate >= 0 && candidate < total ? candidate : null;
}

/** The DOM slot sitting at a physical position (0 = previous, 1 = active, 2 = next) for a rotation. */
function slotAt(position: number, rotation: number): SlotId {
    return SLOT_IDS[(position + rotation) % SLOT_IDS.length]!;
}

/** Item index shown at a physical position, derived from the visual active index every render. */
function itemIndexAt(position: number, visualIndex: number, total: number, loop: boolean): number | null {
    if (position === 1) return total > 0 ? visualIndex : null;
    return getAdjacentIndex(visualIndex, total, position === 0 ? 'previous' : 'next', loop);
}

/** True when the press lands on a video's native control bar (scrubber, volume, fullscreen). */
function isOnVideoControls(target: EventTarget | null, clientY: number): boolean {
    const video = target instanceof Element ? target.closest('video') : null;
    if (!video) return false;
    return clientY >= video.getBoundingClientRect().bottom - VIDEO_CONTROLS_GUARD;
}

/**
 * Immersive lightbox for end-user / public-facing content.
 * Designed to feel like a native gallery: minimal chrome, cinematic backdrop,
 * auto-hiding controls, and smooth caption overlays.
 *
 * SLIDE MODEL. Three DOM slots sit at three physical positions (previous / active / next).
 * Only two things are stored: the `rotation` mapping slots to positions, and the
 * `visualIndex` the active position shows. Every slot's item is DERIVED from those each
 * render, so a change of `items`, `loop` or `activeIndex` can never leave a stale neighbour.
 *
 *  • Buttons, keyboard, thumbnails, URL changes: `visualIndex` follows `activeIndex` IN PLACE.
 *    No slot moves, so nothing animates, content swaps where it stands.
 *  • A committed drag: the slides finish travelling, then `rotation` turns by one so the slot
 *    that was dragged into view BECOMES the active one (its DOM node, image and decode are
 *    kept) and the offset returns to zero in the SAME commit, with transitions suppressed
 *    until the browser has applied it (see `snap`).
 */
export function MediaImmersiveLightbox({
    items,
    activeIndex,
    isOpen,
    loop = false,
    canGoPrevious = true,
    canGoNext = true,
    zoomStart = 'single',
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
    const dialogRef = useRef<HTMLDialogElement>(null);
    const thumbnailStripRef = useRef<HTMLDivElement>(null);
    const mediaContainerRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    const dragRef = useRef<DragState | null>(null);
    /** Every pointer currently down on the media area, a second one means pinch, not swipe. */
    const pointersRef = useRef(new Set<number>());
    const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** The index a committed drag has already shown, until the parent's `activeIndex` catches up. */
    const pendingIndexRef = useRef<number | null>(null);

    const [phase, setPhase] = useState<'idle' | 'dragging' | 'settling'>('idle');
    const [rotation, setRotation] = useState(0);
    const [visualIndex, setVisualIndex] = useState(activeIndex);
    /** Non-zero while a commit must apply WITHOUT transitions; cleared a frame after it lands. */
    const [snap, setSnap] = useState(0);
    const isSettling = phase === 'settling';
    /** Buttons, keys and thumbnails wait while a drag is in progress or settling. */
    const isBusy = phase !== 'idle';

    // Read once per open: reduced motion makes slides, springs and the counter pulse instant
    // (the drag itself still follows the pointer, that's direct manipulation, not animation).
    const reducedMotion = useMemo(() => isOpen && prefersReducedMotion(), [isOpen]);
    const slideDuration = reducedMotion ? 0 : NAVIGATION_SLIDE_DURATION;

    const setDragOffset = useCallback((px: number) => {
        mediaContainerRef.current?.style.setProperty('--media-drag-offset', `${px}px`);
    }, []);

    /**
     * Apply an instant change. The commit carrying it renders with `transition: none`; this
     * effect then zeroes the drag offset in that SAME commit, forces a style flush so the browser
     * records the no-transition state, and only re-enables transitions on the next frame. Without
     * the flush, re-enabling could land in the same style recalculation and animate the jump.
     */
    useLayoutEffect(() => {
        if (snap === 0) return undefined;
        setDragOffset(0);
        void viewportRef.current?.getBoundingClientRect();
        const frame = requestAnimationFrame(() => setSnap(0));
        return () => cancelAnimationFrame(frame);
    }, [setDragOffset, snap]);

    const stopSettling = useCallback(() => {
        if (settleTimerRef.current) {
            clearTimeout(settleTimerRef.current);
            settleTimerRef.current = null;
        }
    }, []);

    /** Abandon any drag or settle and put the slides back where they belong, instantly. */
    const cancelDragNavigation = useCallback(() => {
        stopSettling();
        dragRef.current = null;
        pendingIndexRef.current = null;
        setPhase('idle');
        setSnap((n) => n + 1);
    }, [stopSettling]);

    // Follow the parent IN PLACE. A drag that already showed this index is a no-op; anything
    // else (buttons, keyboard, thumbnails, the URL, a parent that refused the drag) wins and
    // cancels a settle in flight.
    useEffect(() => {
        if (pendingIndexRef.current === activeIndex) {
            pendingIndexRef.current = null;
            return;
        }
        pendingIndexRef.current = null;
        if (settleTimerRef.current || dragRef.current) cancelDragNavigation();
        setVisualIndex(activeIndex);
    }, [activeIndex, cancelDragNavigation]);

    const handleClose = useCallback(() => {
        cancelDragNavigation();
        onClose();
    }, [cancelDragNavigation, onClose]);

    // Pause any <video> in the media container when navigating or closing to prevent
    // audio bleed between items / after the lightbox has closed.
    useEffect(() => {
        if (!mediaContainerRef.current) return;
        mediaContainerRef.current.querySelectorAll('video').forEach((video) => {
            try {
                video.pause();
            } catch {
                // ignore: browser may block for detached elements
            }
        });
    }, [visualIndex, isOpen]);

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
            dialogRef.current?.requestFullscreen().catch(() => {});
        }
    }, []);

    // Counter pulse animation when activeIndex changes
    useEffect(() => {
        if (!isOpen) return;
        setCounterPulse(true);
        const timer = setTimeout(() => setCounterPulse(false), 300);
        return () => clearTimeout(timer);
    }, [activeIndex, isOpen]);

    useEffect(() => stopSettling, [stopSettling]);

    useEffect(() => {
        if (!isOpen) {
            pointersRef.current.clear();
            cancelDragNavigation();
        }
    }, [cancelDragNavigation, isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        resetHideTimer();
        return () => {
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        };
    }, [isOpen, resetHideTimer]);

    /** Spring an uncommitted drag back to rest (animated, unlike {@link cancelDragNavigation}). */
    const springBack = useCallback(
        (target?: HTMLElement, pointerId?: number) => {
            if (target && pointerId !== undefined && target.hasPointerCapture?.(pointerId)) {
                target.releasePointerCapture(pointerId);
            }
            dragRef.current = null;
            setPhase('idle');
            setDragOffset(0);
        },
        [setDragOffset],
    );

    // Pointer Events make the gallery draggable with both mouse and touch. ZoomableImage stops
    // propagation while zoomed, so its pan gesture keeps priority; a second pointer (pinch)
    // aborts the swipe here, and presses on a video's control bar never start one.
    const handleMediaPointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            pointersRef.current.add(event.pointerId);
            if (pointersRef.current.size > 1) {
                if (dragRef.current) springBack(event.currentTarget, dragRef.current.pointerId);
                return;
            }
            if (
                items.length < 2 ||
                isSettling ||
                (event.pointerType === 'mouse' && event.button !== 0) ||
                isOnVideoControls(event.target, event.clientY)
            ) {
                return;
            }

            const now = performance.now();
            dragRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                dragging: false,
                lastX: event.clientX,
                lastT: now,
                sampleX: event.clientX,
                sampleT: now,
            };
            resetHideTimer();
        },
        [isSettling, items.length, resetHideTimer, springBack],
    );

    const handleMediaPointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            const drag = dragRef.current;
            if (!drag || event.pointerId !== drag.pointerId) return;
            // A mouse released outside the window before the drag took capture never sends
            // pointerup here; a later hover must not resume it.
            if (event.pointerType === 'mouse' && (event.buttons & 1) === 0) {
                springBack(event.currentTarget, drag.pointerId);
                return;
            }

            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            if (!drag.dragging) {
                // Intent is decided ONCE. Vertical first → never a swipe; horizontal past the slop
                // → a swipe for the rest of the gesture, however diagonal it later gets.
                if (Math.abs(dy) > DRAG_START_SLOP && Math.abs(dy) >= Math.abs(dx)) {
                    dragRef.current = null;
                    return;
                }
                if (Math.abs(dx) <= DRAG_START_SLOP || Math.abs(dx) <= Math.abs(dy)) return;
                drag.dragging = true;
                // Capture only now: capturing on pointer-down would retarget ordinary clicks to
                // this container and stop ZoomableImage toggling zoom.
                event.currentTarget.setPointerCapture?.(event.pointerId);
                setPhase('dragging');
            }

            event.preventDefault();
            const now = performance.now();
            if (now - drag.sampleT > VELOCITY_WINDOW_MS) {
                drag.sampleX = drag.lastX;
                drag.sampleT = drag.lastT;
            }
            drag.lastX = event.clientX;
            drag.lastT = now;

            const canMove = dx > 0 ? canGoPrevious : canGoNext;
            setDragOffset(canMove ? dx : dx * EDGE_DRAG_RESISTANCE);
        },
        [canGoNext, canGoPrevious, setDragOffset, springBack],
    );

    const handleMediaPointerEnd = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            pointersRef.current.delete(event.pointerId);
            const drag = dragRef.current;
            if (!drag || event.pointerId !== drag.pointerId) return;
            dragRef.current = null;
            if (!drag.dragging) return;

            const dx = event.clientX - drag.startX;
            const now = performance.now();
            const elapsed = Math.max(now - drag.sampleT, 1);
            const velocity = (event.clientX - drag.sampleX) / elapsed;
            // The SLIDE's width: slides sit at ±100% of the viewport, not of the padded container.
            const slideWidth = viewportRef.current?.clientWidth || window.innerWidth;
            const commitDistance = Math.min(DRAG_COMMIT_DISTANCE, slideWidth * 0.2);
            const flung = Math.abs(dx) >= DRAG_FLING_DISTANCE && Math.abs(velocity) >= DRAG_FLING_VELOCITY;
            const shouldNavigate =
                event.type !== 'pointercancel' &&
                (Math.abs(dx) >= commitDistance || (flung && Math.sign(velocity) === Math.sign(dx)));

            const direction = dx < 0 ? 'next' : 'previous';
            const allowed = direction === 'next' ? canGoNext : canGoPrevious;
            const target = getAdjacentIndex(visualIndex, items.length, direction, loop);
            if (!shouldNavigate || !allowed || target === null) {
                setPhase('idle');
                setDragOffset(0);
                return;
            }

            // Finish the visible slide into the neighbour before changing anything, so the gesture
            // stays connected to its result.
            setPhase('settling');
            setDragOffset(direction === 'next' ? -slideWidth : slideWidth);
            settleTimerRef.current = setTimeout(() => {
                settleTimerRef.current = null;
                pendingIndexRef.current = target;
                // One commit: rotate so the incoming slot is active, show the target, and snap
                // the offset to zero (the snap effect does that inside this same commit).
                setRotation((r) => (r + (direction === 'next' ? 1 : SLOT_IDS.length - 1)) % SLOT_IDS.length);
                setVisualIndex(target);
                setSnap((n) => n + 1);
                setPhase('idle');
                if (direction === 'next') onNext();
                else onPrevious();
            }, slideDuration);
        },
        [canGoNext, canGoPrevious, items.length, loop, onNext, onPrevious, setDragOffset, slideDuration, visualIndex],
    );

    // Scroll active thumbnail into view
    useEffect(() => {
        if (!isOpen || !thumbnailStripRef.current) {
            return;
        }
        const activeThumb = thumbnailStripRef.current.children[activeIndex] as HTMLElement | undefined;
        if (typeof activeThumb?.scrollIntoView === 'function') {
            activeThumb.scrollIntoView({
                behavior: reducedMotion ? 'auto' : 'smooth',
                block: 'nearest',
                inline: 'center',
            });
        }
    }, [activeIndex, isOpen, reducedMotion]);

    const counterStyle = useMemo(
        () => ({
            transform: counterPulse && !reducedMotion ? 'scale(1.15)' : 'scale(1)',
            transition: reducedMotion ? 'none' : 'transform 0.2s ease',
        }),
        [counterPulse, reducedMotion],
    );

    if (!isOpen || typeof document === 'undefined' || !currentItem) {
        return null;
    }

    // Hidden controls come back while a keyboard user has one of them focused
    const controlsClass = controlsVisible
        ? 'opacity-100'
        : 'pointer-events-none opacity-0 group-has-[:focus-visible]:pointer-events-auto group-has-[:focus-visible]:opacity-100';
    const caption = currentItem.caption || currentItem.title;
    const hasMultiple = items.length > 1;
    // Reserve bottom space: thumbnails ~80px, or minimal padding
    const bottomInset = hasMultiple ? 80 : 12;
    const slideTransition =
        reducedMotion || phase === 'dragging' || snap !== 0
            ? 'none'
            : isSettling
              ? `transform ${NAVIGATION_SLIDE_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`
              : // Spring-back after a drag released short of the threshold.
                'transform 360ms cubic-bezier(0.22, 1.25, 0.36, 1)';
    const mediaSlides = SLIDE_POSITIONS.flatMap((position, positionIndex) => {
        const itemIndex = itemIndexAt(positionIndex, visualIndex, items.length, loop);
        const item = itemIndex === null ? null : items[itemIndex];
        if (!item) return [];
        return [
            {
                item,
                slotId: slotAt(positionIndex, rotation),
                position,
                active: positionIndex === 1,
                name: positionIndex === 0 ? 'previous' : positionIndex === 1 ? 'active' : 'next',
            },
        ];
    });

    return (
        <LightboxDialog
            ref={dialogRef}
            label="Gallery"
            className="group overflow-hidden bg-black text-white"
            onClose={handleClose}
            onPrevious={canGoPrevious && !isBusy ? onPrevious : undefined}
            onNext={canGoNext && !isBusy ? onNext : undefined}
            onKeyDown={resetHideTimer}
            onPointerMove={resetHideTimer}
            onClick={resetHideTimer}
        >
            {/* ── Top bar ────────────────────────────────────────────── */}
            <div
                className={`pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pt-4 pb-10 transition-opacity duration-normal md:px-6 ${controlsClass}`}
            >
                {hasMultiple && (
                    <span
                        className="pointer-events-auto select-none rounded-full bg-white/15 px-3 py-1 text-[0.6875rem] font-medium uppercase tabular-nums tracking-wide text-white backdrop-blur-md"
                        style={counterStyle}
                        aria-live="polite"
                    >
                        {activeIndex + 1} / {items.length}
                    </span>
                )}
                {!hasMultiple && <span />}
                <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/10 p-1 backdrop-blur-md">
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleFullscreen();
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors duration-normal hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                    >
                        {isFullscreen ? <IconMinimize className="h-5 w-5" /> : <IconMaximize className="h-5 w-5" />}
                    </button>
                    <a
                        href={currentItem.url}
                        download={currentItem.originalName ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors duration-normal hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        aria-label="Download"
                    >
                        <IconArrowBarToDown className="h-5 w-5" />
                    </a>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClose();
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors duration-normal hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        aria-label="Close"
                    >
                        <IconX className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Navigation arrows */}
            {hasMultiple && (
                <>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isBusy) return;
                            onPrevious();
                        }}
                        disabled={!canGoPrevious || isBusy}
                        className={`absolute left-2 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-all duration-normal hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-default disabled:opacity-0 md:left-5 md:h-12 md:w-12 ${controlsClass}`}
                        aria-label="Previous"
                    >
                        <IconChevronLeft className="h-5 w-5 md:h-6 md:w-6" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (isBusy) return;
                            onNext();
                        }}
                        disabled={!canGoNext || isBusy}
                        className={`absolute right-2 top-1/2 z-20 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-all duration-normal hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-default disabled:opacity-0 md:right-5 md:h-12 md:w-12 ${controlsClass}`}
                        aria-label="Next"
                    >
                        <IconChevronRight className="h-5 w-5 md:h-6 md:w-6" />
                    </button>
                </>
            )}

            {/* Media content, placed between the top bar and the thumbnails */}
            <div
                ref={mediaContainerRef}
                className="absolute inset-x-0 z-10 flex items-center justify-center px-14 md:px-20"
                style={{ top: 56, bottom: bottomInset }}
                onPointerDown={handleMediaPointerDown}
                onPointerMove={handleMediaPointerMove}
                onPointerUp={handleMediaPointerEnd}
                onPointerCancel={handleMediaPointerEnd}
            >
                <div
                    ref={viewportRef}
                    className="relative h-full w-full overflow-hidden"
                    data-medialightbox-viewport
                    style={{ touchAction: 'pan-y' }}
                >
                    {mediaSlides.map(({ item, slotId, position, active, name }) => (
                        <div
                            key={slotId}
                            className={`absolute inset-0 ${active ? '' : 'pointer-events-none'}`}
                            data-medialightbox-slide={name}
                            // Off-screen neighbours stay mounted (and decoded) for a seamless swipe,
                            // but are out of the tab order and the accessibility tree.
                            inert={!active}
                            style={{
                                transform: `translate3d(calc(${position} + var(--media-drag-offset, 0px)), 0, 0)`,
                                transition: slideTransition,
                                willChange: phase === 'idle' ? 'auto' : 'transform',
                                contain: 'layout paint',
                            }}
                        >
                            <MediaPreview
                                item={item}
                                mode="immersive"
                                fit="contain"
                                controls={active}
                                interactive={active}
                                preload={active ? 'metadata' : 'none'}
                                zoomStart={zoomStart}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Caption overlay: quiet backdrop panel, tokenized text ──── */}
            {caption && (
                <div
                    className={`pointer-events-none absolute inset-x-0 z-20 flex justify-center px-6 transition-opacity duration-normal md:px-10 ${controlsClass}`}
                    style={{ bottom: hasMultiple ? 100 : 12 }}
                >
                    <p className="max-w-3xl rounded-full bg-black/40 px-4 py-1.5 text-center text-sm leading-relaxed text-white backdrop-blur-md">
                        {caption}
                    </p>
                </div>
            )}

            {/* ── Thumbnail strip ────────────────────────────────────── */}
            {hasMultiple && (
                <div
                    className={`absolute inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 pt-2 transition-opacity duration-normal md:px-6 md:pb-5 ${controlsClass}`}
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
                                        if (isBusy) return;
                                        onSelectIndex(index);
                                    }}
                                    disabled={isBusy}
                                    className={`h-12 w-12 shrink-0 overflow-hidden bg-white/10 transition-all duration-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:h-14 md:w-14 ${
                                        isActive
                                            ? 'ring-2 ring-white'
                                            : 'opacity-50 ring-1 ring-white/30 hover:opacity-80'
                                    }`}
                                    style={{ borderRadius: 'var(--lb-thumb-radius, 0.5rem)' }}
                                    aria-label={`View item ${index + 1}`}
                                    aria-current={isActive ? 'true' : undefined}
                                >
                                    <MediaPreview item={item} mode="thumb" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </LightboxDialog>
    );
}
