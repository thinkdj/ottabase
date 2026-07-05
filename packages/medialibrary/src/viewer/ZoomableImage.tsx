import { useCallback, useEffect, useRef, useState } from 'react';

export interface ZoomableImageProps {
    src: string;
    alt: string;
    className?: string;
    /** The lightbox mode (immersive gets different styling) */
    mode?: 'lightbox' | 'immersive';
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;
const DOUBLE_CLICK_ZOOM = 2;
const DOUBLE_TAP_MS = 300;

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Image wrapper with zoom and pan support:
 * - Desktop: scroll-wheel zoom, double-click toggle, click-and-drag pan.
 * - Touch: pinch to zoom, double-tap toggle, drag to pan when zoomed in.
 *
 * Used inside lightbox / immersive viewers for image media only.
 */
export function ZoomableImage({ src, alt, className, mode = 'lightbox' }: ZoomableImageProps) {
    const [zoom, setZoom] = useState(MIN_ZOOM);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Active pointers (unifies mouse + touch via Pointer Events)
    const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    // Pinch state — captured when a second pointer goes down
    const pinchRef = useRef<{ startDistance: number; startZoom: number } | null>(null);
    // Last tap timestamp for double-tap detection on touch
    const lastTapRef = useRef<number>(0);

    // Reset zoom / pan / gesture state when the image source changes
    useEffect(() => {
        setZoom(MIN_ZOOM);
        setPan({ x: 0, y: 0 });
        pointersRef.current.clear();
        pinchRef.current = null;
    }, [src]);

    const toggleZoom = useCallback(() => {
        setZoom((prev) => {
            if (prev > MIN_ZOOM) {
                setPan({ x: 0, y: 0 });
                return MIN_ZOOM;
            }
            return DOUBLE_CLICK_ZOOM;
        });
    }, []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
        setZoom((prev) => {
            const next = clampZoom(prev + delta);
            if (next <= MIN_ZOOM) {
                setPan({ x: 0, y: 0 });
            }
            return next;
        });
    }, []);

    const handleDoubleClick = useCallback(
        (e: React.MouseEvent) => {
            // Mouse-only — touch double-tap is handled in handlePointerDown.
            const pointerType = (e.nativeEvent as PointerEvent).pointerType;
            if (pointerType && pointerType !== 'mouse') return;
            e.preventDefault();
            e.stopPropagation();
            toggleZoom();
        },
        [toggleZoom],
    );

    const handlePointerDown = useCallback(
        (e: React.PointerEvent) => {
            pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            e.currentTarget.setPointerCapture?.(e.pointerId);

            // Two pointers → start pinch
            if (pointersRef.current.size === 2) {
                const [a, b] = Array.from(pointersRef.current.values());
                pinchRef.current = { startDistance: getDistance(a, b), startZoom: zoom };
                setIsDragging(false);
                return;
            }

            if (pointersRef.current.size !== 1) return;

            // Touch double-tap detection
            if (e.pointerType === 'touch') {
                const now = Date.now();
                if (now - lastTapRef.current < DOUBLE_TAP_MS) {
                    lastTapRef.current = 0;
                    e.preventDefault();
                    toggleZoom();
                    return;
                }
                lastTapRef.current = now;
            }

            // Begin drag only when zoomed in (so horizontal swipes still navigate at 1x)
            if (zoom > MIN_ZOOM) {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
                dragOrigin.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
            }
        },
        [pan, toggleZoom, zoom],
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!pointersRef.current.has(e.pointerId)) return;
            pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

            // Pinch zoom
            if (pointersRef.current.size === 2 && pinchRef.current) {
                e.preventDefault();
                const [a, b] = Array.from(pointersRef.current.values());
                const currentDistance = getDistance(a, b);
                const scale = currentDistance / pinchRef.current.startDistance;
                setZoom((prev) => {
                    const next = clampZoom(pinchRef.current!.startZoom * scale);
                    if (next <= MIN_ZOOM) {
                        setPan({ x: 0, y: 0 });
                    }
                    // avoid thrash when the change is minute
                    return Math.abs(next - prev) < 0.01 ? prev : next;
                });
                return;
            }

            // Drag pan
            if (isDragging) {
                e.preventDefault();
                const dx = e.clientX - dragOrigin.current.x;
                const dy = e.clientY - dragOrigin.current.y;
                setPan({
                    x: dragOrigin.current.panX + dx / zoom,
                    y: dragOrigin.current.panY + dy / zoom,
                });
            }
        },
        [isDragging, zoom],
    );

    const handlePointerEnd = useCallback((e: React.PointerEvent) => {
        pointersRef.current.delete(e.pointerId);
        if (pointersRef.current.size < 2) {
            pinchRef.current = null;
        }
        if (pointersRef.current.size === 0) {
            setIsDragging(false);
        }
    }, []);

    const isZoomed = zoom > MIN_ZOOM;
    const cursor = isDragging ? 'cursor-grabbing' : isZoomed ? 'cursor-grab' : 'cursor-zoom-in';

    const imgClassName =
        mode === 'immersive'
            ? 'max-h-full max-w-full object-contain select-none'
            : 'h-full w-full object-contain select-none';

    return (
        <div
            ref={containerRef}
            className={`relative overflow-hidden ${className ?? ''}`}
            onWheel={handleWheel}
            onDoubleClick={handleDoubleClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onPointerLeave={handlePointerEnd}
            // Disable native browser pinch / pan so our handlers own the gesture on touch
            style={{ touchAction: 'none' }}
        >
            <div
                className={`flex h-full w-full items-center justify-center ${cursor}`}
                style={{
                    transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                    transition: isDragging || pinchRef.current ? 'none' : 'transform 0.2s ease',
                    transformOrigin: 'center center',
                }}
            >
                <img src={src} alt={alt} className={imgClassName} loading="eager" draggable={false} />
            </div>

            {/* Zoom level indicator */}
            {isZoomed && (
                <span className="pointer-events-none absolute bottom-2 right-2 select-none rounded-full bg-background/70 px-2 py-0.5 text-[0.6875rem] font-medium tabular-nums text-muted-foreground ring-1 ring-border backdrop-blur-md">
                    {zoom.toFixed(1)}x
                </span>
            )}
        </div>
    );
}
