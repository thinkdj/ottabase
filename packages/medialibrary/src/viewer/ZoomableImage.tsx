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

const clampZoom = (value: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));

/**
 * Image wrapper with scroll-zoom, pan-on-drag, and double-click zoom.
 * Used inside lightbox / immersive viewers for image media only.
 */
export function ZoomableImage({ src, alt, className, mode = 'lightbox' }: ZoomableImageProps) {
    const [zoom, setZoom] = useState(MIN_ZOOM);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOrigin = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset zoom and pan when the image source changes
    useEffect(() => {
        setZoom(MIN_ZOOM);
        setPan({ x: 0, y: 0 });
    }, [src]);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
        setZoom((prev) => {
            const next = clampZoom(prev + delta);
            // Reset pan when zooming back to 1x
            if (next <= MIN_ZOOM) {
                setPan({ x: 0, y: 0 });
            }
            return next;
        });
    }, []);

    const handleDoubleClick = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (zoom > MIN_ZOOM) {
                setZoom(MIN_ZOOM);
                setPan({ x: 0, y: 0 });
            } else {
                setZoom(DOUBLE_CLICK_ZOOM);
            }
        },
        [zoom],
    );

    const handleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (zoom <= MIN_ZOOM) return;
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(true);
            dragOrigin.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        },
        [zoom, pan],
    );

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (!isDragging) return;
            e.preventDefault();
            const dx = e.clientX - dragOrigin.current.x;
            const dy = e.clientY - dragOrigin.current.y;
            setPan({
                x: dragOrigin.current.panX + dx / zoom,
                y: dragOrigin.current.panY + dy / zoom,
            });
        },
        [isDragging, zoom],
    );

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // End drag if mouse leaves the container
    const handleMouseLeave = useCallback(() => {
        if (isDragging) setIsDragging(false);
    }, [isDragging]);

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
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
        >
            <div
                className={`flex h-full w-full items-center justify-center ${cursor}`}
                style={{
                    transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                    transition: isDragging ? 'none' : 'transform 0.2s ease',
                    transformOrigin: 'center center',
                }}
            >
                <img src={src} alt={alt} className={imgClassName} loading="eager" draggable={false} />
            </div>

            {/* Zoom level indicator */}
            {isZoomed && (
                <span className="pointer-events-none absolute bottom-2 right-2 select-none rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white backdrop-blur-sm">
                    {zoom.toFixed(1)}x
                </span>
            )}
        </div>
    );
}
