import type { RenderFn } from 'editorjs-blocks-react-renderer';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Image position presets (maps to CSS object-position) */
export type ImagePosition =
    | 'top-left'
    | 'top'
    | 'top-right'
    | 'left'
    | 'center'
    | 'right'
    | 'bottom-left'
    | 'bottom'
    | 'bottom-right';

/** Convert position preset to CSS object-position value */
function positionToCSS(pos: ImagePosition | undefined): string {
    if (!pos) return 'center center';
    const map: Record<ImagePosition, string> = {
        'top-left': 'left top',
        top: 'center top',
        'top-right': 'right top',
        left: 'left center',
        center: 'center center',
        right: 'right center',
        'bottom-left': 'left bottom',
        bottom: 'center bottom',
        'bottom-right': 'right bottom',
    };
    return map[pos] || 'center center';
}

export interface BeforeAfterData {
    beforeUrl?: string;
    afterUrl?: string;
    /** Optional label. If null/empty, the label is not rendered. */
    beforeLabel?: string | null;
    /** Optional label. If null/empty, the label is not rendered. */
    afterLabel?: string | null;
    orientation?: 'horizontal' | 'vertical';
    sliderPosition?: number;
    caption?: string;
    /** Optional fixed height (e.g., '400px', '50vh') */
    height?: string;
    /** Image fit mode: 'contain' preserves aspect ratio, 'cover' fills container */
    imageFit?: 'contain' | 'cover';
    /** Position of before image when using cover fit */
    beforePosition?: ImagePosition;
    /** Position of after image when using cover fit */
    afterPosition?: ImagePosition;
}

/**
 * Renderer for the Before/After comparison slider block.
 * Renders two overlapping images with a draggable divider handle.
 *
 * ## Enhanced Interactions:
 * - Drag anywhere on the image to move the slider
 * - Double-click: Smart toggle between 0 → 50 → 100 (cycles based on current position)
 * - Triple-click: Always resets to 0 (show full "after" image)
 */
const BeforeAfter: RenderFn<BeforeAfterData> = ({ data, className = '' }) => {
    const beforeUrl = data?.beforeUrl || '';
    const afterUrl = data?.afterUrl || '';
    /* Labels: null or empty string means don't render */
    const beforeLabel = data?.beforeLabel || null;
    const afterLabel = data?.afterLabel || null;
    const orientation = data?.orientation || 'horizontal';
    const initialPos = data?.sliderPosition ?? 50;
    const caption = data?.caption || '';
    const height = data?.height;
    const imageFit = data?.imageFit || 'contain';
    const beforePosition = data?.beforePosition;
    const afterPosition = data?.afterPosition;

    const [position, setPosition] = useState(initialPos);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const clickCount = useRef(0);
    const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    if (!beforeUrl && !afterUrl) return null;

    const isVertical = orientation === 'vertical';

    const isVerticalRef = useRef(isVertical);
    isVerticalRef.current = isVertical;

    /* Start drag on container or handle */
    const handlePointerDown = useCallback(() => {
        isDragging.current = true;
    }, []);

    /* Smart double/triple click handler */
    const handleClick = useCallback(
        (e: React.MouseEvent) => {
            clickCount.current++;

            if (clickTimer.current) {
                clearTimeout(clickTimer.current);
            }

            clickTimer.current = setTimeout(() => {
                const clicks = clickCount.current;
                clickCount.current = 0;

                if (clicks === 3) {
                    /* Triple-click: always reset to 0 (show full "after" image) */
                    setPosition(0);
                } else if (clicks === 2) {
                    /* Double-click: smart toggle between 0 / 50 / 100 */
                    setPosition((current) => {
                        if (current < 25) return 50; // 0-24 → go to 50
                        if (current < 75) return 100; // 25-74 → go to 100
                        return 0; // 75-100 → go to 0
                    });
                }
            }, 250); // Wait for potential triple-click
        },
        [setPosition],
    );

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            const pct = isVerticalRef.current
                ? ((e.clientY - rect.top) / rect.height) * 100
                : ((e.clientX - rect.left) / rect.width) * 100;
            setPosition(Math.max(0, Math.min(100, pct)));
        };
        const onTouchMove = (e: TouchEvent) => {
            if (!isDragging.current || !containerRef.current || !e.touches.length) return;
            const rect = containerRef.current.getBoundingClientRect();
            const pct = isVerticalRef.current
                ? ((e.touches[0].clientY - rect.top) / rect.height) * 100
                : ((e.touches[0].clientX - rect.left) / rect.width) * 100;
            setPosition(Math.max(0, Math.min(100, pct)));
        };
        const onUp = () => {
            isDragging.current = false;
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('touchmove', onTouchMove, { passive: true });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchend', onUp);
            if (clickTimer.current) clearTimeout(clickTimer.current);
        };
    }, []);

    const clipBefore = isVertical ? `inset(0 0 ${100 - position}% 0)` : `inset(0 ${100 - position}% 0 0)`;

    const handleStyle: React.CSSProperties = isVertical
        ? { top: `${position}%`, left: 0, right: 0, width: '100%', height: '4px', transform: 'translateY(-50%)' }
        : { left: `${position}%`, top: 0, bottom: 0, height: '100%', width: '4px', transform: 'translateX(-50%)' };

    /* Container styles for height and cover mode */
    const containerStyle = useMemo((): React.CSSProperties => {
        const style: React.CSSProperties = {};
        if (height) style.height = height;
        return style;
    }, [height]);

    /* Image styles for cover mode with position */
    const afterImgStyle = useMemo((): React.CSSProperties | undefined => {
        if (imageFit !== 'cover') return undefined;
        return { objectPosition: positionToCSS(afterPosition) };
    }, [imageFit, afterPosition]);

    const beforeImgStyle = useMemo((): React.CSSProperties | undefined => {
        if (imageFit !== 'cover') return undefined;
        return { objectPosition: positionToCSS(beforePosition) };
    }, [imageFit, beforePosition]);

    const containerClasses = [
        'cdc-before-after__container',
        isVertical && 'cdc-before-after__container--vertical',
        imageFit === 'cover' && 'cdc-before-after__container--cover',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <figure className={`${className} cdc-content-block cdc-before-after`}>
            <div
                ref={containerRef}
                className={containerClasses}
                style={containerStyle}
                role="slider"
                aria-label="Before and after comparison slider"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(position)}
                onMouseDown={handlePointerDown}
                onTouchStart={handlePointerDown}
                onClick={handleClick}
            >
                {/* After layer (bottom) */}
                {afterUrl && (
                    <img
                        src={afterUrl}
                        alt={afterLabel || 'After'}
                        className="cdc-before-after__after"
                        style={afterImgStyle}
                        draggable={false}
                    />
                )}

                {/* Before layer (clipped) */}
                {beforeUrl && (
                    <div className="cdc-before-after__before" style={{ clipPath: clipBefore }}>
                        <img src={beforeUrl} alt={beforeLabel || 'Before'} style={beforeImgStyle} draggable={false} />
                    </div>
                )}

                {/* Labels: only render if the label has content */}
                {beforeLabel && (
                    <span className="cdc-before-after__label cdc-before-after__label--before">{beforeLabel}</span>
                )}
                {afterLabel && (
                    <span className="cdc-before-after__label cdc-before-after__label--after">{afterLabel}</span>
                )}

                {/* Drag handle */}
                <div
                    className="cdc-before-after__handle"
                    style={handleStyle}
                    onMouseDown={handlePointerDown}
                    onTouchStart={handlePointerDown}
                />
            </div>

            {caption && <figcaption className="cdc-before-after__caption">{caption}</figcaption>}
        </figure>
    );
};

export default BeforeAfter;
