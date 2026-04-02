import { useState, useCallback, useRef, useEffect } from 'react';
import type { RenderFn } from 'editorjs-blocks-react-renderer';

export interface BeforeAfterData {
    beforeUrl?: string;
    afterUrl?: string;
    beforeLabel?: string;
    afterLabel?: string;
    orientation?: 'horizontal' | 'vertical';
    sliderPosition?: number;
    caption?: string;
}

/**
 * Renderer for the Before/After comparison slider block.
 * Renders two overlapping images with a draggable divider handle.
 */
const BeforeAfter: RenderFn<BeforeAfterData> = ({ data, className = '' }) => {
    const beforeUrl = data?.beforeUrl || '';
    const afterUrl = data?.afterUrl || '';
    const beforeLabel = data?.beforeLabel || 'Before';
    const afterLabel = data?.afterLabel || 'After';
    const orientation = data?.orientation || 'horizontal';
    const initialPos = data?.sliderPosition ?? 50;
    const caption = data?.caption || '';

    const [position, setPosition] = useState(initialPos);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);

    if (!beforeUrl && !afterUrl) return null;

    const isVertical = orientation === 'vertical';

    const handleMove = useCallback(
        (clientX: number, clientY: number) => {
            if (!isDragging.current || !containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            let pct: number;
            if (isVertical) {
                pct = ((clientY - rect.top) / rect.height) * 100;
            } else {
                pct = ((clientX - rect.left) / rect.width) * 100;
            }
            setPosition(Math.max(0, Math.min(100, pct)));
        },
        [isVertical],
    );

    const handlePointerDown = useCallback(() => {
        isDragging.current = true;
    }, []);

    const handlePointerUp = useCallback(() => {
        isDragging.current = false;
    }, []);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
        const onTouchMove = (e: TouchEvent) => {
            if (e.touches.length) handleMove(e.touches[0].clientX, e.touches[0].clientY);
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
        };
    }, [handleMove]);

    const clipBefore = isVertical ? `inset(0 0 ${100 - position}% 0)` : `inset(0 ${100 - position}% 0 0)`;

    const handleStyle: React.CSSProperties = isVertical
        ? { top: `${position}%`, left: 0, right: 0, width: '100%', height: '4px', transform: 'translateY(-50%)' }
        : { left: `${position}%`, top: 0, bottom: 0, height: '100%', width: '4px', transform: 'translateX(-50%)' };

    return (
        <figure className={`${className} cdc-content-block cdc-before-after`}>
            <div
                ref={containerRef}
                className={`cdc-before-after__container${isVertical ? ' cdc-before-after__container--vertical' : ''}`}
                role="slider"
                aria-label="Before and after comparison slider"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(position)}
            >
                {/* After layer (bottom) */}
                {afterUrl && (
                    <img src={afterUrl} alt={afterLabel} className="cdc-before-after__after" draggable={false} />
                )}

                {/* Before layer (clipped) */}
                {beforeUrl && (
                    <div className="cdc-before-after__before" style={{ clipPath: clipBefore }}>
                        <img src={beforeUrl} alt={beforeLabel} draggable={false} />
                    </div>
                )}

                {/* Labels */}
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
